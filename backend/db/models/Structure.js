import mongoose from 'mongoose';



// --- 3. TABLE DES STRUCTURES SANITAIRES ---
// Le cœur du système avec géolocalisation.
const StructureSchema = new mongoose.Schema({
    nom: { type: String, required: true }, // ex: "CSI Dar Es Salam"
    type: { 
        type: String, 
        enum: ['CSI', 'CS', 'Hôpital District', 'CH R'], 
        required: true 
    },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true },
    coordonnees: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null }
    },
    contactUrgence: String,
    statutVaccination: { type: Boolean, default: true } // Indique si le centre vaccine actuellement
});
export default mongoose.model('Structure', StructureSchema);
