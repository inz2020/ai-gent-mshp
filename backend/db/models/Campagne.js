import mongoose from 'mongoose';

const CampagneSchema = new mongoose.Schema({
    nom:          { type: String, required: true, trim: true },
    type:         { type: String, enum: ['JNV', 'distribution_masse', 'riposte'], required: true },
    produit:      { type: String, default: '', trim: true },
    dateDebut:    { type: Date, required: true },
    dateFin:      { type: Date, required: true },
    districts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'District' }],

    // Message
    messageType:     { type: String, enum: ['texte', 'audio', 'image', 'document', 'video'], default: 'texte' },
    messageTexte:    { type: String, default: '' },
    messageMediaUrl: { type: String, default: '' },
    messageMediaNom: { type: String, default: '' },
    messageCaption:  { type: String, default: '' },

    // Statut & stats
    statut:      { type: String, enum: ['brouillon', 'en_cours', 'terminee', 'annulee'], default: 'brouillon' },
    nbCibles:    { type: Number, default: 0 },
    nbEnvoyes:   { type: Number, default: 0 },
    nbEchecs:    { type: Number, default: 0 },

    creePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Campagne', CampagneSchema);
