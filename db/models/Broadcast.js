import mongoose from 'mongoose';

const BroadcastSchema = new mongoose.Schema({
    templateName:  { type: String, required: true },
    type:          { type: String, enum: ['texte', 'tts', 'audio', 'image', 'document'], default: 'texte' },
    langue:        { type: String, enum: ['fr', 'ha', 'tous'], default: 'tous' },
    langueTemplate:{ type: String, default: 'fr' },
    parametres:    [String],
    // Pour les diffusions audio : texte converti en TTS
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
    statut:        { type: String, enum: ['planifie', 'en_cours', 'termine', 'erreur'], default: 'en_cours' },
    creePar:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Broadcast', BroadcastSchema);
