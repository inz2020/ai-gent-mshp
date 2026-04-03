import mongoose from 'mongoose';


const ConversationSchema = new mongoose.Schema({
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    sujet: { type: String, default: "Demande Information Vaccination" },
    statut: { type: String, enum: ['ouvert', 'fermé', 'escaladé_humain'], default: 'ouvert' },
    dateCreation: { type: Date, default: Date.now },
    derniereMiseAJour: { type: Date, default: Date.now }
});



export default mongoose.model('Conversation', messageSchema);
