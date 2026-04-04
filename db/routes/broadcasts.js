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

// ─── POST /api/broadcasts — créer / lancer une diffusion ─────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const {
        templateName,
        type = 'texte',          // texte | tts | audio | image | document
        langue,
        parametres = [],
        langueTemplate = 'fr',
        messageAudio   = '',     // texte pour TTS
        mediaUrl       = '',     // URL Cloudinary pour audio/image/document uploadé
        mediaFileName  = '',     // nom du fichier (document)
        traduire       = false,  // traduire le texte TTS avant génération
        langueTraduction = 'ha', // langue cible de traduction
        dateEnvoi,
    } = req.body;

    if (!templateName) {
        return res.status(400).json({ message: 'Nom du template requis.' });
    }
    if (type === 'tts' && !messageAudio.trim()) {
        return res.status(400).json({ message: 'Le texte a convertir en audio est requis.' });
    }
    if (['audio', 'image', 'document'].includes(type) && !mediaUrl) {
        return res.status(400).json({ message: 'Aucun fichier charge. Veuillez uploader un fichier.' });
    }

    const filter = {};
    if (langue === 'fr') filter.langue = 'fr';
    if (langue === 'ha') filter.langue = { $in: ['hausa', 'ha'] };

    const contacts = await Contact.find(filter).lean();
    if (contacts.length === 0) {
        return res.status(400).json({ message: 'Aucun contact trouve pour cette selection.' });
    }

    const plannedDate = dateEnvoi ? new Date(dateEnvoi) : null;
    const isScheduled = plannedDate && plannedDate > new Date();

    const broadcast = await Broadcast.create({
        templateName, type, langue, langueTemplate,
        parametres, messageAudio, audioUrl: mediaUrl,
        total: contacts.length,
        statut: isScheduled ? 'planifie' : 'en_cours',
        dateEnvoi: plannedDate,
        creePar: req.user.id,
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

    envoyerDiffusion(broadcast, contacts, { traduire, langueTraduction, mediaFileName }).catch(err =>
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

async function envoyerDiffusion(broadcast, contacts, opts = {}) {
    const { traduire = false, langueTraduction = 'ha', mediaFileName = '' } = opts;
    const headers = {
        Authorization: `Bearer ${process.env.META_TOKEN}`,
        'Content-Type': 'application/json',
    };

    // TTS : générer l'audio une seule fois (avec traduction optionnelle)
    let resolvedMediaUrl = broadcast.audioUrl ?? '';
    if (broadcast.type === 'tts') {
        try {
            const lang = broadcast.langueTemplate === 'ha' ? 'ha' : 'fr';
            let texte  = broadcast.messageAudio;
            if (traduire && texte) {
                console.log(`[BROADCAST] Traduction vers ${langueTraduction}...`);
                texte = await translateText(texte, langueTraduction);
                console.log('[BROADCAST] Texte traduit:', texte);
            }
            const buffer = await generateTTS(prepareVoiceText(texte), lang);
            const result = await uploadAudio(buffer, 'broadcast_audio');
            resolvedMediaUrl = result.secure_url;
            await broadcast.updateOne({ audioUrl: resolvedMediaUrl });
            console.log('[BROADCAST] TTS uploade:', resolvedMediaUrl);
        } catch (err) {
            console.error('[BROADCAST] Echec TTS:', err.message);
            await broadcast.updateOne({ statut: 'erreur' });
            return;
        }
    }

    let envoyes = 0;
    let echecs  = 0;

    // Envoi par batches
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(contact => sendOne(broadcast, contact, headers, resolvedMediaUrl, mediaFileName))
        );

        for (let j = 0; j < results.length; j++) {
            const r       = results[j];
            const contact = batch[j];
            if (r.status === 'fulfilled') {
                envoyes++;
                const messageId = r.value ?? '';
                await BroadcastMessage.create({
                    broadcastId: broadcast._id,
                    whatsappId:  contact.whatsappId,
                    messageId,
                    statut: 'envoye',
                });
                console.log(`[BROADCAST] ✓ +${contact.whatsappId}`);
            } else {
                echecs++;
                await BroadcastMessage.create({
                    broadcastId: broadcast._id,
                    whatsappId:  contact.whatsappId,
                    messageId:   '',
                    statut: 'echec',
                });
                console.error(`[BROADCAST] ✗ +${contact.whatsappId}:`, r.reason?.message);
            }
        }

        // Mise à jour progressive en base
        await broadcast.updateOne({ envoyes, echecs });

        if (i + BATCH_SIZE < contacts.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
    }

    await broadcast.updateOne({ envoyes, echecs, statut: 'termine' });
    console.log(`[BROADCAST] Terminé — ${envoyes} envoyés, ${echecs} échecs`);
}

async function sendOne(broadcast, contact, headers, mediaUrl, mediaFileName = '') {
    const components = [];

    // Header media (tts, audio, image, document)
    if (mediaUrl && ['tts', 'audio', 'image', 'document'].includes(broadcast.type)) {
        const headerType = broadcast.type === 'image' ? 'image'
                         : broadcast.type === 'document' ? 'document'
                         : 'audio';
        const param = { type: headerType, [headerType]: { link: mediaUrl } };
        if (headerType === 'document' && mediaFileName) {
            param[headerType].filename = mediaFileName;
        }
        components.push({ type: 'header', parameters: [param] });
    }

    // Body variables (texte)
    if (broadcast.parametres?.length > 0) {
        components.push({
            type: 'body',
            parameters: broadcast.parametres.map(p => ({ type: 'text', text: p })),
        });
    }

    const payload = {
        messaging_product: 'whatsapp',
        to:   contact.whatsappId,
        type: 'template',
        template: {
            name:     broadcast.templateName,
            language: { code: broadcast.langueTemplate },
            ...(components.length > 0 && { components }),
        },
    };

    const response = await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        payload,
        { headers }
    );

    return response.data?.messages?.[0]?.id ?? '';
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
            const filter = {};
            if (broadcast.langue === 'fr') filter.langue = 'fr';
            if (broadcast.langue === 'ha') filter.langue = { $in: ['hausa', 'ha'] };

            const contacts = await Contact.find(filter).lean();
            if (contacts.length === 0) {
                await broadcast.updateOne({ statut: 'erreur' });
                continue;
            }

            await broadcast.updateOne({ statut: 'en_cours', total: contacts.length });
            console.log(`[CRON] Lancement diffusion planifiée ${broadcast._id} → ${contacts.length} contacts`);

            envoyerDiffusion(broadcast, contacts).catch(err =>
                console.error('[CRON] Erreur diffusion planifiée:', err.message)
            );
        }
    } catch (err) {
        console.error('[CRON] Erreur planificateur:', err.message);
    }
});

export default router;
