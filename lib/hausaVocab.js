/**
 * Cache dynamique du vocabulaire Hausa.
 * Chargé depuis MongoDB au démarrage et rechargé après chaque import Excel.
 * Fusionne les mots statiques (constants/config.js) + les entrées ajoutées via l'interface.
 *
 * Note : le Français n'a pas besoin de vocabulaire dynamique — GPT le comprend nativement.
 * Pour la détection French, on utilise uniquement les constantes statiques + franc.
 */

import HausaVocabulaire from '../db/models/HausaVocabulaire.js';
import { HAUSA_WORDS as STATIC_WORDS, HAUSA_PHRASES as STATIC_PHRASES } from '../constants/config.js';

// Cache mutable — mis à jour en place pour que les références actives restent valides
const _words   = new Set(STATIC_WORDS);
const _phrases = [...STATIC_PHRASES];

export function getHausaWords()   { return _words; }
export function getHausaPhrases() { return _phrases; }

/**
 * Construit un prompt de contexte Hausa pour Whisper (language:'ha').
 * Le prompt doit être du texte en Hausa — Whisper s'en sert comme contexte
 * pour caler sa transcription sur le vocabulaire médical nigérien.
 */
export function getHausaWhisperPrompt() {
    // On utilise jusqu'à 40 mots du vocabulaire dynamique
    const sample = [..._words].slice(0, 40).join(', ');
    // Phrases complètes parlées — Whisper les utilise comme contexte de langage.
    // Plus les phrases ressemblent au discours réel des utilisateurs, meilleure est la transcription.
    return (
        `Ina lafiya, na gode. Don Allah, ina son sanin inda asibiti yake. `
        + `Yaro na da zazzaɓi, me ya kamata in yi? Ina son allurar rigakafi. `
        + `Cibiyar lafiya tana nan kusa. Likita ya ce yaro ya yi allurar kyanda. `
        + `Allura ta farko ana yi wa jariri watanni biyu bayan haihuwa. `
        + `Nono na kare kariyar jariri daga cututtuka da dama. `
        + `Wannan asibiti yana ba da rigakafi kyauta ga yara. `
        + `Ina neman taimako game da haihuwa da lafiyar uwa da yaro. `
        + `BCG, DTP, VPO, da ROR alluran rigakafi ne na wajibi. `
        + `${sample}.`
    );
}

/**
 * Recharge le vocabulaire Hausa depuis MongoDB et fusionne avec les valeurs statiques.
 * Appelé au démarrage du serveur et après chaque import/ajout/suppression.
 */
export async function reloadHausaVocab() {
    try {
        const all = await HausaVocabulaire.find().lean();

        _words.clear();
        STATIC_WORDS.forEach(w => _words.add(w));
        _phrases.length = 0;
        STATIC_PHRASES.forEach(p => _phrases.push(p));

        for (const entry of all) {
            const v = entry.valeur.toLowerCase().trim();
            if (entry.type === 'mot')    _words.add(v);
            if (entry.type === 'phrase' && !_phrases.includes(v)) _phrases.push(v);
        }

        console.log(`[HAUSA VOCAB] Rechargé — ${_words.size} mots, ${_phrases.length} phrases`);
    } catch (err) {
        console.error('[HAUSA VOCAB] Erreur rechargement:', err.message);
    }
}
