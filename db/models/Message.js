import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    emetteurType: { 
        type: String, 
        enum: ['humain', 'agent_ia', 'operateur_sante'], 
        required: true 
    },
    typeContenu: { type: String, enum: ['text', 'audio'], default: 'audio' },
    texteBrut: String,        // La transcription (si audio) ou le texte direct
    audioUrl: String,         // URL Cloudinary
    cloudinaryId: String,     // Pour la gestion du stockage
    metadata: {
        intent: String,       // ex: "demande_lieu_vax"
        scoreConfiance: Number
    },
    dateEnvoi: { type: Date, default: Date.now }
});




export default mongoose.model('Message', messageSchema);
