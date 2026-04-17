import mongoose from 'mongoose';

const WhatsappTemplateSchema = new mongoose.Schema({
    nom:          { type: String, required: true, trim: true },   // label affiché dans le dashboard
    templateName: { type: String, required: true, trim: true },   // nom exact dans Meta Business Manager
    langue:       { type: String, required: true, trim: true, default: 'fr' }, // code langue ex: fr, en_US, ha
    description:  { type: String, default: '' },
    statut:       { type: String, enum: ['actif', 'inactif'], default: 'actif' },
}, { timestamps: true });

WhatsappTemplateSchema.index({ templateName: 1, langue: 1 }, { unique: true });

export default mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);
