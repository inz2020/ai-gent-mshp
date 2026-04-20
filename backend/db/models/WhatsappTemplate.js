import mongoose from 'mongoose';

const WhatsappTemplateSchema = new mongoose.Schema({
    nom:          { type: String, required: true, trim: true },
    templateName: { type: String, required: true, trim: true },
    langue:       { type: String, required: true, trim: true, default: 'fr' },
    description:  { type: String, default: '' },
    statut:       { type: String, enum: ['actif', 'inactif'], default: 'actif' },

    // Type du composant header Meta : texte | image | document | audio | aucun
    typeContenu:     { type: String, enum: ['aucun', 'texte', 'image', 'document', 'audio'], default: 'audio' },
    // Nombre de variables {{n}} dans le corps du template (0 = aucune)
    variablesCorps:  { type: Number, default: 0, min: 0, max: 10 },
    // Nombre de variables {{n}} dans le header texte (0 ou 1 en général)
    variablesEntete: { type: Number, default: 0, min: 0, max: 1 },
}, { timestamps: true });

WhatsappTemplateSchema.index({ templateName: 1, langue: 1 }, { unique: true });

export default mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);
