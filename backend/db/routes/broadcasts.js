import express from 'express';
import axios from 'axios';
import multer from 'multer';
import cron from 'node-cron';
import { v2 as cloudinary } from 'cloudinary';
import OpenAI from 'openai';
import Contact from '../models/Contact.js';
import Broadcast from '../models/Broadcast.js';
import BroadcastMessage from '../models/BroadcastMessage.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { generateTTS, prepareVoiceText, uploadAudio } from '../../lib/audio.js';

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});

const openai  = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const CLOUDINARY_RESOURCE = {
    audio:    { resource_type: 'video',    folder: 'broadcast_audio'     },
    image:    { resource_type: 'image',    folder: 'broadcast_images'    },
    document: { resource_type: 'raw',      folder: 'broadcast_documents' },
};

// ─── POST /api/broadcasts/upload — upload média vers Cloudinary ─
router.post('/upload', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });

    const mediaType = req.body.mediaType ?? 'audio'; // audio | image | document
    const cfg       = CLOUDINARY_RESOURCE[mediaType] ?? CLOUDINARY_RESOURCE.audio;

    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { ...cfg, use_filename: true, unique_filename: true },
                (err, r) => err ? reject(err) : resolve(r)
            ).end(req.file.buffer);
        });
        res.json({ url: result.secure_url, publicId: result.public_id, mediaType });
    } catch (err) {
        console.error('[UPLOAD]', err.message);
        res.status(500).json({ message: 'Erreur upload fichier.' });
    }
});

const BATCH_SIZE  = 10;   // messages envoyés en parallèle
const BATCH_DELAY = 300;  // ms entre chaque batch

// ─── GET /api/broadcasts — historique ────────────────────────
router.get('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const broadcasts = await Broadcast.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('creePar', 'nom email');
        res.json(broadcasts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/broadcasts/:id — progression en temps réel ─────
router.get('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const broadcast = await Broadcast.findById(req.params.id).populate('creePar', 'nom email');
        if (!broadcast) return res.status(404).json({ message: 'Diffusion introuvable.' });
        res.json(broadcast);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/broadcasts ─────────────────────────────────────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const {
        templateName,
        langueTemplate = 'fr',
        variables      = [],   // nouveau format
        contactIds     = [],
        dateEnvoi,
    } = req.body;

    if (!templateName?.trim()) {
        return res.status(400).json({ message: 'Le nom du template est requis.' });
    }
    if (contactIds.length === 0) {
        return res.status(400).json({ message: 'Selectionnez au moins un contact.' });
    }

    // Validation variables
    const MEDIA_VAR_TYPES = ['image','audio','audio_tts','document','video'];
    for (const v of variables) {
        if (MEDIA_VAR_TYPES.includes(v.type) && !v.mediaUrl && v.type !== 'audio_tts') {
            return res.status(400).json({ message: `Variable ${v.type} : aucun fichier uploade.` });
        }
        if (v.type === 'audio_tts' && !v.ttsText?.trim()) {
            return res.status(400).json({ message: 'Variable audio TTS : le texte est requis.' });
        }
        if (v.type === 'text' && !v.value?.trim()) {
            return res.status(400).json({ message: 'Une variable texte est vide.' });
        }
    }

    const contacts = await Contact.find({ _id: { $in: contactIds } }).lean();
    if (contacts.length === 0) {
        return res.status(400).json({ message: 'Aucun contact valide trouve.' });
    }

    const plannedDate = dateEnvoi ? new Date(dateEnvoi) : null;
    const isScheduled = plannedDate && plannedDate > new Date();

    const broadcast = await Broadcast.create({
        templateName:  templateName.trim(),
        langueTemplate,
        variables,
        contactIds:    contacts.map(c => c._id),
        total:         contacts.length,
        statut:        isScheduled ? 'planifie' : 'en_cours',
        dateEnvoi:     plannedDate,
        creePar:       req.user.id,
    });

    if (isScheduled) {
        res.json({
            message: `Diffusion planifiee pour le ${plannedDate.toLocaleString('fr-FR')} — ${contacts.length} contact(s).`,
            broadcastId: broadcast._id,
        });
        return;
    }

    res.json({
        message: `Diffusion lancee vers ${contacts.length} contact(s).`,
        broadcastId: broadcast._id,
    });

    envoyerDiffusion(broadcast, contacts).catch(err =>
        console.error('[BROADCAST] Erreur:', err.message)
    );
});

// ─── Envoi en arrière-plan ────────────────────────────────────

async function translateText(text, targetLang) {
    const langName = targetLang === 'ha' ? 'Hausa' : 'French';
    const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
            { role: 'system', content: `Translate the following text to ${langName}. Return only the translation, no explanation.` },
            { role: 'user',   content: text }
        ]
    });
    return res.choices[0].message.content.trim();
}

// ─── Construction dynamique des composants WhatsApp ──────────
// Audio et audio_tts sont exclus du template (non supportés par Meta)
// et envoyés en message libre séparé dans sendOne.
function buildComponents(variables) {
    if (!variables?.length) return [];
    const components = [];

    // Header : image, document ou video uniquement (pas audio)
    const HEADER_TYPES = ['image', 'document', 'video'];
    const headerVar = variables.find(v => HEADER_TYPES.includes(v.type) && v.mediaUrl);
    if (headerVar) {
        const param = { type: headerVar.type, [headerVar.type]: { link: headerVar.mediaUrl } };
        if (headerVar.type === 'document' && headerVar.mediaFileName) {
            param.document.filename = headerVar.mediaFileName;
        }
        components.push({ type: 'header', parameters: [param] });
    }

    // Variables texte → body
    const bodyVars = variables.filter(v => v.type === 'text' && v.value);
    if (bodyVars.length > 0) {
        components.push({
            type: 'body',
            parameters: bodyVars.map(v => ({ type: 'text', text: v.value })),
        });
    }

    return components;
}

async function envoyerDiffusion(broadcast, contacts) {
    const headers = {
        Authorization: `Bearer ${process.env.META_TOKEN}`,
        'Content-Type': 'application/json',
    };

    // Résoudre les variables TTS avant l'envoi (génération unique)
    let resolvedVars = [...(broadcast.variables ?? [])];
    const lang = broadcast.langueTemplate === 'ha' ? 'ha' : 'fr';

    for (let i = 0; i < resolvedVars.length; i++) {
        const v = resolvedVars[i];
        if (v.type === 'audio_tts' && v.ttsText) {
            try {
                const buffer = await generateTTS(prepareVoiceText(v.ttsText), lang);
                const result = await uploadAudio(buffer, 'broadcast_audio');
                resolvedVars[i] = { ...v, mediaUrl: result.secure_url };
                console.log(`[BROADCAST] TTS var[${i}] uploade:`, result.secure_url);
            } catch (err) {
                console.error(`[BROADCAST] Echec TTS var[${i}]:`, err.message);
                await broadcast.updateOne({ statut: 'erreur', errorLog: `TTS generation failed: ${err.message}` });
                return;
            }
        }
    }

    // Sauvegarder les URLs générées
    await broadcast.updateOne({ variables: resolvedVars });

    let envoyes = 0;
    let echecs  = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(contact => sendOne(broadcast, contact, headers, resolvedVars))
        );

        for (let j = 0; j < results.length; j++) {
            const r       = results[j];
            const contact = batch[j];
            if (r.status === 'fulfilled') {
                envoyes++;
                const msgId = r.value ?? '';
                if (!msgId) {
                    // Numéro test ou API sans id → on ne crée pas de BroadcastMessage
                    // (impossible de tracker la livraison sans messageId)
                    console.warn(`[BROADCAST] ok +${contact.whatsappId} — pas de messageId (numéro test ?)`);
                } else {
                    await BroadcastMessage.create({
                        broadcastId: broadcast._id,
                        whatsappId:  contact.whatsappId,
                        messageId:   msgId,
                        statut: 'envoye',
                    });
                }
                console.log(`[BROADCAST] ok +${contact.whatsappId}`);
            } else {
                echecs++;
                const errMsg = r.reason?.response?.data?.error?.message ?? r.reason?.message ?? 'unknown';
                await BroadcastMessage.create({
                    broadcastId: broadcast._id,
                    whatsappId:  contact.whatsappId,
                    messageId:   '',
                    statut: 'echec',
                });
                console.error(`[BROADCAST] fail +${contact.whatsappId}:`, errMsg);
                if (echecs === 1) await broadcast.updateOne({ errorLog: errMsg });
            }
        }

        await broadcast.updateOne({ envoyes, echecs });
        if (i + BATCH_SIZE < contacts.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
    }

    await broadcast.updateOne({ envoyes, echecs, statut: 'termine' });
    console.log(`[BROADCAST] done — ${envoyes} ok, ${echecs} fail`);
}

async function sendOne(broadcast, contact, headers, resolvedVars) {
    const components = buildComponents(resolvedVars);

    // Étape 1 — Template image (ouvre la fenêtre 24h)
    const templateResponse = await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        {
            messaging_product: 'whatsapp',
            to:   contact.whatsappId,
            type: 'template',
            template: {
                name:     broadcast.templateName,
                language: { code: broadcast.langueTemplate },
                ...(components.length > 0 && { components }),
            },
        },
        { headers }
    );

    const messageId = templateResponse.data?.messages?.[0]?.id ?? '';

    // Étape 2 — Audio en message libre (fenêtre 24h maintenant ouverte)
    const audioVar = resolvedVars.find(v => (v.type === 'audio_tts' || v.type === 'audio') && v.mediaUrl);
    if (audioVar?.mediaUrl) {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to:   contact.whatsappId,
                type: 'audio',
                audio: { link: audioVar.mediaUrl },
            },
            { headers }
        );
        console.log(`[BROADCAST] Audio envoyé à +${contact.whatsappId}`);
    }

    return messageId;
}

// ─── Planificateur — vérifie chaque minute les diffusions planifiées ─
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        const due = await Broadcast.find({
            statut:    'planifie',
            dateEnvoi: { $lte: now },
        });

        for (const broadcast of due) {
            const contacts = await Contact.find({ _id: { $in: broadcast.contactIds } }).lean();
            if (contacts.length === 0) {
                await broadcast.updateOne({ statut: 'erreur', errorLog: 'No contacts found for this broadcast.' });
                continue;
            }

            await broadcast.updateOne({ statut: 'en_cours' });
            console.log(`[CRON] Launching scheduled broadcast ${broadcast._id} → ${contacts.length} contacts`);

            envoyerDiffusion(broadcast, contacts).catch(err =>
                console.error('[CRON] Error:', err.message)
            );
        }
    } catch (err) {
        console.error('[CRON] Erreur planificateur:', err.message);
    }
});

export default router;
