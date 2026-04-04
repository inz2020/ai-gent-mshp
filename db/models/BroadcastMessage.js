import mongoose from 'mongoose';

// Trace chaque message envoyé dans une diffusion → permet le suivi de livraison
const BroadcastMessageSchema = new mongoose.Schema({
    broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', required: true, index: true },
    whatsappId:  { type: String, required: true },
    messageId:   { type: String, default: '', index: true }, // ID retourné par Meta
    statut:      { type: String, enum: ['envoye', 'livre', 'lu', 'echec'], default: 'envoye' },
}, { timestamps: true });

export default mongoose.model('BroadcastMessage', BroadcastMessageSchema);
