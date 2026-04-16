import mongoose from 'mongoose';

const ReunionPlaidoyerSchema = new mongoose.Schema({
    nom:            { type: String, required: true, trim: true },
    type:           { type: String, enum: ['Réunion', 'Plaidoyer'], default: 'Réunion' },
    date:           { type: Date },
    lieu:           { type: String, trim: true, default: '' },
    district:       { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    nbParticipants: { type: Number, default: 0 },
    description:    { type: String, trim: true, default: '' },
    campagne:       { type: mongoose.Schema.Types.ObjectId, ref: 'Campagne', required: true },
    creePar:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('ReunionPlaidoyer', ReunionPlaidoyerSchema);
