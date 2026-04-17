import express from 'express';
import axios from 'axios';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversations.js';
import Structure from '../models/Structure.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const router = express.Router();

// GET /api/contacts
// Paramètre optionnel : ?phoneNumberId=XXXX pour filtrer par numéro WA Business
router.get('/', requireAuth, async (req, res) => {
    try {
        const filter = {};
        if (req.query.phoneNumberId) filter.phoneNumberId = req.query.phoneNumberId;

        const contacts = await Contact.find(filter)
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
        return res.status(400).json({ message: 'Numéro WhatsApp invalide (chiffres uniquement, 7 a 15 digits).' });
    }
    if (!nom?.trim()) {
        return res.status(400).json({ message: 'Le nom est requis.' });
    }

    const exists = await Contact.findOne({ whatsappId });
    if (exists) {
        return res.status(409).json({ message: `Ce numéro existe déjà (${nom}).` });
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

// POST /api/contacts/:id/detect-location — détecte région/district depuis la dernière position GPS
router.post('/:id/detect-location', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });

        const { latitude: lat, longitude: lng } = contact.dernierePosition ?? {};
        if (!lat || !lng) {
            return res.status(400).json({ message: 'Ce contact n\'a pas de position GPS enregistrée.' });
        }

        const structures = await Structure.find()
            .populate({ path: 'districtId', populate: { path: 'regionId' } });

        if (!structures.length) {
            return res.status(400).json({ message: 'Aucune structure en base pour effectuer la détection.' });
        }

        const sorted = structures
            .filter(s => s.coordonnees?.latitude && s.coordonnees?.longitude)
            .map(s => ({ ...s.toObject(), distance: haversine(lat, lng, s.coordonnees.latitude, s.coordonnees.longitude) }))
            .sort((a, b) => a.distance - b.distance);

        const closest = sorted[0];
        if (!closest?.districtId?._id) {
            return res.status(400).json({ message: 'Impossible de détecter la zone depuis les structures disponibles.' });
        }

        contact.district = closest.districtId._id;
        contact.region   = closest.districtId.regionId?._id ?? contact.region;
        await contact.save();

        const updated = await Contact.findById(contact._id)
            .populate('region', 'nom')
            .populate('district', 'nom');

        res.json({
            message: `Région et district détectés (structure la plus proche : ${closest.nom}, ${closest.distance.toFixed(1)} km).`,
            region:   updated.region,
            district: updated.district,
            contact:  updated,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/contacts/:id — mise à jour du contact (nom, langue, statutVaxEnfants)
router.put('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });

        const { nom, langue } = req.body;
        if (nom !== undefined) contact.nom = nom.trim();
        if (langue !== undefined) contact.langue = langue;
        await contact.save();

        const updated = await Contact.findById(contact._id)
            .populate('region', 'nom')
            .populate('district', 'nom');
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/contacts/:id — supprime un contact et ses conversations
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact introuvable.' });

        await Conversation.updateMany({ contactId: contact._id }, { archivee: true });
        await contact.deleteOne();

        res.json({ message: 'Contact supprimé.' });
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
