import mongoose from 'mongoose';

const MobilisationSocialeSchema=new mongoose.Schema({
    
   nom:{ type:String,required:true , trim:true},
   dateDebutMobSoc:{type:Date, required:true},
   dateFinMobSoc:{type:Date, required:true},
   creePar:{type:mongoose.Schema.Types.ObjectId, ref:'User'}
}
,{ timestamps: true }
);

export default mongoose.model('MobilisationSociale',MobilisationSocialeSchema);