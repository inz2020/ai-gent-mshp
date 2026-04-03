export const VERIFY_TOKEN = "MON_SECRET_NIGER_2024";

// ============================================================
// MESSAGES PAR DÉFAUT — À PERSONNALISER ICI
// ============================================================
export const DEFAULT_MESSAGES = {
    ha: "Babu fahimta. Don Allah sake aiko saƙon ku a fili.",
    fr: "Je n'ai pas compris votre message. Veuillez le reformuler plus clairement.",
    unknown: "Je n'ai pas compris. / Babu fahimta. Don Allah sake aiko."
};

// ============================================================
// CONFIGURATION SALUTATIONS — À PERSONNALISER ICI
// ============================================================
export const GREETING_CONFIG = {
    keywords: [
        // Français
        "bonjour", "bonsoir", "salut", "coucou", "allô", "allo", "hello", "bonne nuit",
        // Hausa
        "sannu", "ina kwana", "ina wuni", "ina lafia", "barka", "assalamu alaikum", "salam"
    ],
    message: "Bonjour ! Bienvenue sur le service de vaccination du Niger 🇳🇪\nSannu! Maraba da ku.\n\nPour toute question, contactez-nous au :\n📞 +227 XX XX XX XX",
    image_url: "https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png",
    image_caption: "Service de Vaccination du Niger — PEV Niger"
};
// ─── Dictionnaires de détection de langue ───────────────────



export const HAUSA_WORDS = new Set([
    'ina', 'kai', 'kin', 'mun', 'sun', 'shi', 'ta', 'sai', 'don',
    'mai', 'wanda', 'wata', 'yaro', 'yarinya', 'aboki', 'abokai',
    'rigakafi', 'lafiya', 'cibiya', 'yaya', 'sannu', 'barka', 'ne',
    'ce', 'ba', 'da', 'ko', 'tafi', 'zo', 'yi', 'yin', 'nan',
    'zazzabi', 'jariri', 'haihuwa', 'allurar', 'magani', 'rashin',
    'ciki', 'yaya', 'wai', 'kuma', 'amma', 'saboda', 'lokaci',
    'kana', 'tana', 'muna', 'suna', 'gida', 'asibiti', 'likita',
    'chanchawa', 'shawa', 'chawa'
]);
export const FRENCH_WORDS = new Set([
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux',
    'est', 'sont', 'avec', 'pour', 'sur', 'dans', 'par', 'pas',
    'mon', 'ma', 'mes', 'ton', 'ta', 'son', 'ses', 'leur', 'leurs',
    'que', 'qui', 'quoi', 'comment', 'pourquoi', 'quand',
    'vaccin', 'vaccination', 'enfant', 'bebe', 'fievre', 'maladie',
    'sante', 'dose', 'injection', 'centre', 'gratuit', 'danger',
    'normal', 'medecin', 'docteur', 'hopital', 'grossesse', 'mere'
]);


// Phrases Hausa multi-mots (recherche dans le texte complet, pas mot par mot)
const HAUSA_PHRASES = [
    'shan sha wa', 'ina kwana', 'ina wuni', 'ina lafia',
    'barka da', 'assalamu alaikum', 'ya kamata', 'don allah',
    'ina son', 'yaya ake', 'me ya kamata'
];