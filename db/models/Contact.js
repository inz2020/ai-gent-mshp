import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
    whatsappId: { type: String, unique: true, required: true }, // ex: "22790000000"
    nom: { type: String, default: "Utilisateur Inconnu" },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    langue: { type: String, default: 'fr' },
    dateInscription: { type: Date, default: Date.now },
    statutVaxEnfants: { type: String, enum: ['A jour', 'En retard', 'Inconnu'], default: 'Inconnu' },
    dernierePosition: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null },
        updatedAt: { type: Date,   default: null }
    },
    // 'dashboard' = ajouté manuellement | 'webhook' = auto-créé par un message entrant
    source: { type: String, enum: ['dashboard', 'webhook'], default: 'webhook' },
    bloque: { type: Boolean, default: false },
});
export default mongoose.model('Contact', ContactSchema);



