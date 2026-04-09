import express from 'express';
import axios from 'axios';
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
        const contact = await Contact.create({ whatsappId, nom: nom.trim(), langue, source: 'dashboard' });
        const populated = await Contact.findById(contact._id).populate('region', 'nom').populate('district', 'nom');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/contacts/import — import en masse depuis Excel (JSON)
router.post('/import', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: 'Fichier vide ou format invalide.' });
    }
    if (rows.length > 500) {
        return res.status(400).json({ message: 'Maximum 500 contacts par import.' });
    }

    const results = { crees: 0, ignores: 0, erreurs: [] };

    for (const row of rows) {
        // Normalise le numéro : retire le + et les espaces
        const raw = String(row['N° WhatsApp'] ?? row['whatsappId'] ?? '').replace(/\D/g, '');
        const nom  = String(row['Nom'] ?? row['nom'] ?? '').trim();
        const langueRaw = String(row['Langue'] ?? row['langue'] ?? 'fr').toLowerCase().trim();
        const langue = langueRaw === 'hausa' || langueRaw === 'ha' ? 'ha' : 'fr';

        if (!raw || !/^\d{7,15}$/.test(raw)) {
            results.erreurs.push(`Numéro invalide : "${row['N° WhatsApp'] ?? raw}"`);
            results.ignores++;
            continue;
        }
        if (!nom) {
            results.erreurs.push(`Nom manquant pour le numéro +${raw}`);
            results.ignores++;
            continue;
        }

        const exists = await Contact.findOne({ whatsappId: raw });
        if (exists) {
            results.ignores++;
            continue;
        }

        try {
            await Contact.create({ whatsappId: raw, nom, langue, source: 'dashboard' });
            results.crees++;
        } catch (err) {
            results.erreurs.push(`Erreur pour +${raw} : ${err.message}`);
            results.ignores++;
        }
    }

    res.json(results);
});

// PATCH /api/contacts/:id/enregistrer — enregistre un contact webhook dans le tableau de bord
// Met à jour le nom et passe la source à 'dashboard'. Crée le contact s'il n'existe pas.
router.patch('/:id/enregistrer', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    const { nom } = req.body;
    if (!nom?.trim()) return res.status(400).json({ message: 'Le nom est requis.' });

    try {
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { nom: nom.trim(), source: 'dashboard' },
            { new: true }
        ).populate('region', 'nom').populate('district', 'nom');

        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });
        res.json(contact);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PATCH /api/contacts/:id/bloquer — bloquer ou débloquer un contact
router.patch('/:id/bloquer', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });
        if (contact.source === 'dashboard') {
            return res.status(400).json({ message: 'Impossible de bloquer un contact enregistré dans la liste officielle.' });
        }
        contact.bloque = !contact.bloque;
        await contact.save();
        res.json({ bloque: contact.bloque, message: contact.bloque ? 'Contact bloqué.' : 'Contact débloqué.' });
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

// POST /api/contacts/:id/inviter — envoie un template WhatsApp d'invitation
// Utilise un message template approuvé par Meta pour initier le contact.
// Le nom du template et la langue sont configurés via variables d'env.
router.post('/:id/inviter', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });

        const templateName = process.env.WA_INVITE_TEMPLATE ?? 'hello_world';
        const langCode     = contact.langue === 'ha' ? (process.env.WA_INVITE_TEMPLATE_LANG_HA ?? 'en_US')
                                                     : (process.env.WA_INVITE_TEMPLATE_LANG_FR ?? 'fr');

        const payload = {
            messaging_product: 'whatsapp',
            to: contact.whatsappId,
            type: 'template',
            template: {
                name: templateName,
                language: { code: langCode },
            },
        };

        // Si le template a un paramètre {{1}} pour le nom, on l'injecte
        if (contact.nom) {
            payload.template.components = [{
                type: 'body',
                parameters: [{ type: 'text', text: contact.nom }],
            }];
        }

        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_ID}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${process.env.META_TOKEN}`, 'Content-Type': 'application/json' } }
        );

        // Marquer la date du dernier envoi d'invitation
        contact.derniereInvitation = new Date();
        await contact.save();

        res.json({ message: 'Invitation envoyée.', whatsappId: contact.whatsappId });
    } catch (err) {
        const metaMsg = err.response?.data?.error?.message ?? err.message;
        res.status(500).json({ message: metaMsg });
    }
});

export default router;
