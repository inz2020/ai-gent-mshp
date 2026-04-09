import express from 'express';
import axios from 'axios';
import Conversation from '../models/Conversations.js';
import Message from '../models/Message.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// GET /api/conversations/stats — chiffres clés pour le dashboard
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const [total, audio, texte, contacts] = await Promise.all([
            Message.countDocuments({ emetteurType: 'humain' }),
            Message.countDocuments({ emetteurType: 'humain', typeContenu: 'audio' }),
            Message.countDocuments({ emetteurType: 'humain', typeContenu: 'text' }),
            Conversation.distinct('contactId'),
        ]);
        res.json({ total, audio, texte, contacts: contacts.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/conversations — liste avec infos contact
router.get('/', requireAuth, async (req, res) => {
    try {
        const conversations = await Conversation.find()
            .populate('contactId', 'whatsappId nom langue source bloque dernierePosition')
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

// PATCH /api/conversations/:id/mode — bascule Mode IA ↔ Mode Humain
router.patch('/:id/mode', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
            .populate('contactId', 'whatsappId nom langue source bloque');
        if (!conv) return res.status(404).json({ message: 'Conversation introuvable.' });

        if (conv.statut === 'ferme') {
            return res.status(400).json({ message: 'Impossible de changer le mode d\'une conversation fermée.' });
        }
        conv.statut = conv.statut === 'escalade_humain' ? 'ouvert' : 'escalade_humain';
        await conv.save();
        res.json(conv);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/conversations/:id/send — opérateur envoie un message WhatsApp
router.post('/:id/send', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    const { texte } = req.body;
    if (!texte?.trim()) return res.status(400).json({ message: 'Le texte est requis.' });

    try {
        const conv = await Conversation.findById(req.params.id)
            .populate('contactId', 'whatsappId');
        if (!conv) return res.status(404).json({ message: 'Conversation introuvable.' });

        const whatsappId = conv.contactId?.whatsappId;
        if (!whatsappId) return res.status(400).json({ message: 'Contact sans numéro WhatsApp.' });

        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: whatsappId,
                type: 'text',
                text: { body: texte.trim() },
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.META_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const msg = await Message.create({
            conversationId: conv._id,
            emetteurType:   'operateur_sante',
            typeContenu:    'text',
            texteBrut:      texte.trim(),
            langue:         'fr',
        });

        conv.nbMessages += 1;
        conv.derniereMiseAJour = new Date();
        await conv.save();

        res.json(msg);
    } catch (err) {
        console.error('[SEND-OP]', err.message);
        res.status(500).json({ message: err.response?.data?.error?.message ?? err.message });
    }
});

export default router;
