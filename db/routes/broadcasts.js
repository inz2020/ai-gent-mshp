import express from 'express';
import axios from 'axios';
import Contact from '../models/Contact.js';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

const BroadcastSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    langue:       { type: String, enum: ['fr', 'ha', 'tous'], default: 'tous' },
    parametres:   [String],
    total:        { type: Number, default: 0 },
    envoyes:      { type: Number, default: 0 },
    echecs:       { type: Number, default: 0 },
    statut:       { type: String, enum: ['en_cours', 'termine', 'erreur'], default: 'en_cours' },
    creePar:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

// ─── GET /api/broadcasts — historique
router.get('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const broadcasts = await Broadcast.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('creePar', 'nom email');
        res.json(broadcasts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/broadcasts — lancer une diffusion
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { templateName, langue, parametres = [], langueTemplate = 'fr' } = req.body;

    if (!templateName) {
        return res.status(400).json({ message: 'Nom du template requis.' });
    }

    // Filtrer les contacts selon la langue choisie
    const filter = {};
    if (langue === 'fr') filter.langue = 'fr';
    if (langue === 'ha') filter.langue = { $in: ['hausa', 'ha'] };

    const contacts = await Contact.find(filter).lean();

    if (contacts.length === 0) {
        return res.status(400).json({ message: 'Aucun contact trouvé pour cette sélection.' });
    }

    // Créer l'entrée en base
    const broadcast = await Broadcast.create({
        templateName,
        langue,
        parametres,
        total: contacts.length,
        creePar: req.user.id,
        langueTemplate
    });

    // Répondre immédiatement — l'envoi se fait en arrière-plan
    res.json({ message: `Diffusion lancée vers ${contacts.length} contact(s).`, broadcastId: broadcast._id });

    envoyerDiffusion(broadcast, contacts, langueTemplate).catch(err =>
        console.error('[BROADCAST] Erreur:', err.message)
    );
});

async function envoyerDiffusion(broadcast, contacts, langueTemplate = 'fr') {
    const headers = {
        Authorization: `Bearer ${process.env.META_TOKEN}`,
        'Content-Type': 'application/json'
    };

    let envoyes = 0;
    let echecs  = 0;

    for (const contact of contacts) {
        try {
            const components = [];
            if (broadcast.parametres?.length > 0) {
                components.push({
                    type: 'body',
                    parameters: broadcast.parametres.map(p => ({ type: 'text', text: p }))
                });
            }

            const payload = {
                messaging_product: 'whatsapp',
                to: contact.whatsappId,
                type: 'template',
                template: {
                    name: broadcast.templateName,
                    language: { code: langueTemplate },
                    ...(components.length > 0 && { components })
                }
            };

            await axios.post(
                `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
                payload,
                { headers }
            );
            envoyes++;
            console.log(`[BROADCAST] ✓ Envoyé à +${contact.whatsappId}`);
        } catch (err) {
            echecs++;
            console.error(`[BROADCAST] ✗ Échec +${contact.whatsappId}:`, err.response?.data?.error?.message ?? err.message);
        }

        // Délai de 1s entre chaque envoi (limite Meta : ~80 msg/s)
        await new Promise(r => setTimeout(r, 1000));
    }

    await broadcast.updateOne({ envoyes, echecs, statut: 'termine' });
    console.log(`[BROADCAST] Terminé — ${envoyes} envoyés, ${echecs} échecs`);
}

export default router;
