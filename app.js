const express = require('express');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuration des clients API
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_KEY });

const VERIFY_TOKEN = "MON_SECRET_NIGER_2024";

// 1. Validation du Webhook Meta
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Réception et traitement du message
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;

            if (message.type === 'audio') {
                await processAudioVaccination(message.audio.id, from);
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("Erreur Webhook:", error);
        res.sendStatus(500);
    }
});

async function processAudioVaccination(mediaId, userPhone) {
    const metaHeaders = { Authorization: `Bearer ${process.env.META_TOKEN}` };

    // A. Récupérer l'URL et télécharger l'audio (.ogg)
    const mediaRes = await axios.get(`https://facebook.com{mediaId}`, { headers: metaHeaders });
    const audioRes = await axios.get(mediaRes.data.url, { headers: metaHeaders, responseType: 'arraybuffer' });
    fs.writeFileSync('input.ogg', Buffer.from(audioRes.data));

    // B. Transcription (Whisper) en Haoussa
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream('input.ogg'),
        model: "whisper-1",
        language: "ha"
    });

    // C. Analyse Claude 3.5 Sonnet
    const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 300,
        system: "Ke ma'aikaciyar lafiya ce a Nijar. Ba da amsa cikin harshen Hausa game da rigakafi. Yi amfani da kalmomi masu dadi.",
        messages: [{ role: "user", content: transcription.text }]
    });
    const hausaReply = response.content[0].text;

    // D. Synthèse Vocale (ElevenLabs V3 - Voix naturelle)
    const ttsResponse = await axios.post(
        `https://elevenlabs.io{process.env.VOICE_ID}`,
        {
            text: `[warm] ${hausaReply}`,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.4, similarity_boost: 0.8 }
        },
        { headers: { "xi-api-key": process.env.ELEVEN_KEY } }
    );

    // E. Envoi via WhatsApp (Note: nécessite un stockage S3/Cloudinary pour l'URL finale)
    console.log(`Réponse Haoussa : ${hausaReply}`);
    // Ici, vous uploaderiez l'audio et utiliseriez axios.post pour envoyer le message final à Meta.
}

const PORT = process.env.PORT || 40000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
