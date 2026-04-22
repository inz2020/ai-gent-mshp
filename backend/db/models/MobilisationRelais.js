import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const MobilisationRelaisSchema = new mongoose.Schema({
    campagne:  { type: ObjectId, ref: 'Campagne',  required: true },
    district:  { type: ObjectId, ref: 'District',  required: true },
    relais:    [{ type: ObjectId, ref: 'Relais' }],
    template:  { type: ObjectId, ref: 'WhatsappTemplate', default: null },
    messageAudio: {
        url:      { type: String, default: '' },
        nom:      { type: String, default: '' },
        publicId: { type: String, default: '' },
    },
  /*   concessionsVisitees: { type: Number, default: 0 },
    personnesTouchees:   { type: Number, default: 0 }, */

    diffusion: {
        statut:    { type: String, enum: ['inactif', 'en_cours', 'termine', 'erreur'], default: 'inactif' },
        total:     { type: Number, default: 0 },
        envoyes:   { type: Number, default: 0 },
        echecs:    { type: Number, default: 0 },
        dateEnvoi: { type: Date,   default: null },
        errorLog:  { type: String, default: '' },
    },
}, { timestamps: true });

// un seul enregistrement par campagne + district
MobilisationRelaisSchema.index({ campagne: 1, district: 1 }, { unique: true });

export default mongoose.model('MobilisationRelais', MobilisationRelaisSchema);
