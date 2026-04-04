import mongoose from 'mongoose';

const CalendrierVaccinalSchema = new mongoose.Schema({
    vaccinId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Vaccin', required: true },
    ageLabel:      { type: String, required: true, trim: true },  // ex: "À la naissance", "6 semaines"
    ageEnSemaines: { type: Number, required: true },               // pour le tri : 0, 6, 10, 14, 39…
    cible:         { type: String, enum: ['nourrisson', 'femme_enceinte'], default: 'nourrisson' },
    notes:         { type: String, trim: true }
}, { timestamps: true });

export default mongoose.model('CalendrierVaccinal', CalendrierVaccinalSchema);
