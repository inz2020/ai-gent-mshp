import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import MobilisationSociale from '../models/MobilisationSociale.js';

const router = express.Router();

// GET /api/mobilisationsociales
router.get('/', requireAuth, async (req, res) => {
    try {
        const items = await MobilisationSociale.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('creePar', 'nom email');
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/mobilisationsociales/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const item = await MobilisationSociale.findById(req.params.id)
            .populate('creePar', 'nom');
        if (!item) return res.status(404).json({ message: 'Mobilisation sociale introuvable.' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/mobilisationsociales
router.post('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { nom, dateDebutMobSoc, dateFinMobSoc } = req.body;
        if (!nom?.trim()) return res.status(400).json({ message: 'Le nom est requis.' });
        if (!dateDebutMobSoc || !dateFinMobSoc) return res.status(400).json({ message: 'Les dates sont requises.' });

        const item = await MobilisationSociale.create({
            nom: nom.trim(),
            dateDebutMobSoc,
            dateFinMobSoc,
            creePar: req.user?._id,
        });
        const populated = await MobilisationSociale.findById(item._id).populate('creePar', 'nom');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/mobilisationsociales/:id
router.put('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const item = await MobilisationSociale.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Mobilisation sociale introuvable.' });

        const { nom, dateDebutMobSoc, dateFinMobSoc } = req.body;
        if (nom !== undefined) item.nom = nom.trim();
        if (dateDebutMobSoc !== undefined) item.dateDebutMobSoc = dateDebutMobSoc;
        if (dateFinMobSoc !== undefined) item.dateFinMobSoc = dateFinMobSoc;
        await item.save();

        const populated = await MobilisationSociale.findById(item._id).populate('creePar', 'nom');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/mobilisationsociales/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const item = await MobilisationSociale.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Mobilisation sociale introuvable.' });
        await item.deleteOne();
        res.json({ message: 'Mobilisation sociale supprimée.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
