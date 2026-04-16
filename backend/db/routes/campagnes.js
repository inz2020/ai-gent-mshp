import express from 'express';
import axios from 'axios';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Campagne from '../models/Campagne.js';
import Contact from '../models/Contact.js';
import District from '../models/District.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const CLOUDINARY_CFG = {
    audio:    { resource_type: 'video', folder: 'campagne_audio' },
    video:    { resource_type: 'video', folder: 'campagne_video' },
    image:    { resource_type: 'image', folder: 'campagne_images' },
    document: { resource_type: 'raw',   folder: 'campagne_documents' },
};

// ─── POST /api/campagnes/upload ─────────────────────────────────
router.post('/upload', requireAuth, requireRole('admin', 'staff'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });
    const mediaType = req.body.mediaType ?? 'audio';
    const cfg = CLOUDINARY_CFG[mediaType] ?? CLOUDINARY_CFG.audio;
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { ...cfg, use_filename: true, unique_filename: true },
                (err, r) => err ? reject(err) : resolve(r)
            ).end(req.file.buffer);
        });
        res.json({ url: result.secure_url, publicId: result.public_id, nom: req.file.originalname, mediaType });
    } catch (err) {
        res.status(500).json({ message: 'Erreur upload : ' + err.message });
    }
});

// ─── GET /api/campagnes ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const campagnes = await Campagne.find()
            .populate('districts', 'nom')
            .populate('creePar', 'nom')
            .sort({ createdAt: -1 });
        res.json(campagnes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/campagnes/:id ─────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const c = await Campagne.findById(req.params.id)
            .populate('districts', 'nom')
            .populate('creePar', 'nom');
        if (!c) return res.status(404).json({ message: 'Campagne introuvable.' });
        res.json(c);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/campagnes ────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { nom, type, produit, dateDebut, dateFin, districts } = req.body;

        if (!nom?.trim())   return res.status(400).json({ message: 'Le nom est requis.' });
        if (!type)          return res.status(400).json({ message: 'Le type est requis.' });
        if (!dateDebut || !dateFin) return res.status(400).json({ message: 'Les dates sont requises.' });

        const campagne = await Campagne.create({
            nom: nom.trim(), type, produit, dateDebut, dateFin,
            districts: districts ?? [],
            creePar: req.user?._id,
        });

        const populated = await Campagne.findById(campagne._id)
            .populate('districts', 'nom').populate('creePar', 'nom');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PUT /api/campagnes/:id ─────────────────────────────────────
router.put('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const campagne = await Campagne.findById(req.params.id);
        if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
        if (campagne.statut === 'en_cours') return res.status(400).json({ message: 'Impossible de modifier une campagne en cours.' });

        const fields = ['nom', 'type', 'produit', 'dateDebut', 'dateFin', 'districts', 'statut'];
        fields.forEach(f => { if (req.body[f] !== undefined) campagne[f] = req.body[f]; });
        await campagne.save();

        const populated = await Campagne.findById(campagne._id)
            .populate('districts', 'nom').populate('creePar', 'nom');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── DELETE /api/campagnes/:id ──────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const campagne = await Campagne.findById(req.params.id);
        if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
        if (campagne.statut === 'en_cours') return res.status(400).json({ message: 'Impossible de supprimer une campagne en cours.' });
        await campagne.deleteOne();
        res.json({ message: 'Campagne supprimée.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/campagnes/:id/envoyer ───────────────────────────
// Lance l'envoi de masse vers tous les contacts des districts sélectionnés
router.post('/:id/envoyer', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const campagne = await Campagne.findById(req.params.id).populate('districts', '_id nom');
        if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
        if (campagne.statut === 'en_cours') return res.status(400).json({ message: 'Déjà en cours.' });
        if (campagne.statut === 'terminee') return res.status(400).json({ message: 'Campagne déjà terminée.' });

        // Trouver les contacts des districts sélectionnés
        const districtIds = campagne.districts.map(d => d._id);
        const query = districtIds.length > 0
            ? { district: { $in: districtIds }, bloque: { $ne: true } }
            : { bloque: { $ne: true } };

        const contacts = await Contact.find(query).select('whatsappId');
        if (!contacts.length) return res.status(400).json({ message: 'Aucun contact trouvé pour ces districts.' });

        campagne.statut   = 'en_cours';
        campagne.nbCibles = contacts.length;
        campagne.nbEnvoyes = 0;
        campagne.nbEchecs  = 0;
        await campagne.save();

        res.json({ message: `Envoi lancé vers ${contacts.length} contacts.`, nbCibles: contacts.length });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
