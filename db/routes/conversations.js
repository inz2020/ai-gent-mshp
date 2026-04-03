import express from 'express';
import Conversation from '../models/Conversations.js';
import Message from '../models/Message.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// GET /api/conversations — liste avec infos contact
router.get('/', requireAuth, async (req, res) => {
    try {
        const conversations = await Conversation.find()
            .populate('contactId', 'whatsappId nom langue')
            .sort({ derniereMiseAJour: -1 });
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/conversations/:id/messages — messages d'une conversation
router.get('/:id/messages', requireAuth, async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.id })
            .sort({ dateEnvoi: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
