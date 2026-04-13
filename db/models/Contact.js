import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
    whatsappId:    { type: String, unique: true, required: true }, // ex: "22790000000"
    phoneNumberId: { type: String, default: null },              // ID numéro WA Business (PHONE_ID Meta)
    nom: { type: String, default: "Utilisateur Inconnu" },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    langue: { type: String, default: 'fr' },
    dateInscription: { type: Date, default: Date.now },
    dernierePosition: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null },
        updatedAt: { type: Date,   default: null }
    },
    // 'dashboard' = ajouté manuellement | 'webhook' = auto-créé par un message entrant
    source: { type: String, enum: ['dashboard', 'webhook'], default: 'webhook' },
    bloque: { type: Boolean, default: false },
    derniereInvitation: { type: Date, default: null },
});
export default mongoose.model('Contact', ContactSchema);



