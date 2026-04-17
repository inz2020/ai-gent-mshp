export const TYPES_CAMPAGNE = [
    { value: 'JNV',                label: 'JNV (Journée Nationale de Vaccination)' },
    { value: 'distribution_masse', label: 'Distribution de masse' },
    { value: 'riposte',            label: 'Riposte' },
];

export const MSG_TYPES = [
    { value: 'texte',    label: '✏️ Texte',    icon: '✏️' },
    { value: 'audio',    label: '🎵 Audio',    icon: '🎵' },
    { value: 'image',    label: '🖼️ Image',    icon: '🖼️' },
    { value: 'video',    label: '🎬 Vidéo',    icon: '🎬' },
    { value: 'document', label: '📄 Document', icon: '📄' },
];

export const STATUT_BADGE = {
    brouillon: 'dt-badge-inactif',
    en_cours:  'dt-badge-danger',
    terminee:  'dt-badge-actif',
    annulee:   'dt-badge-inactif',
};
export const STATUT_LABEL = {
    brouillon: 'Brouillon',
    en_cours:  'En cours',
    terminee:  'Terminée',
    annulee:   'Annulée',
};

export const EMPTY_FORM = {
    nom: '', type: 'JNV', produit: '', dateDebut: '', dateFin: '',
    districts: [],
    messageType: 'texte', messageTexte: '', messageMediaUrl: '',
    messageMediaNom: '', messageCaption: '',
};