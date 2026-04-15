import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    emetteurType: {
        type: String,
        enum: ['humain', 'agent_ia', 'operateur_sante'],
        required: true
    },
    typeContenu:  { type: String, enum: ['text', 'audio', 'location'], default: 'text' },
    texteBrut:    { type: String, default: '' },   // transcription audio ou texte direct
    audioUrl:     { type: String, default: '' },   // URL Cloudinary mp3 réponse TTS
    cloudinaryId: { type: String, default: '' },   // public_id Cloudinary pour suppression
    langue:       { type: String, enum: ['fr', 'ha', 'unknown'], default: 'unknown' },
    coordonnees: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null }
    },
    metadata: {
        intent:         { type: String, default: '' },
        scoreConfiance: { type: Number, default: 0 }
    },
    dateEnvoi: { type: Date, default: Date.now }
});

export default mongoose.model('Message', MessageSchema);
