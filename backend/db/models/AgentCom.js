import mongoose from 'mongoose';

const AgentComSchema = new mongoose.Schema({
              // ID numéro WA Business (PHONE_ID Meta)
    nom:{type:String, require:true},
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    dateService: { type: Date, default: Date.now },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    statut: { type: String, enum: ['Responsable', 'Substitut', 'Stagiaire', 'Autre'], default: 'communicateur' },
});
export default mongoose.model('AgentCom', AgentComSchema);



