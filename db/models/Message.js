import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        telephone: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'audio'],
            required: true
        },
        langue: {
            type: String,
            enum: ['fr', 'ha', 'unknown'],
            default: 'unknown'
        },
        contenu: {
            type: String,     // texte envoyé ou transcription audio
            default: ''
        },
        reponse: {
            type: String,     // réponse générée par le chatbot
            default: ''
        },
        statut: {
            type: String,
            enum: ['traite', 'erreur', 'salutation'],
            default: 'traite'
        }
    },
    { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
