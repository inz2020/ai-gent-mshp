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

const HAUSA_NUMBERS = {
    '0': 'sifili', '1': 'ɗaya', '2': 'biyu', '3': 'uku',
    '4': 'hudu', '5': 'biyar', '6': 'shida', '7': 'bakwai',
    '8': 'takwas', '9': 'tara', '10': 'goma',
    '11': 'goma sha ɗaya', '12': 'goma sha biyu', '13': 'goma sha uku',
    '14': 'goma sha hudu', '15': 'goma sha biyar', '18': 'goma sha takwas',
    '23': 'ashirin da uku', '24': 'ashirin da hudu',
};

export function prepareVoiceText(text, lang = 'fr') {
    let result = text
        // Supprimer le markdown
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        // Double saut de ligne → pause marquée
        .replace(/\n\n+/g, '... ')
        // Saut de ligne simple → légère pause
        .replace(/\n/g, ', ')
        // Tirets de liste → virgule
        .replace(/\s*-\s+/g, ', ')
        // Nettoyer les doubles espaces
        .replace(/\s{2,}/g, ' ')
        // Éviter les virgules qui se répètent avant un point
        .replace(/,\s*\./g, '.')
        // Séparer les listes de vaccins pour une meilleure respiration
        .replace(/,\s*([A-Z])/g, ', $1')
        .trim();

    // Hausa : convertir les chiffres résiduels en mots Hausa pour éviter la prononciation anglaise
    if (lang === 'ha') {
        result = result.replace(/\b(\d+)\b/g, n => HAUSA_NUMBERS[n] ?? n);
    }

    return result;
}

export async function ttsElevenLabs(text) {
    const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.VOICE_ID}`,
        {
            text,
            model_id: 'eleven_multilingual_v2',
            // speed est un parametre TOP-LEVEL, pas dans voice_settings
            speed: 0.88,
            voice_settings: {
                stability: 0.42,
                similarity_boost: 0.78,
                style: 0.40,
                use_speaker_boost: true
            }
        },
        {
            headers: { 'xi-api-key': process.env.ELEVEN_KEY, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer'
        }
    );
    return Buffer.from(res.data);
}

export async function ttsOpenAI(text) {
    // Si une voix clone ElevenLabs est definie pour le francais, on l'utilise en priorite
    if (process.env.VOICE_ID_FR) {
        const res = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${process.env.VOICE_ID_FR}`,
            {
                text,
                model_id: 'eleven_multilingual_v2',
                speed: 0.88,
                voice_settings: {
                    stability: 0.42,
                    similarity_boost: 0.78,
                    style: 0.40,
                    use_speaker_boost: true
                }
            },
            {
                headers: { 'xi-api-key': process.env.ELEVEN_KEY, 'Content-Type': 'application/json' },
                responseType: 'arraybuffer'
            }
        );
        return Buffer.from(res.data);
    }

    // Fallback OpenAI si pas de VOICE_ID_FR defini
    const res = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
            model: 'tts-1-hd',
            voice: 'nova',
            input: text,
            speed: 0.90
        },
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
