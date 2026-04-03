import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
    whatsappId: { type: String, unique: true, required: true }, // ex: "22790000000"
    nom: { type: String, default: "Utilisateur Inconnu" },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    langue: { type: String, default: 'hausa' },
    dateInscription: { type: Date, default: Date.now },
    statutVaxEnfants: { type: String, enum: ['A jour', 'En retard', 'Inconnu'], default: 'Inconnu' }
});
export default mongoose.model('Contact', ContactSchema);



