/**
 * Helpers partagés : TTS (ElevenLabs / OpenAI) + STT + upload Cloudinary
 * Utilisés par webhook.js et broadcasts.js
 */
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});

export function prepareVoiceText(text) {
    return text
        .replace(/\n\n+/g, '. ')
        .replace(/\n/g, ', ')
        .replace(/\s*-\s+/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
}

export async function ttsElevenLabs(text) {
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

export async function ttsOpenAI(text) {
    const res = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        { model: 'tts-1-hd', voice: 'shimmer', input: text, speed: 0.92 },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }, responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
}

/**
 * Génère un fichier TTS selon la langue.
 * lang='ha' → ElevenLabs (meilleur support Hausa)
 * lang='fr' → OpenAI shimmer
 */
export async function generateTTS(text, lang = 'fr') {
    return lang === 'ha' ? ttsElevenLabs(text) : ttsOpenAI(text);
}

/**
 * Transcription audio via ElevenLabs Scribe (STT).
 * Hausa est nativement supporté (code 'hau') contrairement à Whisper.
 * Retourne un objet compatible avec la structure Whisper :
 *   { text, language, segments }
 *
 * @param {string} filePath  - Chemin vers le fichier audio local
 * @param {string} langCode  - Code langue ISO 639-3 (ex: 'hau', 'fra')
 */
export async function sttElevenLabs(filePath, langCode = 'hau') {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model_id', 'scribe_v1');
    form.append('language_code', langCode);
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');

    const res = await axios.post(
        'https://api.elevenlabs.io/v1/speech-to-text',
        form,
        {
            headers: {
                'xi-api-key': process.env.ELEVEN_KEY,
                ...form.getHeaders(),
            },
            timeout: 30000,
        }
    );

    const data = res.data;
    // Normalise vers le format attendu par processAudio dans webhook.js
    return {
        text:     data.text ?? '',
        language: data.language_code ?? langCode,  // ex: 'hau'
        segments: [], // Scribe retourne des mots, pas des segments — on skip la qualité Whisper
        _source:  'elevenlabs',
    };
}

/**
 * Upload un Buffer audio sur Cloudinary et retourne { secure_url, public_id }
 */
export async function uploadAudio(buffer, folder = 'chatbot_audio') {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { resource_type: 'video', format: 'mp3', folder },
            (err, result) => err ? reject(err) : resolve(result)
        ).end(buffer);
    });
}
