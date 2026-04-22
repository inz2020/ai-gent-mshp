import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const SpotCampagneSchema = new mongoose.Schema({
    campagne: { type: ObjectId, ref: 'Campagne', required: true },
    nom:      { type: String, required: true, trim: true },
    langue:   { type: String, required: true, trim: true },
    audio: {
        url:      { type: String, default: '' },
        publicId: { type: String, default: '' },
        nom:      { type: String, default: '' },
    },
    diffusion: {
        statut:    { type: String, enum: ['inactif', 'en_cours', 'termine', 'erreur'], default: 'inactif' },
        total:     { type: Number, default: 0 },
        envoyes:   { type: Number, default: 0 },
        echecs:    { type: Number, default: 0 },
        dateEnvoi: { type: Date,   default: null },
        errorLog:  { type: String, default: '' },
    },
    creePar: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SpotCampagne', SpotCampagneSchema);
