const express = require('express');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const app = express();
app.use(express.json());
app.get('/', (req, res) => {
  const date = new Date();
  const formattedDate = date.toLocaleString();
  res.send(`<h1>La date et l'heure actuelles sont : ${formattedDate}</h1>`);
});
// Configuration des clients API
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });


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
app.post('/webhook', (req, res) => {
    // Répondre immédiatement à Meta (obligatoire < 20s)
    res.sendStatus(200);

    const body = req.body;
    console.log("Webhook reçu:", JSON.stringify(body));

    if (!body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return;

    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    console.log(`Message de ${from}, type: ${message.type}`);

    if (message.type === 'audio') {
        processAudioVaccination(message.audio.id, from).catch(err =>
            console.error("Erreur traitement audio:", err.message)
        );
    } else if (message.type === 'text') {
        sendWhatsAppText(from, "Ina jin saƙonku. Don Allah aiko da saƙon murya domin mu taimaka muku.").catch(err =>
            console.error("Erreur envoi texte:", err.message)
        );
    } else {
        console.log(`Type de message non géré: ${message.type}`);
    }
});

async function processAudioVaccination(mediaId, userPhone) {
    const metaHeaders = { Authorization: `Bearer ${process.env.META_TOKEN}` };
    console.log('[1/6] Téléchargement audio, mediaId:', mediaId);

    // A. Récupérer l'URL et télécharger l'audio (.ogg)
    const mediaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: metaHeaders });
    const audioRes = await axios.get(mediaRes.data.url, { headers: metaHeaders, responseType: 'arraybuffer' });
    fs.writeFileSync('input.ogg', Buffer.from(audioRes.data));
    console.log('[2/6] Audio téléchargé:', audioRes.data.byteLength, 'bytes');

    // B. Transcription (Whisper) en Haoussa
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream('input.ogg'),
        model: "whisper-1"
    });
    console.log('[3/6] Transcription:', transcription.text);

    // C. Analyse GPT-4o-mini
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
            { role: "system", content: "Ke ma'aikaciyar lafiya ce a Nijar. Ba da amsa cikin harshen Hausa game da rigakafi. Yi amfani da kalmomi masu dadi." },
            { role: "user", content: transcription.text }
        ]
    });
    const hausaReply = response.choices[0].message.content;
    console.log('[4/6] Réponse Claude:', hausaReply);

    // D. Synthèse Vocale (OpenAI TTS)
    const ttsResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: hausaReply
    });
    const ttsBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    console.log('[5/6] Audio OpenAI TTS généré:', ttsBuffer.byteLength, 'bytes');

    // E. Upload sur Cloudinary
    fs.writeFileSync('output.mp3', ttsBuffer);
    const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { resource_type: 'video', format: 'mp3', folder: 'chatbot_audio' },
            (error, result) => error ? reject(error) : resolve(result)
        ).end(ttsBuffer);
    });
    console.log('[6/6] Cloudinary URL:', uploadResult.secure_url);

    // F. Envoi de l'audio via WhatsApp
    const sendRes = await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to: userPhone,
            type: "audio",
            audio: { link: uploadResult.secure_url }
        },
        { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    console.log(`[OK] Réponse envoyée à ${userPhone}`);
    console.log('Meta response:', JSON.stringify(sendRes.data));

    // Nettoyage des fichiers temporaires
    fs.unlink('input.ogg', () => {});
    fs.unlink('output.mp3', () => {});
}

async function sendWhatsAppText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text }
        },
        { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
    );
}

const PORT = process.env.PORT || 40000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
