import mongoose from 'mongoose';

// --- 1. TABLE DES RÉGIONS ---
// Ex: Agadez, Diffa, Dosso, Maradi, Niamey, Tahoua, Tillabéri, Zinder.
const RegionSchema = new mongoose.Schema({
    nom: { type: String, required: true, unique: true }
});



export default mongoose.model('Region', RegionSchema);
