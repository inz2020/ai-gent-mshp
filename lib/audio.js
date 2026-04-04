/**
 * Helpers partagés : TTS (ElevenLabs / OpenAI) + upload Cloudinary
 * Utilisés par webhook.js et broadcasts.js
 */
import axios from 'axios';
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
