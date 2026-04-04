import mongoose from 'mongoose';

const VaccinSchema = new mongoose.Schema({
    code:                { type: String, required: true, unique: true, uppercase: true, trim: true },
    nom:                 { type: String, required: true, trim: true },
    maladiesProtegees:   { type: String, trim: true },
    nbDoses:             { type: Number, default: 1, min: 1 },
    voieAdministration:  { type: String, enum: ['oral', 'injectable', 'intradermique'], default: 'injectable' },
    actif:               { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Vaccin', VaccinSchema);
