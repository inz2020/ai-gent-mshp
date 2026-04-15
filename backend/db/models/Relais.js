import mongoose from 'mongoose';

const RelaisSchema = new mongoose.Schema({
    nom:{type:String, require:true},
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    structureSanitaire: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
   
    nbreAnneesExperience: { type: Number, default: 0 },

    typeRelais: { type: String, enum: ['RCom', 'ICCM'], default: 'Rcom' },

  
});
export default mongoose.model('Relais', RelaisSchema);



