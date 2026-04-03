import mongoose from 'mongoose';


// --- 2. TABLE DES DISTRICTS SANITAIRES ---
// Chaque district appartient à une région (ex: District de Madarounfa -> Maradi).
const DistrictSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    regionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true }
});



export default mongoose.model('District', DistrictSchema);
