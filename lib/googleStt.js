/**
 * Transcription audio via Google Cloud Speech-to-Text.
 * Supporte officiellement le Hausa nigérian (ha-NG) — contrairement à Whisper.
 *
 * Configuration requise dans .env :
 *   GOOGLE_CLOUD_KEY_JSON=<contenu JSON de la clé de compte de service, sur une seule ligne>
 *   ou
 *   GOOGLE_APPLICATION_CREDENTIALS=<chemin vers le fichier JSON de la clé>
 */

import speech from '@google-cloud/speech';
import fs from 'fs';

let _client = null;

function getClient() {
    if (_client) return _client;

    const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;
    if (keyJson) {
        try {
            _client = new speech.SpeechClient({ credentials: JSON.parse(keyJson) });
        } catch (e) {
            throw new Error('GOOGLE_CLOUD_KEY_JSON invalide — vérifiez que le JSON est sur une seule ligne.');
        }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        _client = new speech.SpeechClient(); // utilise le fichier pointé par la variable
    } else {
        throw new Error('Aucune credential Google Cloud configurée (GOOGLE_CLOUD_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS).');
    }
    return _client;
}

/**
 * Retourne true si les credentials Google Cloud sont configurées.
 */
export function isGoogleSttAvailable() {
    return !!(process.env.GOOGLE_CLOUD_KEY_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/**
 * Transcrit un fichier audio OGG/OPUS (format WhatsApp) en Hausa (ha-NG).
 * Utilise la reconnaissance synchrone (limite ~60 s — suffisant pour WhatsApp).
 *
 * @param {string} filePath  Chemin local du fichier .ogg
 * @returns {Promise<string>} Texte transcrit (vide si rien détecté)
 */
export async function transcribeHausa(filePath) {
    const client = getClient();
    const content = fs.readFileSync(filePath).toString('base64');

    // Tentative 1 : 16 000 Hz (le plus courant pour WhatsApp)
    try {
        const [resp] = await client.recognize({
            audio: { content },
            config: {
                encoding: 'OGG_OPUS',
                sampleRateHertz: 16000,
                audioChannelCount: 1,
                languageCode: 'ha-NG',
                enableAutomaticPunctuation: false,
                useEnhanced: false,
            }
        });
        const text = resp.results.map(r => r.alternatives[0]?.transcript || '').join(' ').trim();
        if (text.length > 0) return text;
    } catch (e) {
        // Si 16000 Hz échoue, essayer 48000 Hz
        if (!e.message?.includes('sampleRateHertz')) throw e;
    }

    // Tentative 2 : 48 000 Hz (moins fréquent mais possible)
    const [resp2] = await client.recognize({
        audio: { content },
        config: {
            encoding: 'OGG_OPUS',
            sampleRateHertz: 48000,
            audioChannelCount: 1,
            languageCode: 'ha-NG',
            enableAutomaticPunctuation: false,
            useEnhanced: false,
        }
    });
    return resp2.results.map(r => r.alternatives[0]?.transcript || '').join(' ').trim();
}

/**
 * Transcrit un fichier audio en français via Google Cloud STT.
 * Alternative à Whisper pour le français si besoin de cohérence de service.
 *
 * @param {string} filePath  Chemin local du fichier .ogg
 * @returns {Promise<string>} Texte transcrit
 */
export async function transcribeFrench(filePath) {
    const client = getClient();
    const content = fs.readFileSync(filePath).toString('base64');

    const [resp] = await client.recognize({
        audio: { content },
        config: {
            encoding: 'OGG_OPUS',
            sampleRateHertz: 16000,
            audioChannelCount: 1,
            languageCode: 'fr-FR',
            enableAutomaticPunctuation: true,
            useEnhanced: true,
            model: 'latest_long',
        }
    });
    return resp.results.map(r => r.alternatives[0]?.transcript || '').join(' ').trim();
}
