import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    type:           { type: String, enum: ['mot', 'phrase'], required: true },
    valeur:         { type: String, required: true, trim: true },
    traduction_fr:  { type: String, default: '' },
    categorie:      { type: String, default: '' }
}, { timestamps: true });

// Unicité par type + valeur
schema.index({ type: 1, valeur: 1 }, { unique: true });

export default mongoose.model('HausaVocabulaire', schema);
