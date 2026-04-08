export const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "MON_SECRET_NIGER_2024";

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
        "sannu", "san'nou", "sannu","sanu", "san'nu","ina kwana", "ina wuni", "ina lafia", "barka", "assalamu alaikum", "salam"
    ],
    message: "Bonjour ! Bienvenue sur le service de vaccination du Niger 🇳🇪\nSannu! Maraba da ku.\n\nPour toute question, contactez-nous au :\n📞 +227 XX XX XX XX",
    image_url: "https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png",
    image_caption: "Service de Vaccination du Niger — PEV Niger"
};
// ─── Dictionnaires de détection de langue ───────────────────



export const HAUSA_WORDS = new Set([
    // Pronoms et déterminants
    'ina', 'kai', 'kin', 'mun', 'sun', 'shi', 'ta', 'ni', 'mu', 'ku', 'su',
    'na', 'ka', 'ki', 'ya', 'ga', 'wannan', 'wancan', 'wadannan',
    'wanda', 'wacce', 'wadanda', 'wata', 'wani', 'kowane', 'duk',
    // Verbes courants
    'sai', 'tafi', 'zo', 'yi', 'yin', 'je', 'aje', 'ba', 'bai',
    'ce', 'ne', 'ake', 'yake', 'tana', 'kana', 'muna', 'suna', 'zai',
    'za', 'gani', 'ji', 'sani', 'fada', 'tambaya', 'nema', 'kare',
    'fara', 'gama', 'dawo', 'tashi', 'kwana', 'zauna', 'tsaya',
    // Conjonctions / adverbes
    'don', 'da', 'ko', 'nan', 'wai', 'kuma', 'amma', 'saboda', 'lokaci',
    'yanzu', 'yau', 'gobe', 'jiya', 'bayan', 'kafin', 'tun', 'har',
    'sosai', 'kawai', 'kuwa', 'ma', 'fa', 'to', 'ai',
    // Substantifs santé / vaccination
    'mai', 'rigakafi', 'lafiya', 'cibiya', 'cibiyar', 'rashin', 'ciki', 'asibiti',
    'likita', 'zazzabi', 'jariri', 'haihuwa', 'allurar', 'magani',
    'kyanda', 'doussa', 'tounounoum',
    'gida', 'aboki', 'abokai', 'yaro', 'yarinya', 'uwa', 'uba',
    'jiki', 'cuta', 'gudawa', 'tari', 'jini', 'ruwa', 'abinci',
    'sauro', 'malamarta', 'kwaya', 'ungozoma', 'yara', 'jarma', 'nono', 'shayarwa',
    // Salutations
    'sannu', 'barka', 'yaya',
    // Divers
    'nawa', 'wane', 'cikin', 'chanchawa', 'shawa', 'chawa',
    'kyauta', 'gaggawa', 'mataki', 'amsawa', 'tambayar', 'lafiyar',
    'inganta', 'kariya', 'hana', 'gwaji', 'gwajin',
    'numfashi', 'kasala', 'rauni', 'farfadiya', 'farfadiyya'
]);


// Phrases Hausa multi-mots (recherche dans le texte complet, pas mot par mot)
export const HAUSA_PHRASES = [
    'shan ruwa', 'ina kwana', 'ina wuni', 'ina lafia',
    'barka da', 'assalamu alaikum', 'ya kamata', 'don allah',
    'ina son', 'yaya ake', 'me ya kamata',
    'yaro na', 'jariri na', 'cibiyar lafiya', 'ina nema',
    'allurar rigakafi', 'yi wa yaro', 'kai yaro'
];