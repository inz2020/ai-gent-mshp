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

    // Transcription échouée (script arabe, langue incompréhensible) — demande de répéter en Hausa
    repeat_ha: 'An ji murya ku amma ba mu fahimci kalmomin ba. Don Allah sake fadin tambayarku sannu sannu.',
};

// URLs Cloudinary des audios pré-générés — remplies au démarrage
const _audioUrls = {
    quality_ha: null,
    quality_fr: null,
    unclear_ha: null,
    unclear_fr: null,
    repeat_ha:  null,
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
    console.log('[AUDIO PRELOAD] Pré-génération des audios d\'erreur...');
    const results = await Promise.allSettled(
        Object.entries(ERROR_TEXTS).map(async ([key, text]) => {
            const lang = key.endsWith('_ha') ? 'ha' : 'fr';
            const voice = prepareVoiceText(text);
            try {
                const buffer = await generateTTS(voice, lang);
                const uploaded = await uploadAudio(buffer, 'error_audio');
                _audioUrls[key] = uploaded.secure_url;
                console.log(`[AUDIO PRELOAD] ${key} → ${uploaded.secure_url}`);
            } catch (err) {
                // Fallback 1 : ElevenLabs multilingue
                try {
                    const buffer = await ttsElevenLabs(voice);
                    const uploaded = await uploadAudio(buffer, 'error_audio');
                    _audioUrls[key] = uploaded.secure_url;
                    console.log(`[AUDIO PRELOAD] ${key} (ElevenLabs fallback) → ${uploaded.secure_url}`);
                } catch {
                    // Fallback 2 : OpenAI shimmer (supporte le texte Hausa en romanisation)
                    try {
                        const { ttsOpenAI } = await import('./audio.js');
                        const buffer = await ttsOpenAI(voice);
                        const uploaded = await uploadAudio(buffer, 'error_audio');
                        _audioUrls[key] = uploaded.secure_url;
                        console.log(`[AUDIO PRELOAD] ${key} (OpenAI fallback) → ${uploaded.secure_url}`);
                    } catch (fallbackErr) {
                        console.warn(`[AUDIO PRELOAD] Échec pré-génération ${key}:`, fallbackErr.message);
                    }
                }
            }
        })
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[AUDIO PRELOAD] ${ok}/${Object.keys(ERROR_TEXTS).length} audios prêts.`);
}
