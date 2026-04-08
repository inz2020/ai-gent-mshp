import express from 'express';
import axios from 'axios';
import fs from 'fs';
import OpenAI from 'openai';
import { franc } from 'franc';
import SYSTEM_PROMPT from '../prompt.js';
import { FRENCH_WORDS, VERIFY_TOKEN, GREETING_CONFIG } from '../constants/config.js';
import { getHausaWords, getHausaPhrases, getHausaWhisperPrompt } from '../lib/hausaVocab.js';
import Contact from '../db/models/Contact.js';
import Conversation from '../db/models/Conversations.js';
import Message from '../db/models/Message.js';
import Structure from '../db/models/Structure.js';
import BroadcastMessage from '../db/models/BroadcastMessage.js';
import Broadcast from '../db/models/Broadcast.js';
import { generateTTS, ttsOpenAI, ttsElevenLabs, sttElevenLabs, prepareVoiceText, uploadAudio } from '../lib/audio.js';
import { getErrorAudioUrl, ERROR_TEXTS } from '../lib/errorAudio.js';

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });





// ─── Détection de langue par analyse du texte ───────────────
// Ordre de priorité : caractères spéciaux → phrases → franc → dictionnaire

function detectTextLanguage(text) {
    if (!text || text.trim().length === 0) return 'unknown';

    // 1. Caractères spéciaux Hausa = signal fort et direct
    if (/[ƙɗɓ]/.test(text)) return 'ha';

    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2. Phrases multi-mots Hausa (signal fort)
    if (getHausaPhrases().some(phrase => normalized.includes(phrase))) return 'ha';

    // 3. franc — détection statistique sur ~400 langues (supporte Hausa = 'hau')
    //    Seulement si le texte est assez long pour être fiable (>= 10 chars)
    if (text.trim().length >= 10) {
        const francLang = franc(text, { minLength: 10 });
        console.log(`[LANG] franc détecté: ${francLang}`);
        if (francLang === 'hau') return 'ha';
        if (francLang === 'fra') return 'fr';
    }

    // 4. Dictionnaire mot par mot (fallback pour textes courts)
    const words = normalized.split(/\s+/);
    let frScore = 0;
    let haScore = 0;

    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (FRENCH_WORDS.has(clean))       frScore++;
        if (getHausaWords().has(clean))    haScore++;
    }

    console.log(`[LANG] Dictionnaire — FR: ${frScore}, HA: ${haScore}`);

    if (frScore === 0 && haScore === 0) return 'unknown';
    if (frScore > haScore) return 'fr';
    if (haScore > frScore) return 'ha';
    return 'unknown';
}

// ─── Contrôle qualité audio (via segments Whisper) ──────────
// Seuils assouplis pour les langues africaines (Hausa, etc.)
// Whisper est moins confiant sur ces langues → log_prob plus bas, no_speech plus élevé
// isLikelyHausa=true → seuils encore plus souples (logprob Hausa souvent entre -1.6 et -2.2)

function checkAudioQuality(transcription, isLikelyHausa = false) {
    const text = transcription.text?.trim() ?? '';

    if (text.length < 3) {
        return { ok: false, reason: 'Aucune parole détectée dans l\'audio. / Babu magana da aka ji.' };
    }

    const segments = transcription.segments ?? [];
    if (segments.length === 0) return { ok: true };

    const avgNoSpeech   = segments.reduce((s, seg) => s + seg.no_speech_prob, 0) / segments.length;
    const avgLogProb    = segments.reduce((s, seg) => s + seg.avg_logprob, 0) / segments.length;
    const avgCompRatio  = segments.reduce((s, seg) => s + seg.compression_ratio, 0) / segments.length;

    console.log(`[AUDIO QUALITY] no_speech: ${avgNoSpeech.toFixed(2)}, logprob: ${avgLogProb.toFixed(2)}, compression: ${avgCompRatio.toFixed(2)}, hausa: ${isLikelyHausa}`);

    if (avgNoSpeech > 0.85) {
        return { ok: false, reason: 'Audio trop bruité ou silencieux. / Murya ba ta bayyana ba.' };
    }
    // Hausa est peu représenté dans le corpus Whisper → logprob plus bas par défaut
    const logProbThreshold = isLikelyHausa ? -2.3 : -1.5;
    if (avgLogProb < logProbThreshold) {
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
        contact = await Contact.create({ whatsappId, source: 'webhook' });
    }
    return contact;
}

async function getOrCreateConversation(contactId) {
    // Cherche ouvert OU escalade_humain — sinon on crée une nouvelle conversation
    let conv = await Conversation.findOne({ contactId, statut: { $in: ['ouvert', 'escalade_humain'] } });
    if (!conv) {
        conv = await Conversation.create({ contactId });
    }
    return conv;
}

async function isFirstConversation(userPhone) {
    const contact = await Contact.findOne({ whatsappId: userPhone });
    if (!contact) return true;
    const convCount = await Conversation.countDocuments({ contactId: contact._id });
    return convCount === 0;
}

async function saveMessages(contactId, langue, { humanText, aiText, humanAudioUrl = '', audioUrl = '', cloudinaryId = '' }) {
    const conv = await getOrCreateConversation(contactId);

    const isAudio = !!(humanAudioUrl || audioUrl);

    await Message.create({
        conversationId: conv._id,
        emetteurType: 'humain',
        typeContenu: isAudio ? 'audio' : 'text',
        texteBrut: humanText,
        audioUrl: humanAudioUrl,
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

// POST /webhook — Réception des messages + statuts de livraison
router.post('/', (req, res) => {
    res.sendStatus(200);

    const body  = req.body;
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value) return;

    // ── Suivi de livraison des diffusions (Étape 5) ──────────
    if (value.statuses?.length) {
        processStatuses(value.statuses).catch(err =>
            console.error('[STATUS] Erreur traitement statuts:', err.message)
        );
    }

    // ── Messages entrants ─────────────────────────────────────
    if (!value.messages?.[0]) return;

    const message = value.messages[0];
    const from    = message.from;
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

// ─── Traitement des statuts de livraison ─────────────────────
async function processStatuses(statuses) {
    for (const s of statuses) {
        const { id: messageId, status } = s;
        if (!messageId || !['delivered', 'read', 'failed'].includes(status)) continue;

        const bm = await BroadcastMessage.findOne({ messageId });
        if (!bm) continue;

        const newStatut = status === 'delivered' ? 'livre'
                        : status === 'read'      ? 'lu'
                        : 'echec';

        if (bm.statut === newStatut) continue;
        await bm.updateOne({ statut: newStatut });

        // Incrémenter le compteur agrégé sur le Broadcast
        const inc = {};
        if (newStatut === 'livre') inc.livre = 1;
        if (newStatut === 'lu')    { inc.lu = 1; inc.livre = 1; }
        if (newStatut === 'echec') inc.echecs = 1;

        await Broadcast.findByIdAndUpdate(bm.broadcastId, { $inc: inc });
        console.log(`[STATUS] ${messageId} → ${newStatut}`);
    }
}

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

    // Demande automatique de localisation après le message de bienvenue
    await sendLocationRequest(userPhone);
}

/**
 * Envoie un message interactif avec le bouton natif WhatsApp "Envoyer ma position".
 * Quand l'utilisateur appuie dessus, WhatsApp envoie un message de type 'location'
 * que processLocation() traite déjà pour trouver les centres les plus proches.
 */
async function sendLocationRequest(userPhone) {
    try {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: userPhone,
                type: 'interactive',
                interactive: {
                    type: 'location_request_message',
                    body: {
                        text: '📍 Partagez votre position pour trouver le centre de vaccination le plus proche de chez vous.\n\nKayi rabawa da wurin ka don nemo cibiyar rigakafi mafi kusa da kai.',
                    },
                    action: {
                        name: 'send_location',
                    },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.META_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[LOC-REQ] Demande de localisation envoyée à ${userPhone}`);
    } catch (err) {
        // Non bloquant — l'utilisateur peut toujours partager manuellement
        console.warn(`[LOC-REQ] Échec envoi location_request à ${userPhone}:`, err.response?.data?.error?.message ?? err.message);
    }
}

// prepareVoiceText importé depuis lib/audio.js

async function sendWhatsAppText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
        { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
    );
}

// Envoie TOUJOURS un message AUDIO (TTS).
// Chaîne de fallback selon la langue :
//   FR : OpenAI shimmer → ElevenLabs → texte (dernier recours)
//   HA : ElevenLabs     → OpenAI shimmer → texte (dernier recours)
async function sendAudioReply(to, text, lang = 'fr') {
    let ttsBuffer;
    const voiceText = prepareVoiceText(text);

    if (lang === 'ha') {
        // Tentative 1 : ElevenLabs (meilleur pour Hausa)
        try {
            ttsBuffer = await ttsElevenLabs(voiceText);
        } catch (e1) {
            console.warn('[TTS] ElevenLabs échoué (ha), fallback OpenAI shimmer:', e1.message);
            // Tentative 2 : OpenAI shimmer (lit le Hausa en romanisation)
            try {
                ttsBuffer = await ttsOpenAI(voiceText);
            } catch (e2) {
                console.error('[TTS] OpenAI shimmer aussi échoué, dernier recours texte:', e2.message);
                await sendWhatsAppText(to, text);
                return null;
            }
        }
    } else {
        // Tentative 1 : OpenAI shimmer (optimal pour FR)
        try {
            ttsBuffer = await ttsOpenAI(voiceText);
        } catch (e1) {
            console.warn('[TTS] OpenAI shimmer échoué (fr), fallback ElevenLabs:', e1.message);
            // Tentative 2 : ElevenLabs multilingue
            try {
                ttsBuffer = await ttsElevenLabs(voiceText);
            } catch (e2) {
                console.error('[TTS] ElevenLabs aussi échoué, dernier recours texte:', e2.message);
                await sendWhatsAppText(to, text);
                return null;
            }
        }
    }

    // Envoi audio
    try {
        const uploaded = await uploadAudio(ttsBuffer, 'chatbot_audio');
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: uploaded.secure_url } },
            { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log(`[TTS] Réponse audio envoyée à ${to} (${lang})`);
        return uploaded;
    } catch (sendErr) {
        console.error('[TTS] Échec upload/envoi audio, dernier recours texte:', sendErr.message);
        await sendWhatsAppText(to, text);
        return null;
    }
}

/**
 * Envoie un message d'erreur TOUJOURS en audio — jamais en texte.
 * Priorité :
 *   1. URL pré-générée au démarrage (Cloudinary) — instantané
 *   2. Génération TTS en live — si pré-génération indisponible
 * Le texte en fallback est supprimé : un analphabète ne peut pas le lire.
 */
async function sendErrorAudio(to, errorKey, lang = 'ha') {
    const preloadedUrl = getErrorAudioUrl(errorKey);

    if (preloadedUrl) {
        // Jouer l'audio pré-généré directement
        try {
            await axios.post(
                `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
                { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: preloadedUrl } },
                { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
            );
            console.log(`[ERROR AUDIO] Pré-généré envoyé (${errorKey})`);
            return;
        } catch (e) {
            console.warn('[ERROR AUDIO] Échec envoi pré-généré, tentative TTS live:', e.message);
        }
    }

    // TTS en live — sans jamais tomber sur du texte
    const text = ERROR_TEXTS[errorKey] ?? ERROR_TEXTS[`quality_${lang}`];
    try {
        const buffer = await generateTTS(prepareVoiceText(text), lang);
        const uploaded = await uploadAudio(buffer, 'error_audio');
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: uploaded.secure_url } },
            { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log(`[ERROR AUDIO] TTS live envoyé (${errorKey})`);
    } catch (ttsErr) {
        // Dernier recours : ElevenLabs
        try {
            const buffer = await ttsElevenLabs(prepareVoiceText(text));
            const uploaded = await uploadAudio(buffer, 'error_audio');
            await axios.post(
                `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
                { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: uploaded.secure_url } },
                { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
            );
            console.log(`[ERROR AUDIO] ElevenLabs live envoyé (${errorKey})`);
        } catch (finalErr) {
            console.error('[ERROR AUDIO] Impossible d\'envoyer l\'audio d\'erreur:', finalErr.message);
            // On n'envoie RIEN plutôt que du texte illisible pour un analphabète
        }
    }
}

async function getRecentMessages(conversationId, limit = 12) {
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

// GPT retourne un JSON {lang, reply} — une seule requête pour détecter ET répondre.
// Si un hint de langue est fourni (détection dictionnaire), il est injecté dans le contenu.
const TEXT_LANG_DETECT_INSTRUCTION = `

═══════════════════════════════════════════
INSTRUCTION DE RÉPONSE — FORMAT OBLIGATOIRE
═══════════════════════════════════════════

Tu dois TOUJOURS répondre avec un objet JSON valide, sans aucun texte autour :
{"lang":"fr","reply":"ta réponse ici"}

Règles de détection de langue :
- Message en français (quelle que soit l'orthographe ou les fautes) → lang="fr", reply en français, maximum 4 phrases
- Message en Hausa (quelle que soit l'orthographe ou les fautes) → lang="ha", reply en Hausa pur, zéro mot français, 2-3 phrases orales courtes
- Autre langue ou message totalement incompréhensible → lang="unknown", reply=""

RÈGLE CALENDRIER VACCINAL (s'applique dans LES DEUX LANGUES) :
Si l'utilisateur mentionne des vaccins déjà reçus, tu DOIS indiquer la prochaine étape du calendrier PEV Niger avec le nom exact des vaccins et le délai. Ne dis pas juste "allez au CSI". Dis exactement quels vaccins viennent ensuite et à quel moment.
- En Hausa : Nomme les vaccins en Hausa ET entre parenthèses le nom médical si nécessaire.
- En français : Donne les noms exacts des vaccins comme dans le calendrier.

Exemples :
{"lang":"fr","reply":"La rougeole se prévient par deux doses de vaccin..."}
{"lang":"ha","reply":"Doussa allurar rigakafi biyu ne..."}
{"lang":"ha","reply":"Watan mai zuwa, jaririnka zai karbi Pentavalent 1, VPO1, Pneumocoque 1 da Rotavirus 1. Waɗannan alluran suna kare daga cututtuka biyar, gudawa mai tsanani, da ciwon huhu. Ka je cibiyar lafiya lokacin da jariri ya kai mako shida."}
{"lang":"unknown","reply":""}`;

async function processText(userText, userPhone) {
    console.log(`[TEXT] Message reçu: "${userText}"`);

    // Vérification blocage — contact bloqué = silence total (pas de réponse)
    const contactCheck = await Contact.findOne({ whatsappId: userPhone });
    if (contactCheck?.bloque) {
        console.log(`[BLOCKED] ${userPhone} — message texte ignoré (contact bloqué)`);
        return;
    }

    if (isGreeting(userText)) {
        const firstTime = await isFirstConversation(userPhone);
        if (firstTime) {
            console.log('[TEXT] Première salutation → bienvenue');
            await getOrCreateContact(userPhone);
            await sendGreetingResponse(userPhone);
            return;
        }
        console.log('[TEXT] Salutation mais contact existant → traitement normal');
    }

    const contact = await getOrCreateContact(userPhone);
    const conv    = await getOrCreateConversation(contact._id);

    // Mode humain → enregistre sans réponse IA (détection légère suffisante ici)
    if (conv.statut === 'escalade_humain') {
        console.log(`[TEXT] Mode humain — message stocké sans réponse IA`);
        const lang = detectTextLanguage(userText);
        await Message.create({
            conversationId: conv._id,
            emetteurType:   'humain',
            typeContenu:    'text',
            texteBrut:      userText,
            langue:         lang === 'unknown' ? 'unknown' : lang,
        });
        conv.nbMessages += 1;
        conv.derniereMiseAJour = new Date();
        await conv.save();
        return;
    }

    // Pré-détection rapide par dictionnaire (HAUSA_WORDS / HAUSA_PHRASES)
    // Si des mots Hausa sont trouvés → on confirme à GPT que c'est du Hausa
    const dictLang = detectTextLanguage(userText);
    const hausaHint = dictLang === 'ha'
        ? `[IMPORTANT: Ce message contient des mots Hausa identifiés — réponds OBLIGATOIREMENT en Hausa pur, lang="ha"] `
        : '';
    console.log(`[TEXT] Pré-détection dictionnaire: ${dictLang}`);

    // Historique conversationnel complet (12 derniers messages)
    const history = await getRecentMessages(conv._id);

    // GPT détecte la langue ET génère la réponse en une seule requête JSON
    const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: SYSTEM_PROMPT + TEXT_LANG_DETECT_INSTRUCTION },
            ...history,
            { role: 'user', content: hausaHint + userText }
        ]
    });

    let lang  = 'unknown';
    let reply = '';
    try {
        const parsed = JSON.parse(gptResponse.choices[0].message.content);
        lang  = ['fr', 'ha'].includes(parsed.lang) ? parsed.lang : 'unknown';
        reply = (parsed.reply ?? '').trim();
    } catch (parseErr) {
        console.error('[TEXT] Échec parsing JSON GPT:', parseErr.message);
    }

    // Si dictionnaire a détecté Hausa mais GPT ne l'a pas confirmé → on force Hausa
    if (dictLang === 'ha' && lang !== 'ha') {
        console.log(`[TEXT] Forçage Hausa (dictionnaire=ha, GPT=${lang})`);
        lang = 'ha';
    }

    console.log(`[TEXT] Langue finale: ${lang} | Réponse: ${reply}`);

    if (lang === 'unknown' || !reply) {
        const errorMsg = ERROR_TEXTS.quality_ha;
        await sendErrorAudio(userPhone, 'quality_ha');
        // Sauvegarde quand même : le message humain + la réponse d'erreur doivent
        // apparaître dans le fil de discussion (langue inconnue visible par l'opérateur)
        try {
            await saveMessages(contact._id, 'unknown', { humanText: userText, aiText: errorMsg });
        } catch (dbErr) {
            console.error('[DB] Erreur persistance message inconnu:', dbErr.message);
        }
        return;
    }

    // Hausa → réponse audio (meilleure expérience pour locuteurs Hausa)
    // Français → réponse texte
    if (lang === 'ha') {
        await sendAudioReply(userPhone, reply, 'ha');
    } else {
        await sendWhatsAppText(userPhone, reply);
    }

    try {
        await saveMessages(contact._id, lang, { humanText: userText, aiText: reply });
    } catch (dbErr) {
        console.error('[DB] Erreur persistance text:', dbErr.message);
    }
}

// ─── Traitement audio ────────────────────────────────────────

async function processAudio(mediaId, userPhone) {
    const metaHeaders = { Authorization: `Bearer ${process.env.META_TOKEN}` };
    console.log('[1/6] Téléchargement audio, mediaId:', mediaId);

    // Vérification blocage
    const contactCheck = await Contact.findOne({ whatsappId: userPhone });
    if (contactCheck?.bloque) {
        console.log(`[BLOCKED] ${userPhone} — message audio ignoré (contact bloqué)`);
        return;
    }

    // Récupérer le contact et la conversation pour vérifier le mode
    const contact = await getOrCreateContact(userPhone);
    const knownLang = contact.langue === 'hausa' ? 'ha' : contact.langue === 'fr' ? 'fr' : null;
    const convCheck = await getOrCreateConversation(contact._id);

    // Mode humain → enregistre sans réponse IA
    if (convCheck.statut === 'escalade_humain') {
        console.log(`[AUDIO] Mode humain — message audio reçu mais non traité par IA`);
        await Message.create({
            conversationId: convCheck._id,
            emetteurType:   'humain',
            typeContenu:    'audio',
            texteBrut:      '[Audio reçu en mode humain]',
            langue:         knownLang ?? 'unknown',
        });
        convCheck.nbMessages += 1;
        convCheck.derniereMiseAJour = new Date();
        await convCheck.save();
        return;
    }

    const mediaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: metaHeaders });
    const audioRes = await axios.get(mediaRes.data.url, { headers: metaHeaders, responseType: 'arraybuffer' });

    const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputFile = `input_${tmpId}.ogg`;

    const audioBuffer = Buffer.from(audioRes.data);
    fs.writeFileSync(inputFile, audioBuffer);
    console.log('[2/6] Audio téléchargé:', audioBuffer.byteLength, 'bytes');

    // Upload de l'audio utilisateur sur Cloudinary pour l'affichage dans le dashboard
    let humanAudioUrl = '';
    try {
        const humanUpload = await uploadAudio(audioBuffer, 'user_audio');
        humanAudioUrl = humanUpload.secure_url;
        console.log('[2/6] Audio utilisateur uploadé:', humanAudioUrl);
    } catch (uploadErr) {
        console.warn('[2/6] Upload audio utilisateur échoué (non bloquant):', uploadErr.message);
    }

    // ══════════════════════════════════════════════════════════════
    // TRANSCRIPTION — 2 passes
    //
    // PASS 1 : Détection de langue — Whisper neutre (aucun hint, aucun prompt).
    //          Whisper retourne transcription.language ('french', 'arabic', 'swahili'…)
    //          C'est ici qu'on décide : est-ce du FR ou du Hausa ?
    //
    // PASS 2 : Transcription ciblée — on relance avec les bons paramètres selon la langue.
    //          FR → language:'fr' + prompt médical FR
    //          Hausa → ElevenLabs STT (natif) ou Whisper + prompt Hausa
    // ══════════════════════════════════════════════════════════════

    const WHISPER_HAUSA_LANGS = new Set([
        'arabic', 'persian', 'ukrainian', 'russian', 'polish', 'turkish',
        'azerbaijani', 'kazakh', 'uzbek', 'tajik', 'amharic', 'somali',
        'swahili', 'yoruba', 'igbo', 'zulu', 'hausa',
    ]);

    const FR_WHISPER_PROMPT =
        'Qu\'est-ce que la rougeole ? La rougeole est une maladie évitable par le vaccin. ' +
        'La vaccination protège les enfants contre la poliomyélite, la coqueluche, le tétanos, ' +
        'la diphtérie, l\'hépatite B, la méningite et la fièvre jaune. ' +
        'Le centre de santé propose des vaccins gratuits pour les nourrissons. ' +
        'Quels sont les effets secondaires du vaccin ? Où puis-je me faire vacciner au Niger ?';

    let transcription;

    // ══════════════════════════════════════════════════════════════
    // STRATÉGIE DE TRANSCRIPTION
    //
    // Si knownLang est connu → on saute la détection et on transcrit directement.
    //   FR  → Whisper forcé FR (excellent)
    //   HA  → ElevenLabs STT d'abord (supporte Hausa nativement),
    //          Whisper + prompt Hausa en fallback
    //
    // Si langue inconnue → Pass 1 Whisper neutre pour détecter, puis Pass 2 ciblé.
    // ══════════════════════════════════════════════════════════════

    // Pass 1 toujours exécuté — source de vérité pour la langue de CET audio.
    // knownLang (DB) n'est plus utilisé comme court-circuit : un utilisateur peut
    // parler français après avoir envoyé du Hausa, et vice-versa.
    let detectedLang = null;

    // ── PASS 1 : détection systématique ─────────────────────────
    try {
        const detect = await openai.audio.transcriptions.create({
            file: fs.createReadStream(inputFile),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
        });
        const wLang = detect.language?.toLowerCase() ?? '';

        if (wLang === 'french') {
            detectedLang = 'fr';
        } else {
            // Hausa, alias africain, script arabe → tout ça c'est du Hausa
            detectedLang = 'ha';
        }
        console.log(`[3a/6] Détection langue — Whisper: "${wLang}" | → ${detectedLang}`);
    } catch (detectErr) {
        // Fallback sur knownLang si disponible, sinon Hausa
        detectedLang = knownLang ?? 'ha';
        console.warn('[3a/6] Détection échouée, fallback:', detectedLang, detectErr.message);
    }

    // ── PASS 2 : transcription ciblée selon la langue ───────────
    try {
        if (detectedLang === 'fr') {
            transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(inputFile),
                model: 'whisper-1',
                response_format: 'verbose_json',
                timestamp_granularities: ['segment'],
                language: 'fr',
                prompt: FR_WHISPER_PROMPT,
            });
            console.log('[3b/6] Whisper FR | Texte:', transcription.text.slice(0, 80));
        } else {
            // Hausa → ElevenLabs STT en priorité absolue (supporte hau nativement)
            try {
                transcription = await sttElevenLabs(inputFile, 'hau');
                console.log('[3b/6] ElevenLabs STT Hausa | Texte:', transcription.text.slice(0, 80));
            } catch (elErr) {
                console.warn('[3b/6] ElevenLabs STT échoué, fallback Whisper + prompt Hausa:', elErr.message);
                transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(inputFile),
                    model: 'whisper-1',
                    response_format: 'verbose_json',
                    timestamp_granularities: ['segment'],
                    prompt: getHausaWhisperPrompt(),
                });
                console.log('[3b/6] Whisper Hausa fallback | Texte:', transcription.text.slice(0, 80));
                // Script arabe résiduel après Whisper → GPT ne peut pas l'exploiter
                if (/[\u0600-\u06FF]/.test(transcription.text)) {
                    console.log('[3b/6] Script arabe résiduel après tous les STT — audio répétition');
                    fs.unlink(inputFile, () => {});
                    await sendErrorAudio(userPhone, 'repeat_ha');
                    try {
                        await saveMessages(contact._id, 'ha', {
                            humanText: '[Audio Hausa — transcription échouée]',
                            aiText: ERROR_TEXTS.repeat_ha,
                            humanAudioUrl,
                        });
                    } catch { /* non bloquant */ }
                    return;
                }
            }
        }
    } catch (err) {
        console.warn('[3b/6] Transcription ciblée échouée, fallback FR:', err.message);
        transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(inputFile),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
            language: 'fr',
        });
        detectedLang = 'fr';
    }

    console.log(`[3/6] Transcription finale | lang: ${detectedLang} | "${transcription.text.slice(0, 60)}"`);

    // isLikelyHausa basé sur detectedLang (Pass 1) — fiable même si Whisper retourne 'swahili'
    const isLikelyHausa = detectedLang === 'ha';
    const quality = checkAudioQuality(transcription, isLikelyHausa);
    if (!quality.ok) {
        console.log('[AUDIO] Qualité insuffisante:', quality.reason);
        fs.unlink(inputFile, () => {});
        const errKey = quality.reason.includes('bruité') || quality.reason.includes('silencieux')
            ? 'quality_ha' : 'unclear_ha';
        await sendErrorAudio(userPhone, errKey);
        try {
            await saveMessages(contact._id, 'unknown', {
                humanText: transcription.text || '[Audio non transcrit]',
                aiText: ERROR_TEXTS[errKey],
                humanAudioUrl,
            });
        } catch (dbErr) {
            console.error('[DB] Erreur persistance audio qualité:', dbErr.message);
        }
        return;
    }

    // Salutation ?
    if (isGreeting(transcription.text)) {
        const firstTime = await isFirstConversation(userPhone);
        if (firstTime) {
            console.log('[AUDIO] Première salutation → bienvenue');
            fs.unlink(inputFile, () => {});
            await sendGreetingResponse(userPhone);
            return;
        }
        console.log('[AUDIO] Salutation mais contact existant → traitement normal');
    }

    // La langue est celle détectée au Pass 1 (source de vérité).
    // knownLang est ignoré — on se fie à ce que l'utilisateur parle MAINTENANT.
    const finalLang = detectedLang;

    if (knownLang && knownLang !== finalLang) {
        // L'utilisateur a changé de langue → mise à jour du contact en DB
        contact.langue = finalLang === 'ha' ? 'hausa' : 'fr';
        await contact.save();
        console.log(`[CONTACT] Changement de langue: ${knownLang} → ${finalLang}`);
    } else if (!knownLang) {
        contact.langue = finalLang === 'ha' ? 'hausa' : 'fr';
        await contact.save();
        console.log(`[CONTACT] Langue mémorisée: ${contact.langue}`);
    }
    console.log(`[AUDIO] Langue finale: ${finalLang} | Contact DB: ${knownLang}`);

    // Contexte conversationnel (6 derniers échanges)
    const conv = await getOrCreateConversation(contact._id);
    const history = await getRecentMessages(conv._id);

    const userContent = transcription.text;

    // La langue est définitivement fixée — GPT ne peut pas la changer.
    // audioLang est figé à finalLang pour toute la suite du traitement.
    const audioLang = finalLang;

    const AUDIO_REPLY_INSTRUCTION = finalLang === 'fr'
        ? `

═══════════════════════════════════════════
INSTRUCTION AUDIO — FRANÇAIS OBLIGATOIRE
═══════════════════════════════════════════

Réponds UNIQUEMENT en français. Langue de réponse : FRANÇAIS.
Retourne un objet JSON valide :
{"reply":"ta réponse en français ici"}

RÈGLES ABSOLUES :
- Réponse en français uniquement — zéro mot Hausa, zéro autre langue
- 2 à 3 phrases courtes, style oral (sera lu à voix haute)
- Pas de symboles, pas de listes, pas d'astérisques
- INTERDIT : ne jamais dire "je ne comprends pas" ou "quelle langue" — si la transcription est imparfaite, déduis le sens du contexte santé/vaccination et réponds toujours en français`
        : `

═══════════════════════════════════════════
INSTRUCTION AUDIO — HAUSA WAJIBI NE
═══════════════════════════════════════════

Ka amsa DA HAUSA KAWAI. Harshen amsa : HAUSA.
Ka mayar da JSON mai inganci :
{"reply":"amsar ka da Hausa a nan"}

DOKOKI MASU WAJIBI :
- Amsa da Hausa kawai — babu Faransanci, babu wata harshe
- Jumla 2 zuwa 3 na gajere, salon magana (za a karanta da murya)
- Babu alamu, babu jerin abubuwa, babu tauraro
- HARAMUN : kada ka ce "ban fahimci" ko "wace harshe" — idan rubutun ba cikakke ba ne, yi amfani da mahallin lafiya/rigakafi ka amsa da Hausa kullum`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: SYSTEM_PROMPT + AUDIO_REPLY_INSTRUCTION },
            ...history,
            { role: 'user', content: userContent }
        ]
    });

    let replyText = '';
    try {
        const parsed = JSON.parse(response.choices[0].message.content);
        // On utilise parsed.reply — on ignore parsed.lang si présent (langue fixée)
        replyText = (parsed.reply ?? '').trim();
    } catch (parseErr) {
        console.error('[AUDIO] Échec parsing JSON GPT:', parseErr.message);
        replyText = response.choices[0].message.content;
    }
    console.log(`[4/6] Réponse GPT (${audioLang}): ${replyText}`);

    // Message entrant = audio → réponse TOUJOURS en audio (sendAudioReply gère le TTS
    // et ne tombe en fallback texte qu'en dernier recours si le TTS est indisponible).
    console.log(`[5-6/6] Envoi réponse audio (${audioLang})…`);
    const uploadResult = await sendAudioReply(userPhone, replyText, audioLang);

    fs.unlink(inputFile, () => {});

    try {
        await saveMessages(contact._id, audioLang, {
            humanText: transcription.text,
            aiText: replyText,
            humanAudioUrl,
            audioUrl: uploadResult?.secure_url ?? '',
            cloudinaryId: uploadResult?.public_id ?? ''
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

    // Vérification blocage
    const contactCheck = await Contact.findOne({ whatsappId: userPhone });
    if (contactCheck?.bloque) {
        console.log(`[BLOCKED] ${userPhone} — localisation ignorée (contact bloqué)`);
        return;
    }

    // Mode humain → enregistre la position sans réponse IA
    const contactLoc = await getOrCreateContact(userPhone);
    const convLoc    = await getOrCreateConversation(contactLoc._id);
    if (convLoc.statut === 'escalade_humain') {
        console.log(`[LOC] Mode humain — position stockée sans réponse IA`);
        await Message.create({
            conversationId: convLoc._id,
            emetteurType:   'humain',
            typeContenu:    'location',
            texteBrut:      `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees:    { latitude: lat, longitude: lng },
            langue:         'unknown',
        });
        contactLoc.dernierePosition = { latitude: lat, longitude: lng, updatedAt: new Date() };
        await contactLoc.save();
        convLoc.nbMessages += 1;
        convLoc.derniereMiseAJour = new Date();
        await convLoc.save();
        return;
    }

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

    // Persistance — réutilise contactLoc/convLoc déjà récupérés plus haut
    try {
        contactLoc.dernierePosition = { latitude: lat, longitude: lng, updatedAt: new Date() };
        await contactLoc.save();

        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'humain',
            typeContenu: 'location',
            texteBrut: `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees: { latitude: lat, longitude: lng },
            langue: 'unknown'
        });
        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'agent_ia',
            typeContenu: 'text',
            texteBrut: message,
            langue: 'fr'
        });
        convLoc.nbMessages += 2;
        convLoc.derniereMiseAJour = new Date();
        await convLoc.save();
        console.log(`[DB] Position sauvegardée pour ${userPhone}: lat=${lat}, lng=${lng}`);
    } catch (dbErr) {
        console.error('[DB] Erreur persistance localisation:', dbErr.message);
    }
}

export default router;
