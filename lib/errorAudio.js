/**
 * Messages d'erreur audio pré-générés au démarrage du serveur.
 *
 * Pourquoi : les utilisateurs sont analphabètes — tout message d'erreur
 * doit être JOUABLE, jamais du texte. On génère les audios une seule fois
 * au boot et on stocke les URLs Cloudinary en mémoire.
 * Si la génération échoue, les URLs restent null et sendAudioReply
 * tentera quand même le TTS en live.
 */

import { generateTTS, ttsElevenLabs, prepareVoiceText, uploadAudio } from './audio.js';

// Textes des messages d'erreur — oral, court, compréhensible à l'oreille
export const ERROR_TEXTS = {
    // Audio trop bruité / silencieux
    quality_ha: 'Ban ji saƙon ku da kyau ba. Don Allah sake magana kusa da wayar ku.',
    quality_fr: 'Je n\'ai pas bien entendu votre message. Rapprochez le téléphone et réessayez.',

    // Audio peu clair
    unclear_ha: 'Murya ba ta bayyana ba. Don Allah magana sannu sannu, a sake.',
    unclear_fr: 'L\'audio est peu clair. Parlez lentement et distinctement, puis réessayez.',
};

// URLs Cloudinary des audios pré-générés — remplies au démarrage
const _audioUrls = {
    quality_ha: null,
    quality_fr: null,
    unclear_ha: null,
    unclear_fr: null,
};

/**
 * Retourne l'URL Cloudinary d'un message d'erreur pré-généré.
 * Retourne null si la pré-génération a échoué (fallback TTS live).
 */
export function getErrorAudioUrl(key) {
    return _audioUrls[key] ?? null;
}

/**
 * Génère et uploade tous les audios d'erreur sur Cloudinary.
 * Appelé une seule fois au démarrage du serveur.
 * Non-bloquant : les erreurs sont loggées mais n'empêchent pas le démarrage.
 */
export async function preloadErrorAudios() {
    console.log('[ERROR AUDIO] Pré-génération des audios d\'erreur...');
    const results = await Promise.allSettled(
        Object.entries(ERROR_TEXTS).map(async ([key, text]) => {
            const lang = key.endsWith('_ha') ? 'ha' : 'fr';
            try {
                const buffer = await generateTTS(prepareVoiceText(text), lang);
                const uploaded = await uploadAudio(buffer, 'error_audio');
                _audioUrls[key] = uploaded.secure_url;
                console.log(`[ERROR AUDIO] ${key} → ${uploaded.secure_url}`);
            } catch (err) {
                // Fallback ElevenLabs si TTS principal échoue
                try {
                    const buffer = await ttsElevenLabs(prepareVoiceText(text));
                    const uploaded = await uploadAudio(buffer, 'error_audio');
                    _audioUrls[key] = uploaded.secure_url;
                    console.log(`[ERROR AUDIO] ${key} (ElevenLabs fallback) → ${uploaded.secure_url}`);
                } catch (fallbackErr) {
                    console.warn(`[ERROR AUDIO] Échec pré-génération ${key}:`, fallbackErr.message);
                }
            }
        })
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[ERROR AUDIO] ${ok}/${Object.keys(ERROR_TEXTS).length} audios prêts.`);
}
