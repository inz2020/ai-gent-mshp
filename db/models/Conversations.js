import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
    contactId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    sujet:             { type: String, default: 'Demande Information Vaccination' },
    statut:            { type: String, enum: ['ouvert', 'ferme', 'escalade_humain'], default: 'ouvert' },
    langue:            { type: String, enum: ['fr', 'ha', 'unknown'], default: 'unknown' },
    nbMessages:        { type: Number, default: 0 },
    derniereMiseAJour: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Conversation', ConversationSchema);
