import express from 'express';
import axios from 'axios';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Campagne from '../models/Campagne.js';
import Contact from '../models/Contact.js';
import SpotCampagne from '../models/SpotCampagne.js';
import Relais from '../models/Relais.js';
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

// ═══════════════════════════════════════════════════════════════
// SPOTS — routes statiques AVANT /:id pour éviter le conflit
// ═══════════════════════════════════════════════════════════════

// ─── POST /api/campagnes/spots/upload ──────────────────────────
router.post('/spots/upload', requireAuth, requireRole('admin', 'staff'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'video', folder: 'campagne_spots', use_filename: true, unique_filename: true },
                (err, r) => err ? reject(err) : resolve(r)
            ).end(req.file.buffer);
        });
        res.json({ url: result.secure_url, publicId: result.public_id, nom: req.file.originalname });
    } catch (err) {
        res.status(500).json({ message: 'Erreur upload : ' + err.message });
    }
});

// ─── GET /api/campagnes/spots?campagne=:id ──────────────────────
router.get('/spots', requireAuth, async (req, res) => {
    try {
        const { campagne } = req.query;
        if (!campagne) return res.status(400).json({ message: 'campagne requis.' });
        const spots = await SpotCampagne.find({ campagne }).sort({ createdAt: -1 });
        res.json(spots);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/campagnes/spots ──────────────────────────────────
router.post('/spots', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { campagne, nom, langue, audio } = req.body;
        if (!campagne) return res.status(400).json({ message: 'campagne requis.' });
        if (!nom?.trim()) return res.status(400).json({ message: 'Le nom est requis.' });
        if (!langue) return res.status(400).json({ message: 'La langue est requise.' });
        if (!audio?.url) return res.status(400).json({ message: "L'audio est requis." });

        const spot = await SpotCampagne.create({
            campagne, nom: nom.trim(), langue,
            audio: { url: audio.url, publicId: audio.publicId ?? '', nom: audio.nom ?? '' },
            creePar: req.user?._id,
        });
        res.status(201).json(spot);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PUT /api/campagnes/spots/:id ──────────────────────────────
router.put('/spots/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const spot = await SpotCampagne.findById(req.params.id);
        if (!spot) return res.status(404).json({ message: 'Spot introuvable.' });

        const { nom, langue, audio } = req.body;
        if (nom !== undefined) spot.nom = nom.trim();
        if (langue !== undefined) spot.langue = langue;
        if (audio?.url !== undefined) spot.audio = { url: audio.url, publicId: audio.publicId ?? '', nom: audio.nom ?? '' };
        await spot.save();
        res.json(spot);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── DELETE /api/campagnes/spots/:id ───────────────────────────
router.delete('/spots/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const spot = await SpotCampagne.findById(req.params.id);
        if (!spot) return res.status(404).json({ message: 'Spot introuvable.' });
        if (spot.audio?.publicId) {
            cloudinary.uploader.destroy(spot.audio.publicId, { resource_type: 'video' }).catch(() => {});
        }
        await spot.deleteOne();
        res.json({ message: 'Spot supprimé.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/campagnes/spots/:id/diffuser ─────────────────────
router.post('/spots/:id/diffuser', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const spot = await SpotCampagne.findById(req.params.id).populate('campagne');
        if (!spot) return res.status(404).json({ message: 'Spot introuvable.' });
        if (!spot.audio?.url) return res.status(400).json({ message: 'Aucun audio associé à ce spot.' });

        const campagne = spot.campagne;
        if (!campagne?.districts?.length) return res.status(400).json({ message: "La campagne n'a aucun district." });

        const relaisList = await Relais.find({ district: { $in: campagne.districts } }).lean();
        if (!relaisList.length) return res.status(400).json({ message: 'Aucun relais trouvé pour cette campagne.' });

        spot.diffusion.statut    = 'en_cours';
        spot.diffusion.total     = relaisList.length;
        spot.diffusion.envoyes   = 0;
        spot.diffusion.echecs    = 0;
        spot.diffusion.dateEnvoi = new Date();
        spot.diffusion.errorLog  = '';
        await spot.save();

        res.json({ message: `Diffusion lancée vers ${relaisList.length} relais.`, total: relaisList.length });

        // Envoi asynchrone après réponse HTTP
        const META_TOKEN   = process.env.META_TOKEN;
        const PHONE_NUM_ID = process.env.PHONE_NUM_ID;
        let envoyes = 0; let echecs = 0; const errors = [];

        await Promise.allSettled(relaisList.map(async (relais) => {
            const phone = relais.telephone?.replace(/\D/g, '');
            if (!phone) { echecs++; errors.push(`Relais ${relais.nom}: pas de téléphone`); return; }
            try {
                await axios.post(
                    `https://graph.facebook.com/v22.0/${PHONE_NUM_ID}/messages`,
                    {
                        messaging_product: 'whatsapp',
                        to: phone,
                        type: 'audio',
                        audio: { link: spot.audio.url },
                    },
                    { headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' } }
                );
                envoyes++;
            } catch (err) {
                echecs++;
                errors.push(`${relais.nom}: ${err.response?.data?.error?.message ?? err.message}`);
            }
        }));

        spot.diffusion.statut   = echecs === relaisList.length ? 'erreur' : 'termine';
        spot.diffusion.envoyes  = envoyes;
        spot.diffusion.echecs   = echecs;
        spot.diffusion.errorLog = errors.slice(0, 10).join(' | ');
        await spot.save();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// CAMPAGNES — routes paramétrées /:id après les routes statiques
// ═══════════════════════════════════════════════════════════════

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
        if (campagne.statut === 'terminee') return res.status(400).json({ message: 'Impossible de modifier une campagne terminée.' });

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
        if (campagne.statut === 'terminee') return res.status(400).json({ message: 'Impossible de supprimer une campagne terminée.' });
        await campagne.deleteOne();
        res.json({ message: 'Campagne supprimée.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/campagnes/:id/envoyer ───────────────────────────
router.post('/:id/envoyer', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const campagne = await Campagne.findById(req.params.id).populate('districts', '_id nom');
        if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
        if (campagne.statut === 'en_cours') return res.status(400).json({ message: 'Déjà en cours.' });
        if (campagne.statut === 'terminee') return res.status(400).json({ message: 'Campagne déjà terminée.' });

        const districtIds = campagne.districts.map(d => d._id);
        const query = districtIds.length > 0
            ? { district: { $in: districtIds }, bloque: { $ne: true } }
            : { bloque: { $ne: true } };

        const contacts = await Contact.find(query).select('whatsappId');
        if (!contacts.length) return res.status(400).json({ message: 'Aucun contact trouvé pour ces districts.' });

        campagne.statut    = 'en_cours';
        campagne.nbCibles  = contacts.length;
        campagne.nbEnvoyes = 0;
        campagne.nbEchecs  = 0;
        await campagne.save();

        res.json({ message: `Envoi lancé vers ${contacts.length} contacts.`, nbCibles: contacts.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
