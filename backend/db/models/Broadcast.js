import mongoose from 'mongoose';

const VariableSchema = new mongoose.Schema({
    type:          { type: String, enum: ['text','image','audio','audio_tts','document','video'], default: 'text' },
    value:         { type: String, default: '' },   // valeur texte
    mediaUrl:      { type: String, default: '' },   // URL Cloudinary (media ou TTS généré)
    mediaFileName: { type: String, default: '' },   // nom fichier document
    ttsText:       { type: String, default: '' },   // texte source pour TTS
}, { _id: false });

const BroadcastSchema = new mongoose.Schema({
    templateName:  { type: String, required: true },
    langueTemplate:{ type: String, default: 'fr' },
    variables:     { type: [VariableSchema], default: [] },

    // Champs legacy (rétrocompatibilité)
    type:          { type: String, default: 'texte' },
    langue:        { type: String, default: 'tous' },
    parametres:    [String],
    messageAudio:  { type: String, default: '' },
    audioUrl:      { type: String, default: '' },

    // Planification
    dateEnvoi:     { type: Date, default: null },

    // Stats
    total:         { type: Number, default: 0 },
    envoyes:       { type: Number, default: 0 },
    echecs:        { type: Number, default: 0 },
    livre:         { type: Number, default: 0 },
    lu:            { type: Number, default: 0 },
    statut:        { type: String, enum: ['planifie','en_cours','termine','erreur'], default: 'en_cours' },
    errorLog:      { type: String, default: '' },   // message d'erreur lisible

    contactIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    creePar:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Broadcast', BroadcastSchema);
