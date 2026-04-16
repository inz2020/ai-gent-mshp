import mongoose from 'mongoose';

const AgentComSchema = new mongoose.Schema({
    nom:      { type: String, required: true, trim: true },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    contact:  { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    dateService: { type: Date },
    statut: { type: String, enum: ['Responsable', 'Substitut', 'Stagiaire', 'Autre'], default: 'Autre' },
});
export default mongoose.model('AgentCom', AgentComSchema);



