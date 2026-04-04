import express from 'express';
import axios from 'axios';
import fs from 'fs';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import SYSTEM_PROMPT from '../prompt.js';
import {HAUSA_PHRASES,HAUSA_WORDS,FRENCH_WORDS, VERIFY_TOKEN, DEFAULT_MESSAGES, GREETING_CONFIG } from '../constants/config.js';
import Contact from '../db/models/Contact.js';
import Conversation from '../db/models/Conversations.js';
import Message from '../db/models/Message.js';
import Structure from '../db/models/Structure.js';

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });





// ─── Détection de langue par analyse du texte ───────────────

function detectTextLanguage(text) {
    if (!text || text.trim().length === 0) return 'unknown';

    // Caractères spéciaux Hausa = signal fort et direct
    if (/[ƙɗɓ]/.test(text)) return 'ha';

    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Phrases multi-mots Hausa (vérifiées sur le texte complet)
    if (HAUSA_PHRASES.some(phrase => normalized.includes(phrase))) return 'ha';

    const words = normalized.split(/\s+/);

    let frScore = 0;
    let haScore = 0;

    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (FRENCH_WORDS.has(clean)) frScore++;
        if (HAUSA_WORDS.has(clean)) haScore++;
    }

    console.log(`[LANG] Scoring — FR: ${frScore}, HA: ${haScore}`);

    if (frScore === 0 && haScore === 0) return 'unknown';
    if (frScore > haScore) return 'fr';
    if (haScore > frScore) return 'ha';
    return 'unknown'; // égalité → indéterminé
}

// ─── Croiser Whisper + analyse texte ────────────────────────

function resolveFinalLanguage(whisperLang, textLang) {
    const whisperCode = whisperLang === 'hausa' ? 'ha'
        : whisperLang === 'french' ? 'fr'
        : 'unknown';

    // Les deux sont d'accord → confiance maximale
    if (whisperCode !== 'unknown' && whisperCode === textLang) return whisperCode;

    // L'analyse texte est plus précise que Whisper pour Hausa/Français
    if (textLang !== 'unknown') return textLang;

    // Whisper seul en dernier recours
    if (whisperCode !== 'unknown') return whisperCode;

    return 'unknown';
}

// ─── Contrôle qualité audio (via segments Whisper) ──────────
// Seuils assouplis pour les langues africaines (Hausa, etc.)
// Whisper est moins confiant sur ces langues → log_prob plus bas, no_speech plus élevé

function checkAudioQuality(transcription) {
    const text = transcription.text?.trim() ?? '';

    if (text.length < 3) {
        return { ok: false, reason: 'Aucune parole détectée dans l\'audio. / Babu magana da aka ji.' };
    }

    const segments = transcription.segments ?? [];
    if (segments.length === 0) return { ok: true };

    const avgNoSpeech   = segments.reduce((s, seg) => s + seg.no_speech_prob, 0) / segments.length;
    const avgLogProb    = segments.reduce((s, seg) => s + seg.avg_logprob, 0) / segments.length;
    const avgCompRatio  = segments.reduce((s, seg) => s + seg.compression_ratio, 0) / segments.length;

    console.log(`[AUDIO QUALITY] no_speech: ${avgNoSpeech.toFixed(2)}, logprob: ${avgLogProb.toFixed(2)}, compression: ${avgCompRatio.toFixed(2)}`);

    if (avgNoSpeech > 0.85) {
        return { ok: false, reason: 'Audio trop bruité ou silencieux. / Murya ba ta bayyana ba.' };
    }
    if (avgLogProb < -1.5) {
        return { ok: false, reason: 'Audio peu clair, veuillez réessayer. / Murya ba ta fito sosai.' };
    }
    if (avgCompRatio > 3.0) {
        return { ok: false, reason: 'Audio non reconnu. Parlez distinctement. / Fadi a fili.' };
    }

    return { ok: true };
}

// ─── Persistance DB ──────────────────────────────────────────

async function getOrCreateContact(whatsappId) {
    let contact = await Contact.findOne({ whatsappId });
    if (!contact) {
        contact = await Contact.create({ whatsappId });
    }
    return contact;
}

async function getOrCreateConversation(contactId, langue) {
    let conv = await Conversation.findOne({ contactId, statut: 'ouvert' });
    if (!conv) {
        conv = await Conversation.create({ contactId, langue });
    }
    return conv;
}

async function saveMessages(contactId, langue, { humanText, aiText, audioUrl = '', cloudinaryId = '' }) {
    const conv = await getOrCreateConversation(contactId, langue);

    const isAudio = !!audioUrl;

    await Message.create({
        conversationId: conv._id,
        emetteurType: 'humain',
        typeContenu: isAudio ? 'audio' : 'text',
        texteBrut: humanText,
        langue
    });

    await Message.create({
        conversationId: conv._id,
        emetteurType: 'agent_ia',
        typeContenu: isAudio ? 'audio' : 'text',
        texteBrut: aiText,
        audioUrl,
        cloudinaryId,
        langue
    });

    conv.nbMessages += 2;
    conv.derniereMiseAJour = new Date();
    await conv.save();
}

// ─── Routes ─────────────────────────────────────────────────

// GET /webhook — Validation Meta
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// POST /webhook — Réception des messages
router.post('/', (req, res) => {
    res.sendStatus(200);

    const body = req.body;
    console.log("Webhook reçu:", JSON.stringify(body));

    if (!body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return;

    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    console.log(`Message de ${from}, type: ${message.type}`);

    if (message.type === 'audio') {
        processAudio(message.audio.id, from).catch(err =>
            console.error("Erreur traitement audio:", err.message)
        );
    } else if (message.type === 'text') {
        processText(message.text.body, from).catch(err =>
            console.error("Erreur traitement texte:", err.message)
        );
    } else if (message.type === 'location') {
        processLocation(message.location.latitude, message.location.longitude, from).catch(err =>
            console.error("Erreur traitement localisation:", err.message)
        );
    } else {
        console.log(`Type de message non géré: ${message.type}`);
    }
});

// ─── Helpers communs ─────────────────────────────────────────

function isGreeting(text) {
    const normalized = text.toLowerCase().trim();
    return GREETING_CONFIG.keywords.some(kw => normalized.includes(kw));
}

async function sendGreetingResponse(userPhone) {
    const hasImage = GREETING_CONFIG.image_url?.startsWith('http');
    const headers = { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' };
    const base = { messaging_product: "whatsapp", to: userPhone };

    if (hasImage) {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            { ...base, type: "image", image: { link: GREETING_CONFIG.image_url, caption: GREETING_CONFIG.image_caption } },
            { headers }
        );
    }
    await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        { ...base, type: "text", text: { body: GREETING_CONFIG.message } },
        { headers }
    );
}

function prepareVoiceText(text) {
    return text
        .replace(/\n\n+/g, '. ')
        .replace(/\n/g, ', ')
        .replace(/\s*-\s+/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
}

async function sendWhatsAppText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
        { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
    );
}

function buildLangInstruction(lang, isAudio = false) {
    if (isAudio) {
        return lang === 'ha'
            ? `\n\nIMPORTANT: Message audio en Hausa. Réponds UNIQUEMENT en Hausa. 2 à 3 phrases simples. Pas de symboles, pas de listes, pas d'astérisques — texte brut uniquement car ta réponse sera lue à voix haute.`
            : `\n\nIMPORTANT: Message audio en français. Réponds UNIQUEMENT en français. 2 à 3 phrases simples et naturelles. Pas de symboles, pas de listes, pas d'astérisques — texte brut uniquement car ta réponse sera lue à voix haute.`;
    }
    return lang === 'ha'
        ? `\n\nIMPORTANT: Message en Hausa. Réponds UNIQUEMENT en Hausa. Maximum 4 phrases.`
        : `\n\nIMPORTANT: Message en français. Réponds UNIQUEMENT en français. Maximum 4 phrases courtes et directes.`;
}

async function ttsElevenLabs(text) {
    const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.VOICE_ID}`,
        {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true }
        },
        {
            headers: { 'xi-api-key': process.env.ELEVEN_KEY, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer'
        }
    );
    return Buffer.from(res.data);
}

async function ttsOpenAI(text) {
    const res = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        { model: 'tts-1-hd', voice: 'shimmer', input: text, speed: 0.92 },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }, responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
}

async function generateTTS(text, lang) {
    // ElevenLabs pour le Hausa (meilleur support multilingue africain)
    // OpenAI shimmer pour le français (voix plus naturelle)
    if (lang === 'ha') {
        return ttsElevenLabs(text);
    }
    return ttsOpenAI(text);
}

async function getRecentMessages(conversationId, limit = 6) {
    const msgs = await Message.find({ conversationId })
        .sort({ dateEnvoi: -1 })
        .limit(limit)
        .lean();
    return msgs.reverse().map(m => ({
        role: m.emetteurType === 'humain' ? 'user' : 'assistant',
        content: m.texteBrut || ''
    })).filter(m => m.content.length > 0);
}

// ─── Traitement texte ────────────────────────────────────────

async function processText(userText, userPhone) {
    console.log(`[TEXT] Message reçu: "${userText}"`);

    if (isGreeting(userText)) {
        console.log('[TEXT] Salutation → bienvenue');
        await sendGreetingResponse(userPhone);
        return;
    }

    const lang = detectTextLanguage(userText);
    console.log(`[TEXT] Langue finale: ${lang}`);

    if (lang === 'unknown') {
        await sendWhatsAppText(userPhone, DEFAULT_MESSAGES.unknown);
        return;
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 150,
        messages: [
            { role: "system", content: SYSTEM_PROMPT + buildLangInstruction(lang) },
            { role: "user", content: userText }
        ]
    });
    const reply = response.choices[0].message.content;
    console.log(`[TEXT] Réponse (${lang}): ${reply}`);
    await sendWhatsAppText(userPhone, reply);

    try {
        const contact = await getOrCreateContact(userPhone);
        await saveMessages(contact._id, lang, { humanText: userText, aiText: reply });
    } catch (dbErr) {
        console.error('[DB] Erreur persistance text:', dbErr.message);
    }
}

// ─── Traitement audio ────────────────────────────────────────

async function processAudio(mediaId, userPhone) {
    const metaHeaders = { Authorization: `Bearer ${process.env.META_TOKEN}` };
    console.log('[1/6] Téléchargement audio, mediaId:', mediaId);

    // Récupérer le contact en avance pour avoir la langue préférée connue
    const contact = await getOrCreateContact(userPhone);
    const knownLang = contact.langue === 'hausa' ? 'ha' : contact.langue === 'fr' ? 'fr' : null;

    const mediaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: metaHeaders });
    const audioRes = await axios.get(mediaRes.data.url, { headers: metaHeaders, responseType: 'arraybuffer' });

    const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputFile = `input_${tmpId}.ogg`;
    const outputFile = `output_${tmpId}.mp3`;

    const audioBuffer = Buffer.from(audioRes.data);
    fs.writeFileSync(inputFile, audioBuffer);
    console.log('[2/6] Audio téléchargé:', audioBuffer.byteLength, 'bytes');

    // Transcription Whisper — hint de langue si connue (améliore la précision)
    const whisperParams = {
        file: fs.createReadStream(inputFile),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        ...(knownLang === 'ha' && { language: 'ha' }),
        ...(knownLang === 'fr' && { language: 'fr' })
    };
    const transcription = await openai.audio.transcriptions.create(whisperParams);
    console.log('[3/6] Whisper lang:', transcription.language, '| Texte:', transcription.text);

    // Filtre qualité
    const quality = checkAudioQuality(transcription);
    if (!quality.ok) {
        console.log('[AUDIO] Qualité insuffisante:', quality.reason);
        fs.unlink(inputFile, () => {});
        await sendWhatsAppText(userPhone, quality.reason);
        return;
    }

    // Salutation ?
    if (isGreeting(transcription.text)) {
        console.log('[AUDIO] Salutation → bienvenue');
        fs.unlink(inputFile, () => {});
        await sendGreetingResponse(userPhone);
        return;
    }

    // Détection de langue croisée : Whisper + analyse texte + langue connue du contact
    const textLang = detectTextLanguage(transcription.text);
    let finalLang = resolveFinalLanguage(transcription.language, textLang);
    if (finalLang === 'unknown' && knownLang) finalLang = knownLang;
    console.log(`[AUDIO] Whisper: ${transcription.language} | Texte: ${textLang} | Contact: ${knownLang} | Final: ${finalLang}`);

    if (finalLang === 'unknown') {
        fs.unlink(inputFile, () => {});
        await sendWhatsAppText(userPhone, DEFAULT_MESSAGES.unknown);
        return;
    }

    // Contexte conversationnel (6 derniers échanges)
    const conv = await getOrCreateConversation(contact._id, finalLang);
    const history = await getRecentMessages(conv._id);

    // Génération réponse GPT avec historique
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT + buildLangInstruction(finalLang, true) },
            ...history,
            { role: 'user', content: transcription.text }
        ]
    });
    const replyText = response.choices[0].message.content;
    console.log(`[4/6] Réponse GPT (${finalLang}): ${replyText}`);

    // TTS : ElevenLabs pour Hausa, OpenAI pour français
    const ttsBuffer = await generateTTS(prepareVoiceText(replyText), finalLang);
    console.log('[5/6] Audio TTS généré:', ttsBuffer.byteLength, 'bytes');

    // Upload Cloudinary
    fs.writeFileSync(outputFile, ttsBuffer);
    const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { resource_type: 'video', format: 'mp3', folder: 'chatbot_audio' },
            (error, result) => error ? reject(error) : resolve(result)
        ).end(ttsBuffer);
    });
    console.log('[6/6] Cloudinary URL:', uploadResult.secure_url);

    // Envoi WhatsApp
    await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        { messaging_product: 'whatsapp', to: userPhone, type: 'audio', audio: { link: uploadResult.secure_url } },
        { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`[OK] Réponse audio envoyée à ${userPhone}`);

    fs.unlink(inputFile, () => {});
    fs.unlink(outputFile, () => {});

    try {
        await saveMessages(contact._id, finalLang, {
            humanText: transcription.text,
            aiText: replyText,
            audioUrl: uploadResult.secure_url,
            cloudinaryId: uploadResult.public_id
        });
    } catch (dbErr) {
        console.error('[DB] Erreur persistance audio:', dbErr.message);
    }
}

// ─── Localisation ────────────────────────────────────────────

/**
 * Formule de Haversine — retourne la distance en km entre deux points GPS.
 */
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function processLocation(lat, lng, userPhone) {
    console.log(`[LOC] Position reçue de ${userPhone}: lat=${lat}, lng=${lng}`);

    // Récupère toutes les structures actives
    const structures = await Structure.find({ statutVaccination: true })
        .populate({ path: 'districtId', populate: { path: 'regionId' } });

    if (!structures.length) {
        await sendWhatsAppText(userPhone,
            'Aucune structure sanitaire trouvée dans notre base. / Babu cibiyar kiwon lafiya a cikin bayananmu.');
        return;
    }

    // Calcule la distance pour chaque structure et trie par proximité
    const withDistance = structures.map(s => ({
        ...s.toObject(),
        distance: haversine(lat, lng, s.coordonnees.latitude, s.coordonnees.longitude)
    }));
    withDistance.sort((a, b) => a.distance - b.distance);

    // Retourne les 3 plus proches
    const nearest = withDistance.slice(0, 3);

    const lines = nearest.map((s, i) => {
        const district = s.districtId?.nom ?? '';
        const region   = s.districtId?.regionId?.nom ?? '';
        const km       = s.distance.toFixed(1);
        const contact  = s.contactUrgence ? `📞 ${s.contactUrgence}` : '';
        return `${i + 1}. *${s.nom}* (${s.type})\n   📍 ${district}, ${region} — ${km} km\n   ${contact}`;
    });

    const message =
        `🏥 *Centres de vaccination les plus proches :*\n\n${lines.join('\n\n')}\n\n` +
        `_Envoyez votre position pour actualiser. / Aika wurin ka don sabuntawa._`;

    await sendWhatsAppText(userPhone, message);
    console.log(`[LOC] ${nearest.length} structures envoyées à ${userPhone}`);

    // Persistance
    try {
        const contact = await getOrCreateContact(userPhone);

        // Sauvegarde de la dernière position connue du contact
        contact.dernierePosition = { latitude: lat, longitude: lng, updatedAt: new Date() };
        await contact.save();

        const conv = await getOrCreateConversation(contact._id, 'unknown');
        await Message.create({
            conversationId: conv._id,
            emetteurType: 'humain',
            typeContenu: 'location',
            texteBrut: `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees: { latitude: lat, longitude: lng },
            langue: 'unknown'
        });
        await Message.create({
            conversationId: conv._id,
            emetteurType: 'agent_ia',
            typeContenu: 'text',
            texteBrut: message,
            langue: 'fr'
        });
        conv.nbMessages += 2;
        conv.derniereMiseAJour = new Date();
        await conv.save();
        console.log(`[DB] Position sauvegardée pour ${userPhone} : lat=${lat}, lng=${lng}`);
    } catch (dbErr) {
        console.error('[DB] Erreur persistance localisation:', dbErr.message);
    }
}

export default router;
