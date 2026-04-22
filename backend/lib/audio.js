/**
 * Helpers partagés : TTS (ElevenLabs / OpenAI) + STT + upload Cloudinary
 * Utilisés par webhook.js et broadcasts.js
 */
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});

/**
 * Prétraite l'audio WhatsApp avant envoi au STT.
 * Convertit OGG/Opus → WAV 16 kHz mono PCM (format optimal pour Whisper).
 * Normalise aussi le volume pour réduire l'impact du bruit de fond.
 *
 * @param {string} inputPath  - Chemin du fichier OGG d'entrée
 * @returns {Promise<string>} - Chemin du fichier WAV traité
 */
export function preprocessAudio(inputPath) {
    const outputPath = inputPath.replace(/\.\w+$/, '_processed.wav');
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFrequency(16000)   // Whisper est entraîné sur du 16 kHz
            .audioChannels(1)        // Mono — pas de perte d'info pour la voix
            .audioCodec('pcm_s16le') // WAV non compressé — meilleure qualité
            .audioFilters('loudnorm') // Normalisation du volume (réduit bruit de fond)
            .format('wav')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(new Error(`FFmpeg: ${err.message}`)))
            .save(outputPath);
    });
}

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

    // Fallback OpenAI — response_format opus = OGG Opus (vocal WhatsApp natif)
    const res = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
            model: 'tts-1-hd',
            voice: 'nova',
            input: text,
            speed: 0.90,
            response_format: 'opus',
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }, responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
}

/**
 * Convertit un buffer audio (MP3/WAV/…) en OGG Opus via ffmpeg.
 * WhatsApp affiche OGG Opus comme bulle vocale, pas comme fichier audio.
 */
export function convertToOggOpus(inputBuffer) {
    return new Promise((resolve, reject) => {
        const tmpId  = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const inPath  = `tts_in_${tmpId}.mp3`;
        const outPath = `tts_out_${tmpId}.ogg`;

        fs.writeFileSync(inPath, inputBuffer);

        ffmpeg(inPath)
            .audioCodec('libopus')
            .audioFrequency(48000)
            .audioChannels(1)
            .format('ogg')
            .on('end', () => {
                const result = fs.readFileSync(outPath);
                fs.unlink(inPath,  () => {});
                fs.unlink(outPath, () => {});
                resolve(result);
            })
            .on('error', (err) => {
                fs.unlink(inPath,  () => {});
                reject(new Error(`convertToOggOpus: ${err.message}`));
            })
            .save(outPath);
    });
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
    const text = data.text ?? '';

    // Calcul d'une confiance moyenne à partir des mots (ElevenLabs Scribe retourne des mots avec confidence)
    const words = data.words ?? [];
    const avgConfidence = words.length > 0
        ? words.reduce((sum, w) => sum + (w.confidence ?? 1), 0) / words.length
        : null;

    // Normalise vers le format attendu par processAudio dans webhook.js
    // On expose avgConfidence pour permettre un contrôle qualité alternatif
    return {
        text,
        language:       data.language_code ?? langCode,  // ex: 'hau'
        segments:       [],  // Scribe retourne des mots, pas des segments Whisper
        _source:        'elevenlabs',
        _wordCount:     words.length,
        _avgConfidence: avgConfidence,
    };
}

/**
 * Upload un Buffer audio sur Cloudinary et retourne { secure_url, public_id }
 */
export async function uploadAudio(buffer, folder = 'chatbot_audio', format = 'mp3') {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { resource_type: 'video', format, folder },
            (err, result) => err ? reject(err) : resolve(result)
        ).end(buffer);
    });
}
