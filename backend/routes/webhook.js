import express from 'express';
import axios from 'axios';
import fs from 'fs';
import OpenAI from 'openai';
import SYSTEM_PROMPT from '../prompt.js';
import { VERIFY_TOKEN, GREETING_CONFIG } from '../constants/config.js';
import { getHausaWords, getHausaPhrases, getHausaWhisperPrompt } from '../lib/hausaVocab.js';
import Contact from '../db/models/Contact.js';
import Conversation from '../db/models/Conversations.js';
import Message from '../db/models/Message.js';
import Structure from '../db/models/Structure.js';
import BroadcastMessage from '../db/models/BroadcastMessage.js';
import Broadcast from '../db/models/Broadcast.js';
import { generateTTS, ttsOpenAI, ttsElevenLabs, sttElevenLabs, prepareVoiceText, uploadAudio, preprocessAudio } from '../lib/audio.js';
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

    // 3. Dictionnaire Hausa — score de proportion (pas de jugement sur un seul mot)
    const words = normalized.split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length >= 2);
    if (words.length === 0) return 'fr';

    const hausaCount = words.filter(w => getHausaWords().has(w)).length;
    const ratio = hausaCount / words.length;

    // Seuil : au moins 2 mots Hausa ET 30% des mots de la phrase
    const isHausa = hausaCount >= 2 && ratio >= 0.30;

    console.log(`[LANG] Dictionnaire — HA: ${hausaCount}/${words.length} mots (${Math.round(ratio * 100)}%) → ${isHausa ? 'ha' : 'fr'}`);

    return isHausa ? 'ha' : 'fr';
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

    // Contrôle qualité ElevenLabs : pas de segments Whisper, mais on a confidence + wordCount
    if (segments.length === 0) {
        if (transcription._source === 'elevenlabs') {
            const wordCount = transcription._wordCount ?? 0;
            const conf      = transcription._avgConfidence;
            if (wordCount < 2) {
                return { ok: false, reason: 'Audio trop court ou aucune parole détectée. / Murya ba ta bayyana ba.' };
            }
            if (conf !== null && conf < 0.35) {
                return { ok: false, reason: 'Audio peu clair, veuillez réessayer. / Murya ba ta fito sosai.' };
            }
        }
        return { ok: true };
    }

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

async function getOrCreateContact(whatsappId, phoneNumberId = null) {
    let contact = await Contact.findOne({ whatsappId });
    if (!contact) {
        contact = await Contact.create({ whatsappId, source: 'webhook', phoneNumberId });
    } else if (phoneNumberId && !contact.phoneNumberId) {
        contact.phoneNumberId = phoneNumberId;
        await contact.save();
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

// async function isFirstConversation(userPhone) {
//     const contact = await Contact.findOne({ whatsappId: userPhone });
//     if (!contact) return true;
//     const convCount = await Conversation.countDocuments({ contactId: contact._id });
//     return convCount === 0;
// }

async function saveMessages(contactId, langue, { humanText, aiText, humanAudioUrl = '', audioUrl = '', cloudinaryId = '', aiIsAudio = false }) {
    const conv = await getOrCreateConversation(contactId);

    const humanIsAudio = !!humanAudioUrl;
    const agentIsAudio = aiIsAudio || !!audioUrl;

    await Message.create({
        conversationId: conv._id,
        emetteurType: 'humain',
        typeContenu: humanIsAudio ? 'audio' : 'text',
        texteBrut: humanText,
        audioUrl: humanAudioUrl,
        langue
    });

    await Message.create({
        conversationId: conv._id,
        emetteurType: 'agent_ia',
        typeContenu: agentIsAudio ? 'audio' : 'text',
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

    const message     = value.messages[0];
    const from        = message.from;
    const phoneNumId  = value.metadata?.phone_number_id ?? null;
    console.log(`Message de ${from}, type: ${message.type}`);

    if (message.type === 'audio') {
        processAudio(message.audio.id, from, phoneNumId).catch(err =>
            console.error("Erreur traitement audio:", err.message)
        );
    } else if (message.type === 'text') {
        processText(message.text.body, from, phoneNumId).catch(err =>
            console.error("Erreur traitement texte:", err.message)
        );
    } else if (message.type === 'location') {
        processLocation(message.location.latitude, message.location.longitude, from, phoneNumId).catch(err =>
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

// Mots-clés indiquant que l'utilisateur cherche un centre de santé proche
const NEARBY_CENTER_KEYWORDS = [
    // Français
    'csi', 'centre', 'santé', 'sante', 'sanitaire',
    'vaccination', 'vaccin', 'vacciner', 'vaccins',
    'proche', 'prox', 'plus proche', 'trouver',
    'où vacciner', 'où se vacciner', 'adresse',
    // Hausa
    'kusa', 'cibiyar', 'rigakafi', 'lafiya',
];

/**
 * Retourne true si le texte indique que l'utilisateur cherche un centre de santé.
 */
function wantsNearbyCenter(text) {
    const lower = text.toLowerCase();
    return NEARBY_CENTER_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Retourne true si le contact a une position GPS récente (moins de 30 jours).
 */
function isPositionFresh(contact) {
    const pos = contact.dernierePosition;
    if (!pos?.latitude || !pos?.longitude || !pos?.updatedAt) return false;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return new Date(pos.updatedAt) > thirtyDaysAgo;
}

// Cooldown anti-spam : évite de redemander la position plus d'une fois par heure
const locationOfferedAt = new Map(); // phone → timestamp

function canOfferLocation(userPhone) {
    const last = locationOfferedAt.get(userPhone);
    return !last || Date.now() - last > 3_600_000; // 1h
}

function markLocationOffered(userPhone) {
    locationOfferedAt.set(userPhone, Date.now());
}

/**
 * Envoie d'abord un message audio en Hausa expliquant ce qu'il faut faire,
 * puis le bouton natif WhatsApp "Envoyer ma position".
 * Conçu pour des utilisateurs analphabètes qui ne lisent pas le texte.
 * lang : 'ha' (défaut) ou 'fr'
 */
async function sendLocationRequest(userPhone, lang = 'ha') {
    // Audio explicatif AVANT le bouton (pour les analphabètes)
    const introText = lang === 'fr'
        ? 'Pour trouver le centre de vaccination le plus proche de chez vous, appuyez sur le bouton ci-dessous pour partager votre position.'
        : 'Don nemo cibiyar rigakafi mafi kusa da kai, danna maballin da ke kasa don raba wurin ka.';

    await sendAudioReply(userPhone, introText, lang).catch(e =>
        console.warn('[LOC-REQ] Audio intro échoué (non bloquant):', e.message)
    );

    // Bouton natif WhatsApp de partage de position
    try {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: userPhone,
                type: 'interactive',
                interactive: {
                    type: 'location_request_message',
                    body: { text: '📍' },
                    action: { name: 'send_location' },
                },
            },
            { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        markLocationOffered(userPhone);
        console.log(`[LOC-REQ] Demande de localisation (${lang}) envoyée à ${userPhone}`);
    } catch (err) {
        console.warn(`[LOC-REQ] Échec bouton location à ${userPhone}:`, err.response?.data?.error?.message ?? err.message);
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
    const voiceText = prepareVoiceText(text, lang);

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

async function processText(userText, userPhone, phoneNumId = null) {
    console.log(`[TEXT] Message reçu: "${userText}"`);

    const contact = await getOrCreateContact(userPhone, phoneNumId);

    // Vérification blocage — contact bloqué = silence total (pas de réponse)
    if (contact.bloque) {
        console.log(`[BLOCKED] ${userPhone} — message texte ignoré (contact bloqué)`);
        return;
    }
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

    // Si GPT retourne unknown → on utilise le dictionnaire comme source de vérité
    // Le dictionnaire retourne toujours 'fr' ou 'ha', jamais unknown
    if (lang === 'unknown') {
        console.log(`[TEXT] GPT=unknown, fallback dictionnaire → ${dictLang}`);
        lang = dictLang; // 'fr' ou 'ha'
    }
    // Si dictionnaire a détecté Hausa mais GPT dit autre chose → on force Hausa
    if (dictLang === 'ha' && lang !== 'ha') {
        console.log(`[TEXT] Forçage Hausa (dictionnaire=ha, GPT=${lang})`);
        lang = 'ha';
    }

    console.log(`[TEXT] Langue finale: ${lang} | Réponse: ${reply}`);

    // Persistance de la langue détectée — même valeur que processAudio ('ha' ou 'fr')
    if (lang !== 'unknown') {
        const dbLang = lang === 'ha' ? 'ha' : 'fr';
        if (contact.langue !== dbLang) {
            contact.langue = dbLang;
            await contact.save();
            console.log(`[CONTACT] Langue texte mémorisée: ${dbLang}`);
        }
    }

    // Si reply vide : relance GPT en forçant la langue détectée
    if (!reply) {
        console.log(`[TEXT] reply vide → relance GPT avec langue forcée: ${lang}`);
        const forceLangHint = lang === 'ha'
            ? `[FORCE: réponds OBLIGATOIREMENT en Hausa, lang="ha"] `
            : `[FORCE: réponds OBLIGATOIREMENT en français, lang="fr"] `;
        try {
            const retryResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                max_tokens: 250,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT + TEXT_LANG_DETECT_INSTRUCTION },
                    ...history,
                    { role: 'user', content: forceLangHint + userText }
                ]
            });
            const retryParsed = JSON.parse(retryResponse.choices[0].message.content);
            reply = (retryParsed.reply ?? '').trim();
            if (retryParsed.lang && ['fr', 'ha'].includes(retryParsed.lang)) lang = retryParsed.lang;
        } catch (retryErr) {
            console.error('[TEXT] Échec retry GPT:', retryErr.message);
        }
    }

    if (!reply) {
        const errKey = `quality_${lang === 'fr' ? 'fr' : 'ha'}`;
        const errorMsg = ERROR_TEXTS[errKey];
        await sendErrorAudio(userPhone, errKey);
        try {
            await saveMessages(contact._id, lang, { humanText: userText, aiText: errorMsg, aiIsAudio: true });
        } catch (dbErr) {
            console.error('[DB] Erreur persistance message inconnu:', dbErr.message);
        }
        return;
    }

    // Hausa → réponse audio (meilleure expérience pour locuteurs Hausa)
    // Français → réponse texte
    let aiAudioUpload = null;
    if (lang === 'ha') {
        aiAudioUpload = await sendAudioReply(userPhone, reply, 'ha');
    } else {
        await sendWhatsAppText(userPhone, reply);
    }

    try {
        await saveMessages(contact._id, lang, {
            humanText: userText,
            aiText: reply,
            audioUrl: aiAudioUpload?.secure_url ?? '',
            cloudinaryId: aiAudioUpload?.public_id ?? '',
        });
    } catch (dbErr) {
        console.error('[DB] Erreur persistance text:', dbErr.message);
    }

    // Détection contextuelle (texte) : si l'utilisateur OU la réponse IA mentionne un centre proche
    if ((wantsNearbyCenter(userText) || wantsNearbyCenter(reply)) && canOfferLocation(userPhone)) {
        const contactLangForLoc = lang === 'ha' ? 'ha' : 'fr';
        if (isPositionFresh(contact)) {
            console.log(`[TEXT] Centre mentionné (user/IA), position fraîche → centres proches envoyés directement`);
            await processLocation(contact.dernierePosition.latitude, contact.dernierePosition.longitude, userPhone);
        } else {
            console.log(`[TEXT] Centre mentionné (user/IA), position absente → demande géoloc (${contactLangForLoc})`);
            await sendLocationRequest(userPhone, contactLangForLoc);
        }
    }
}

// ─── Traitement audio ────────────────────────────────────────

async function processAudio(mediaId, userPhone, phoneNumId = null) {
    const metaHeaders = { Authorization: `Bearer ${process.env.META_TOKEN}` };
    console.log('[1/6] Téléchargement audio, mediaId:', mediaId);

    // Récupérer le contact (une seule requête DB — vérifie aussi le blocage)
    const contact = await getOrCreateContact(userPhone, phoneNumId);
    if (contact.bloque) {
        console.log(`[BLOCKED] ${userPhone} — message audio ignoré (contact bloqué)`);
        return;
    }

    const knownLang = contact.langue === 'ha' ? 'ha' : contact.langue === 'fr' ? 'fr' : null;
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

    let mediaRes, audioRes;
    try {
        mediaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: metaHeaders });
        audioRes = await axios.get(mediaRes.data.url, { headers: metaHeaders, responseType: 'arraybuffer' });
    } catch (dlErr) {
        console.error('[AUDIO] Téléchargement Meta échoué:', dlErr.response?.status, dlErr.message);
        await sendErrorAudio(userPhone, contact.langue === 'fr' ? 'quality_fr' : 'quality_ha');
        return;
    }

    const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputFile = `input_${tmpId}.ogg`;

    const audioBuffer = Buffer.from(audioRes.data);
    fs.writeFileSync(inputFile, audioBuffer);
    console.log('[2/6] Audio téléchargé:', audioBuffer.byteLength, 'bytes');

    // Prétraitement FFmpeg : OGG → WAV 16 kHz mono (optimal pour Whisper)
    let sttFile = inputFile;
    try {
        sttFile = await preprocessAudio(inputFile);
        console.log('[2b/6] Audio prétraité (WAV 16kHz mono):', sttFile);
    } catch (ffErr) {
        console.warn('[2b/6] Prétraitement FFmpeg échoué, audio brut utilisé:', ffErr.message);
        sttFile = inputFile;
    }

    // try/finally garantit la suppression du fichier temp même en cas d'exception
    try {
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

    const FR_WHISPER_PROMPT =
        'La vaccination protège les enfants contre la rougeole, la poliomyélite, la coqueluche, ' +
        'le tétanos, la diphtérie, l\'hépatite B, la méningite et la fièvre jaune. ' +
        'Le centre de santé intégré propose des vaccins gratuits pour les nourrissons et les femmes enceintes. ' +
        'Quels sont les effets secondaires du vaccin ? Où puis-je me faire vacciner au Niger ? ' +
        'Mon enfant a de la fièvre après le vaccin. Quel est le calendrier vaccinal ? ' +
        'Le BCG, le DTC, le VAT, le VAR, le VPO sont des vaccins essentiels. ' +
        'La malnutrition, le paludisme, la diarrhée, la pneumonie touchent les enfants. ' +
        'Consultation prénatale, accouchement assisté, allaitement maternel, planification familiale. ' +
        'Le district sanitaire, l\'agent de santé communautaire, la case de santé, le CSI.';

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
            file: fs.createReadStream(sttFile),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
            temperature: 0,
        });
        const wLang = detect.language?.toLowerCase() ?? '';

        if (wLang === 'french') {
            detectedLang = 'fr';
        } else {
            // Hausa, alias africain, script arabe → tout ça c'est du Hausa
            detectedLang = 'ha';
        }
        if (wLang !== 'french' && wLang !== 'hausa') {
            console.log(`[3a/6] Whisper: "${wLang}" (alias Hausa probable — Whisper confond Hausa avec ${wLang}) → ha`);
        } else {
            console.log(`[3a/6] Détection langue — Whisper: "${wLang}" | → ${detectedLang}`);
        }
    } catch (detectErr) {
        // Fallback sur knownLang si disponible, sinon Hausa
        detectedLang = knownLang ?? 'ha';
        console.warn('[3a/6] Détection échouée, fallback:', detectedLang, detectErr.message);
    }

    // ── PASS 2 : transcription ciblée selon la langue ───────────
    try {
        if (detectedLang === 'fr') {
            transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(sttFile),
                model: 'whisper-1',
                response_format: 'verbose_json',
                timestamp_granularities: ['segment'],
                language: 'fr',
                temperature: 0,
                prompt: FR_WHISPER_PROMPT,
            });
            console.log('[3b/6] Whisper FR | Texte:', transcription.text.slice(0, 80));
        } else {
            // Hausa → ElevenLabs STT en priorité absolue (supporte hau nativement)
            try {
                transcription = await sttElevenLabs(sttFile, 'hau');
                console.log('[3b/6] ElevenLabs STT Hausa | Texte:', transcription.text.slice(0, 80));
            } catch (elErr) {
                console.warn('[3b/6] ElevenLabs STT échoué, fallback Whisper + prompt Hausa:', elErr.message);
                transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(sttFile),
                    model: 'whisper-1',
                    response_format: 'verbose_json',
                    timestamp_granularities: ['segment'],
                    temperature: 0,
                    prompt: getHausaWhisperPrompt(),
                });
                console.log('[3b/6] Whisper Hausa fallback | Texte:', transcription.text.slice(0, 80));
                // Script arabe résiduel après Whisper → GPT ne peut pas l'exploiter
                if (/[\u0600-\u06FF]/.test(transcription.text)) {
                    console.log('[3b/6] Script arabe résiduel après tous les STT — audio répétition');
                    await sendErrorAudio(userPhone, 'repeat_ha');
                    try {
                        await saveMessages(contact._id, 'ha', {
                            humanText: '[Audio Hausa — transcription échouée]',
                            aiText: ERROR_TEXTS.repeat_ha,
                            humanAudioUrl,
                            aiIsAudio: true,
                        });
                    } catch { /* non bloquant */ }
                    return;
                }
            }
        }
    } catch (err) {
        console.warn('[3b/6] Transcription ciblée échouée, fallback FR:', err.message);
        transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(sttFile),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
            language: 'fr',
            temperature: 0,
        });
        detectedLang = 'fr';
    }

    // Guard : si tous les STT ont échoué, transcription reste undefined
    if (!transcription) {
        console.error('[AUDIO] Toutes les tentatives de transcription ont échoué');
        await sendErrorAudio(userPhone, contact.langue === 'fr' ? 'quality_fr' : 'quality_ha');
        return;
    }

    console.log(`[3/6] Transcription finale | lang: ${detectedLang} | "${transcription.text.slice(0, 60)}"`);

    // isLikelyHausa basé sur detectedLang (Pass 1) — fiable même si Whisper retourne 'swahili'
    const isLikelyHausa = detectedLang === 'ha';
    const quality = checkAudioQuality(transcription, isLikelyHausa);
    if (!quality.ok) {
        console.log('[AUDIO] Qualité insuffisante:', quality.reason);
        const langSuffix = detectedLang === 'fr' ? 'fr' : 'ha';
        const errKey = quality.reason.includes('bruité') || quality.reason.includes('silencieux')
            ? `quality_${langSuffix}` : `unclear_${langSuffix}`;
        await sendErrorAudio(userPhone, errKey);
        try {
            await saveMessages(contact._id, detectedLang === 'fr' ? 'fr' : detectedLang === 'ha' ? 'ha' : 'unknown', {
                humanText: transcription.text || '[Audio non transcrit]',
                aiText: ERROR_TEXTS[errKey],
                humanAudioUrl,
                aiIsAudio: true,
            });
        } catch (dbErr) {
            console.error('[DB] Erreur persistance audio qualité:', dbErr.message);
        }
        return;
    }

   

    // La langue est celle détectée au Pass 1 (source de vérité).
    // knownLang est ignoré — on se fie à ce que l'utilisateur parle MAINTENANT.
    const finalLang = detectedLang;

    if (knownLang && knownLang !== finalLang) {
        // L'utilisateur a changé de langue → mise à jour du contact en DB
        contact.langue = finalLang === 'ha' ? 'ha' : 'fr';
        await contact.save();
        console.log(`[CONTACT] Changement de langue: ${knownLang} → ${finalLang}`);
    } else if (!knownLang) {
        contact.langue = finalLang === 'ha' ? 'ha' : 'fr';
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
        model: 'gpt-4o',
        max_tokens: 300,
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

    // Demande géolocalisation uniquement si la réponse IA mentionne un centre de santé.
    // (évite le spam de localisation après chaque audio)
    if (wantsNearbyCenter(replyText) && canOfferLocation(userPhone)) {
        const contactLangForLoc = contact.langue === 'ha' ? 'ha' : 'fr';
        if (isPositionFresh(contact)) {
            console.log(`[AUDIO] Réponse IA → centre mentionné, position fraîche → centres proches envoyés directement`);
            await processLocation(contact.dernierePosition.latitude, contact.dernierePosition.longitude, userPhone);
        } else {
            console.log(`[AUDIO] Réponse IA → centre mentionné, position absente → demande géoloc (${contactLangForLoc})`);
            await sendLocationRequest(userPhone, contactLangForLoc);
        }
    }
    } finally {
        // Nettoyage garanti des fichiers temporaires, même en cas d'exception
        fs.unlink(inputFile, () => {});
        if (sttFile !== inputFile) fs.unlink(sttFile, () => {});
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

/**
 * Détecte le district et la région à partir de coordonnées GPS.
 * Cherche parmi TOUTES les structures (actives ou non) la plus proche
 * et en déduit la zone géographique du contact.
 *
 * @returns {{ district: ObjectId, region: ObjectId|null, districtNom: string, regionNom: string|null } | null}
 */
async function detectDistrictFromGPS(lat, lng) {
    const all = await Structure.find()
        .populate({ path: 'districtId', populate: { path: 'regionId' } })
        .lean();

    if (!all.length) return null;

    const sorted = all
        .filter(s => s.coordonnees?.latitude && s.coordonnees?.longitude)
        .map(s => ({ ...s, distance: haversine(lat, lng, s.coordonnees.latitude, s.coordonnees.longitude) }))
        .sort((a, b) => a.distance - b.distance);

    const closest = sorted[0];
    if (!closest?.districtId?._id) return null;

    return {
        district:    closest.districtId._id,
        region:      closest.districtId.regionId?._id ?? null,
        districtNom: closest.districtId.nom,
        regionNom:   closest.districtId.regionId?.nom ?? null,
    };
}

async function processLocation(lat, lng, userPhone, phoneNumId = null) {
    console.log(`[LOC] Position reçue de ${userPhone}: lat=${lat}, lng=${lng}`);

    const contactLoc = await getOrCreateContact(userPhone, phoneNumId);
    if (contactLoc.bloque) {
        console.log(`[BLOCKED] ${userPhone} — localisation ignorée (contact bloqué)`);
        return;
    }

    // ── Mise à jour contact : position + district + région (tous les cas) ──
    try {
        const zone = await detectDistrictFromGPS(lat, lng);
        contactLoc.dernierePosition = { latitude: lat, longitude: lng, updatedAt: new Date() };
        if (zone) {
            contactLoc.district = zone.district;
            if (zone.region) contactLoc.region = zone.region;
            console.log(`[LOC] Contact mis à jour → District: ${zone.districtNom}, Région: ${zone.regionNom ?? '—'}`);
        } else {
            console.warn('[LOC] Aucune structure en base — district/région non détectés');
        }
        await contactLoc.save();
    } catch (geoErr) {
        console.error('[LOC] Erreur détection zone géographique:', geoErr.message);
    }

    const convLoc = await getOrCreateConversation(contactLoc._id);

    // ── Mode humain : stocker le message, pas de réponse IA ──
    if (convLoc.statut === 'escalade_humain') {
        console.log(`[LOC] Mode humain — position et zone stockées`);
        await Message.create({
            conversationId: convLoc._id,
            emetteurType:   'humain',
            typeContenu:    'location',
            texteBrut:      `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees:    { latitude: lat, longitude: lng },
            langue:         'unknown',
        });
        convLoc.nbMessages += 1;
        convLoc.derniereMiseAJour = new Date();
        await convLoc.save();
        return;
    }

    // ── Recherche des structures actives les plus proches ──
    const structures = await Structure.find({ statutVaccination: true })
        .populate({ path: 'districtId', populate: { path: 'regionId' } })
        .lean();

    const contactLang = contactLoc.langue === 'ha' ? 'ha' : 'fr';

    if (!structures.length) {
        const noStructText = contactLang === 'ha'
            ? 'Ba a sami cibiyar rigakafi a yankin ka ba. Ka tuntubi ma\'aikatar lafiya ta gari.'
            : 'Aucune structure sanitaire trouvée près de vous. Contactez votre centre de santé local.';
        await sendAudioReply(userPhone, noStructText, contactLang);
        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'humain',
            typeContenu: 'location',
            texteBrut: `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees: { latitude: lat, longitude: lng },
            langue: 'unknown',
        });
        convLoc.nbMessages += 1;
        convLoc.derniereMiseAJour = new Date();
        await convLoc.save();
        return;
    }

    // Tri par distance — 3 plus proches
    const nearest = structures
        .filter(s => s.coordonnees?.latitude && s.coordonnees?.longitude)
        .map(s => ({ ...s, distance: haversine(lat, lng, s.coordonnees.latitude, s.coordonnees.longitude) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

    const audioLines = nearest.map((s, i) => {
        const km = s.distance.toFixed(1);
        return contactLang === 'ha'
            ? `Cibiya ta ${i + 1}: ${s.nom}, kilomita ${km} daga gare ka.`
            : `Centre ${i + 1} : ${s.nom}, à ${km} km de chez vous.`;
    });

    const audioText = contactLang === 'ha'
        ? `Cibiyoyin rigakafi mafi kusa da kai su ne: ${audioLines.join(' ')}`
        : `Les centres de vaccination les plus proches sont : ${audioLines.join(' ')}`;

    // Texte structuré avec emoji pour la lisibilité
    const textLines = nearest.map((s, i) => {
        const km = s.distance.toFixed(1);
        return contactLang === 'ha'
            ? `${i + 1}. ${s.nom} — ${km} km`
            : `${i + 1}. ${s.nom} — ${km} km`;
    });

    const textMessage = contactLang === 'ha'
        ? `📍 *Cibiyoyin rigakafi mafi kusa:*\n\n${textLines.join('\n')}`
        : `📍 *Centres de vaccination les plus proches :*\n\n${textLines.join('\n')}`;

    await sendAudioReply(userPhone, audioText, contactLang);
    await sendWhatsAppText(userPhone, textMessage);
    console.log(`[LOC] ${nearest.length} structures envoyées (audio + texte, ${contactLang}) à ${userPhone}`);

    // ── Persistance des messages ──
    try {
        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'humain',
            typeContenu: 'location',
            texteBrut: `[LOCALISATION] lat:${lat}, lng:${lng}`,
            coordonnees: { latitude: lat, longitude: lng },
            langue: 'unknown',
        });
        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'agent_ia',
            typeContenu: 'audio',
            texteBrut: audioText,
            langue: contactLang,
        });
        await Message.create({
            conversationId: convLoc._id,
            emetteurType: 'agent_ia',
            typeContenu: 'text',
            texteBrut: textMessage,
            langue: contactLang,
        });
        convLoc.nbMessages += 3;
        convLoc.derniereMiseAJour = new Date();
        await convLoc.save();
        console.log(`[DB] Position + zone sauvegardées pour ${userPhone}`);
    } catch (dbErr) {
        console.error('[DB] Erreur persistance localisation:', dbErr.message);
    }
}

export default router;
