import express from 'express';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversations.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// GET /api/contacts
router.get('/', requireAuth, async (req, res) => {
    try {
        const contacts = await Contact.find()
            .populate('region', 'nom')
            .populate('district', 'nom')
            .sort({ dateInscription: -1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/contacts — creation manuelle d'un contact
router.post('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    const { whatsappId, nom, langue = 'fr' } = req.body;

    if (!whatsappId || !/^\d{7,15}$/.test(whatsappId)) {
        return res.status(400).json({ message: 'Numero WhatsApp invalide (chiffres uniquement, 7 a 15 digits).' });
    }
    if (!nom?.trim()) {
        return res.status(400).json({ message: 'Le nom est requis.' });
    }

    const exists = await Contact.findOne({ whatsappId });
    if (exists) {
        return res.status(409).json({ message: `Ce numero existe deja (${nom}).` });
    }

    try {
        const contact = await Contact.create({ whatsappId, nom: nom.trim(), langue });
        const populated = await Contact.findById(contact._id).populate('region', 'nom').populate('district', 'nom');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/contacts/:id/conversations — conversations d'un contact
router.get('/:id/conversations', requireAuth, async (req, res) => {
    try {
        const conversations = await Conversation.find({ contactId: req.params.id })
            .sort({ derniereMiseAJour: -1 });
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
