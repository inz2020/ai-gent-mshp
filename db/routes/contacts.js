import express from 'express';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversations.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// GET /api/contacts — liste avec région et district
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
