import express from 'express';
import Region from '../models/Region.js';
import District from '../models/District.js';
import Structure from '../models/Structure.js';
import Vaccin from '../models/Vaccin.js';
import CalendrierVaccinal from '../models/CalendrierVaccinal.js';
import HausaVocabulaire from '../models/HausaVocabulaire.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.js';
import { reloadHausaVocab } from '../../lib/hausaVocab.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ═══════════════════════════════════════════════════════
// UTILITAIRE — réponse d'erreur uniforme
// ═══════════════════════════════════════════════════════
const err = (res, status, msg) => res.status(status).json({ message: msg });

// ═══════════════════════════════════════════════════════
// RÉGIONS
// ═══════════════════════════════════════════════════════

router.get('/regions', async (req, res) => {
    try {
        const regions = await Region.find().sort({ nom: 1 });
        res.json(regions);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/regions', async (req, res) => {
    try {
        const { nom } = req.body;
        if (!nom?.trim()) return err(res, 400, 'Le nom de la région est requis.');
        const existe = await Region.findOne({ nom: nom.trim() });
        if (existe) return err(res, 409, 'Cette région existe déjà.');
        const region = await Region.create({ nom: nom.trim() });
        res.status(201).json(region);
    } catch (e) { err(res, 500, e.message); }
});

router.put('/regions/:id', async (req, res) => {
    try {
        const { nom } = req.body;
        if (!nom?.trim()) return err(res, 400, 'Le nom est requis.');
        const region = await Region.findByIdAndUpdate(
            req.params.id, { nom: nom.trim() }, { new: true, runValidators: true }
        );
        if (!region) return err(res, 404, 'Région introuvable.');
        res.json(region);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/regions/:id', async (req, res) => {
    try {
        const utilisee = await District.findOne({ regionId: req.params.id });
        if (utilisee) return err(res, 409, 'Impossible de supprimer : des districts utilisent cette région.');
        const region = await Region.findByIdAndDelete(req.params.id);
        if (!region) return err(res, 404, 'Région introuvable.');
        res.json({ message: 'Région supprimée.' });
    } catch (e) { err(res, 500, e.message); }
});

router.post('/regions/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Données invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const nom = row.nom?.trim();
            if (!nom) { skipped++; continue; }
            const existe = await Region.findOne({ nom });
            if (existe) { skipped++; continue; }
            await Region.create({ nom });
            created++;
        }
        res.json({ message: `${created} région(s) importée(s), ${skipped} ignorée(s).` });
    } catch (e) { err(res, 500, e.message); }
});

// ═══════════════════════════════════════════════════════
// DISTRICTS
// ═══════════════════════════════════════════════════════

router.get('/districts', async (req, res) => {
    try {
        const districts = await District.find().populate('regionId', 'nom').sort({ nom: 1 });
        res.json(districts);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/districts', async (req, res) => {
    try {
        const { nom, regionId } = req.body;
        if (!nom?.trim() || !regionId) return err(res, 400, 'Nom et région requis.');
        const region = await Region.findById(regionId);
        if (!region) return err(res, 404, 'Région introuvable.');
        const district = await District.create({ nom: nom.trim(), regionId });
        res.status(201).json(await district.populate('regionId', 'nom'));
    } catch (e) { err(res, 500, e.message); }
});

router.put('/districts/:id', async (req, res) => {
    try {
        const { nom, regionId } = req.body;
        if (!nom?.trim() || !regionId) return err(res, 400, 'Nom et région requis.');
        const district = await District.findByIdAndUpdate(
            req.params.id, { nom: nom.trim(), regionId }, { new: true, runValidators: true }
        ).populate('regionId', 'nom');
        if (!district) return err(res, 404, 'District introuvable.');
        res.json(district);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/districts/:id', async (req, res) => {
    try {
        const utilisee = await Structure.findOne({ districtId: req.params.id });
        if (utilisee) return err(res, 409, 'Impossible de supprimer : des structures utilisent ce district.');
        const district = await District.findByIdAndDelete(req.params.id);
        if (!district) return err(res, 404, 'District introuvable.');
        res.json({ message: 'District supprimé.' });
    } catch (e) { err(res, 500, e.message); }
});

router.post('/districts/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Données invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const nom = row.nom?.trim();
            const nomRegion = row.region?.trim();
            if (!nom || !nomRegion) { skipped++; continue; }
            const region = await Region.findOne({ nom: nomRegion });
            if (!region) { skipped++; continue; }
            const existe = await District.findOne({ nom, regionId: region._id });
            if (existe) { skipped++; continue; }
            await District.create({ nom, regionId: region._id });
            created++;
        }
        res.json({ message: `${created} district(s) importé(s), ${skipped} ignoré(s).` });
    } catch (e) { err(res, 500, e.message); }
});

// ═══════════════════════════════════════════════════════
// STRUCTURES
// ═══════════════════════════════════════════════════════

router.get('/structures', async (req, res) => {
    try {
        const structures = await Structure.find()
            .populate({ path: 'districtId', select: 'nom', populate: { path: 'regionId', select: 'nom' } })
            .sort({ nom: 1 });
        res.json(structures);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/structures', async (req, res) => {
    try {
        const { nom, type, districtId, coordonnees, contactUrgence, statutVaccination } = req.body;
        if (!nom?.trim() || !type || !districtId) return err(res, 400, 'Nom, type et district requis.');
        if (!coordonnees?.latitude || !coordonnees?.longitude) return err(res, 400, 'Coordonnées GPS requises.');
        const district = await District.findById(districtId);
        if (!district) return err(res, 404, 'District introuvable.');
        const structure = await Structure.create({ nom: nom.trim(), type, districtId, coordonnees, contactUrgence, statutVaccination });
        res.status(201).json(await structure.populate({ path: 'districtId', select: 'nom', populate: { path: 'regionId', select: 'nom' } }));
    } catch (e) { err(res, 500, e.message); }
});

router.put('/structures/:id', async (req, res) => {
    try {
        const { nom, type, districtId, coordonnees, contactUrgence, statutVaccination } = req.body;
        if (!nom?.trim() || !type || !districtId) return err(res, 400, 'Nom, type et district requis.');
        const structure = await Structure.findByIdAndUpdate(
            req.params.id,
            { nom: nom.trim(), type, districtId, coordonnees, contactUrgence, statutVaccination },
            { new: true, runValidators: true }
        ).populate({ path: 'districtId', select: 'nom', populate: { path: 'regionId', select: 'nom' } });
        if (!structure) return err(res, 404, 'Structure introuvable.');
        res.json(structure);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/structures/:id', async (req, res) => {
    try {
        const structure = await Structure.findByIdAndDelete(req.params.id);
        if (!structure) return err(res, 404, 'Structure introuvable.');
        res.json({ message: 'Structure supprimée.' });
    } catch (e) { err(res, 500, e.message); }
});

router.post('/structures/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Données invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const nom = row.nom?.trim();
            const type = row.type?.trim();
            const nomDistrict = row.district?.trim();
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);
            if (!nom || !type || !nomDistrict || isNaN(lat) || isNaN(lng)) { skipped++; continue; }
            const district = await District.findOne({ nom: nomDistrict });
            if (!district) { skipped++; continue; }
            const existe = await Structure.findOne({ nom, districtId: district._id });
            if (existe) { skipped++; continue; }
            await Structure.create({ nom, type, districtId: district._id, coordonnees: { latitude: lat, longitude: lng }, contactUrgence: row.contactUrgence });
            created++;
        }
        res.json({ message: `${created} structure(s) importée(s), ${skipped} ignorée(s).` });
    } catch (e) { err(res, 500, e.message); }
});

// ═══════════════════════════════════════════════════════
// VACCINS
// ═══════════════════════════════════════════════════════

router.get('/vaccins', async (req, res) => {
    try {
        const vaccins = await Vaccin.find().sort({ code: 1 });
        res.json(vaccins);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/vaccins', async (req, res) => {
    try {
        const { code, nom, maladiesProtegees, nbDoses, voieAdministration, actif } = req.body;
        if (!code?.trim() || !nom?.trim()) return err(res, 400, 'Code et nom requis.');
        const existe = await Vaccin.findOne({ code: code.trim().toUpperCase() });
        if (existe) return err(res, 409, 'Ce code vaccin existe déjà.');
        const vaccin = await Vaccin.create({ code: code.trim(), nom: nom.trim(), maladiesProtegees, nbDoses, voieAdministration, actif });
        res.status(201).json(vaccin);
    } catch (e) { err(res, 500, e.message); }
});

router.put('/vaccins/:id', async (req, res) => {
    try {
        const { code, nom, maladiesProtegees, nbDoses, voieAdministration, actif } = req.body;
        if (!code?.trim() || !nom?.trim()) return err(res, 400, 'Code et nom requis.');
        const vaccin = await Vaccin.findByIdAndUpdate(
            req.params.id,
            { code: code.trim(), nom: nom.trim(), maladiesProtegees, nbDoses, voieAdministration, actif },
            { new: true, runValidators: true }
        );
        if (!vaccin) return err(res, 404, 'Vaccin introuvable.');
        res.json(vaccin);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/vaccins/:id', async (req, res) => {
    try {
        const utilise = await CalendrierVaccinal.findOne({ vaccinId: req.params.id });
        if (utilise) return err(res, 409, 'Impossible de supprimer : ce vaccin est utilisé dans le calendrier.');
        const vaccin = await Vaccin.findByIdAndDelete(req.params.id);
        if (!vaccin) return err(res, 404, 'Vaccin introuvable.');
        res.json({ message: 'Vaccin supprimé.' });
    } catch (e) { err(res, 500, e.message); }
});

router.post('/vaccins/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Données invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const code = row.code?.trim().toUpperCase();
            const nom = row.nom?.trim();
            if (!code || !nom) { skipped++; continue; }
            const existe = await Vaccin.findOne({ code });
            if (existe) { skipped++; continue; }
            await Vaccin.create({ code, nom, maladiesProtegees: row.maladiesProtegees, nbDoses: row.nbDoses || 1, voieAdministration: row.voieAdministration || 'injectable' });
            created++;
        }
        res.json({ message: `${created} vaccin(s) importé(s), ${skipped} ignoré(s).` });
    } catch (e) { err(res, 500, e.message); }
});

// ═══════════════════════════════════════════════════════
// CALENDRIER VACCINAL
// ═══════════════════════════════════════════════════════
//Get route calendrier vaccinal
router.get('/calendrier', async (req, res) => {
    try {
        const entrees = await CalendrierVaccinal.find()
            .populate('vaccinId', 'code nom')
            .sort({ ageEnSemaines: 1 });
        res.json(entrees);
    } catch (e) { err(res, 500, e.message); }
});

//Ajouter une ligne de calendrier vaccinal
router.post('/calendrier', async (req, res) => {
    try {
        const { vaccinId, ageLabel, ageEnSemaines, cible, notes } = req.body;
        if (!vaccinId || !ageLabel?.trim() || ageEnSemaines == null) return err(res, 400, 'Vaccin, âge (label et semaines) requis.');
        const vaccin = await Vaccin.findById(vaccinId);
        if (!vaccin) return err(res, 404, 'Vaccin introuvable.');
        const entree = await CalendrierVaccinal.create({ vaccinId, ageLabel: ageLabel.trim(), ageEnSemaines, cible, notes });
        res.status(201).json(await entree.populate('vaccinId', 'code nom'));
    } catch (e) { err(res, 500, e.message); }
});

//Modifier une ligne de calendrier vaccinal
router.put('/calendrier/:id', async (req, res) => {
    try {
        const { vaccinId, ageLabel, ageEnSemaines, cible, notes } = req.body;
        if (!vaccinId || !ageLabel?.trim() || ageEnSemaines == null) return err(res, 400, 'Vaccin, âge (label et semaines) requis.');
        const entree = await CalendrierVaccinal.findByIdAndUpdate(
            req.params.id,
            { vaccinId, ageLabel: ageLabel.trim(), ageEnSemaines, cible, notes },
            { new: true, runValidators: true }
        ).populate('vaccinId', 'code nom');
        if (!entree) return err(res, 404, 'Entrée introuvable.');
        res.json(entree);
    } catch (e) { err(res, 500, e.message); }
});

//Supprimer une ligne de calendrier vaccinal
router.delete('/calendrier/:id', async (req, res) => {
    try {
        const entree = await CalendrierVaccinal.findByIdAndDelete(req.params.id);
        if (!entree) return err(res, 404, 'Entrée introuvable.');
        res.json({ message: 'Entrée supprimée.' });
    } catch (e) { err(res, 500, e.message); }
});

// importer le fichier excel calendrier vaccinal
router.post('/calendrier/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Données invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const codeVaccin = row.vaccin?.trim().toUpperCase();
            const ageLabel = row.ageLabel?.trim();
            const ageEnSemaines = parseInt(row.ageEnSemaines);
            if (!codeVaccin || !ageLabel || isNaN(ageEnSemaines)) { skipped++; continue; }
            const vaccin = await Vaccin.findOne({ code: codeVaccin });
            if (!vaccin) { skipped++; continue; }
            await CalendrierVaccinal.create({ vaccinId: vaccin._id, ageLabel, ageEnSemaines, cible: row.cible || 'nourrisson', notes: row.notes });
            created++;
        }
        res.json({ message: `${created} entrée(s) importée(s), ${skipped} ignorée(s).` });
    } catch (e) { err(res, 500, e.message); }
});

// ═══════════════════════════════════════════════════════
// VOCABULAIRE IA (Hausa + Francais)
// ═══════════════════════════════════════════════════════

router.get('/hausa-prompt', async (req, res) => {
    try {
        const entries = await HausaVocabulaire.find().sort({ type: 1, valeur: 1 });
        res.json(entries);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/hausa-prompt', async (req, res) => {
    try {
        const { type, valeur, traduction_fr, categorie } = req.body;
        if (!type || !valeur?.trim()) return err(res, 400, 'Type et valeur sont requis.');
        if (!['mot', 'phrase'].includes(type)) return err(res, 400, 'Type doit etre "mot" ou "phrase".');
        const v = valeur.trim().toLowerCase();
        const existe = await HausaVocabulaire.findOne({ type, valeur: v });
        if (existe) return err(res, 409, 'Cette entree existe deja.');
        const entry = await HausaVocabulaire.create({
            type, valeur: v,
            traduction_fr: traduction_fr?.trim() || '',
            categorie: categorie?.trim() || ''
        });
        await reloadHausaVocab();
        res.status(201).json(entry);
    } catch (e) { err(res, 500, e.message); }
});

router.put('/hausa-prompt/:id', async (req, res) => {
    try {
        const { valeur, traduction_fr, categorie } = req.body;
        if (!valeur?.trim()) return err(res, 400, 'La valeur Hausa est obligatoire.');
        const v = valeur.trim().toLowerCase();
        const entry = await HausaVocabulaire.findByIdAndUpdate(
            req.params.id,
            { valeur: v, traduction_fr: traduction_fr?.trim() || '', categorie: categorie?.trim() || '' },
            { new: true }
        );
        if (!entry) return err(res, 404, 'Entree introuvable.');
        await reloadHausaVocab();
        res.json(entry);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/hausa-prompt/:id', async (req, res) => {
    try {
        const entry = await HausaVocabulaire.findByIdAndDelete(req.params.id);
        if (!entry) return err(res, 404, 'Entree introuvable.');
        await reloadHausaVocab();
        res.json({ message: 'Entree supprimee.' });
    } catch (e) { err(res, 500, e.message); }
});

router.post('/hausa-prompt/import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return err(res, 400, 'Donnees invalides.');
        let created = 0, skipped = 0;
        for (const row of rows) {
            const type         = row.type?.trim().toLowerCase();
            const valeur       = row.valeur?.trim().toLowerCase();
            const traduction_fr = row.traduction_fr?.trim() || '';
            const categorie    = row.categorie?.trim() || '';
            if (!type || !valeur || !['mot', 'phrase'].includes(type)) { skipped++; continue; }
            const existe = await HausaVocabulaire.findOne({ type, valeur });
            if (existe) { skipped++; continue; }
            await HausaVocabulaire.create({ type, valeur, traduction_fr, categorie });
            created++;
        }
        await reloadHausaVocab();
        res.json({ message: `${created} entree(s) importee(s), ${skipped} ignoree(s).` });
    } catch (e) { err(res, 500, e.message); }
});

export default router;
