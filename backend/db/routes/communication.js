import express from 'express'
import District from '../models/District.js'
import { requireAuth, requireAdmin } from '../../middlewares/auth.js'
import AgentCom from '../models/AgentCom.js'
import Contact from '../models/Contact.js'
import Relais from '../models/Relais.js'
import Structure from '../models/Structure.js'
import MobilisationSociale from '../models/MobilisationSociale.js'
import ReunionPlaidoyer from '../models/ReunionPlaidoyer.js'

const router = express.Router()
router.use(requireAuth, requireAdmin)

const err = (res, status, msg) => res.status(status).json({ message: msg })

// GET — liste des agents communicateurs
router.get('/agent-comm', async (req, res) => {
    try {
        const agentComms = await AgentCom.find()
            .populate('district', 'nom')
            .populate('contact', 'whatsappId nom')
            .sort({ nom: 1 })
        res.json(agentComms)
    } catch (error) {
        err(res, 500, error.message)
    }
})

// POST — créer un agent communicateur
router.post('/agent-comm', async (req, res) => {
    try {
        const { nom, districtId, contactId, statut, dateService } = req.body
        if (!nom?.trim()) return err(res, 400, 'Le nom du communicateur est requis')

        const existe = await AgentCom.findOne({ nom: nom.trim() })
        if (existe) return err(res, 409, 'Ce nom existe déjà')

        if (districtId) {
            const district = await District.findById(districtId)
            if (!district) return err(res, 404, 'District introuvable')
        }

        if (contactId) {
            const contact = await Contact.findById(contactId)
            if (!contact) return err(res, 404, 'Contact introuvable')
        }

        const agentComm = await AgentCom.create({
            nom: nom.trim(),
            district: districtId || undefined,
            contact: contactId || undefined,
            statut: statut || 'Autre',
            dateService: dateService || undefined,
        })

        const populated = await AgentCom.findById(agentComm._id)
            .populate('district', 'nom')
            .populate('contact', 'whatsappId nom')

        res.status(201).json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

// PUT — modifier un agent communicateur
router.put('/agent-comm/:id', async (req, res) => {
    try {
        const { nom, districtId, contactId, statut, dateService } = req.body

        const agentComm = await AgentCom.findById(req.params.id)
        if (!agentComm) return err(res, 404, 'Communicateur introuvable')

        if (nom?.trim() && nom.trim() !== agentComm.nom) {
            const existe = await AgentCom.findOne({ nom: nom.trim(), _id: { $ne: req.params.id } })
            if (existe) return err(res, 409, 'Ce nom existe déjà')
            agentComm.nom = nom.trim()
        }

        if (districtId !== undefined) agentComm.district = districtId || undefined
        if (contactId  !== undefined) agentComm.contact  = contactId  || undefined
        if (statut)                   agentComm.statut    = statut
        if (dateService)              agentComm.dateService = dateService

        await agentComm.save()

        const populated = await AgentCom.findById(agentComm._id)
            .populate('district', 'nom')
            .populate('contact', 'whatsappId nom')

        res.json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

// DELETE — supprimer un agent communicateur
router.delete('/agent-comm/:id', async (req, res) => {
    try {
        const agentComm = await AgentCom.findById(req.params.id)
        if (!agentComm) return err(res, 404, 'Communicateur introuvable')
        await agentComm.deleteOne()
        res.json({ message: 'Communicateur supprimé avec succès' })
    } catch (error) {
        err(res, 500, error.message)
    }
})

// ═══════════════════════════════════════════════════════
// RELAIS
// ═══════════════════════════════════════════════════════

router.get('/relais', async (_req, res) => {
    try {
        const relais = await Relais.find()
            .populate('contact', 'whatsappId nom')
            .populate('district', 'nom')
            .populate('structureSanitaire', 'nom')
            .sort({ nom: 1 })
        res.json(relais)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.post('/relais', async (req, res) => {
    try {
        const { nom, contactId, districtId, structureSanitaireId, nbreAnneesExperience, typeRelais } = req.body
        if (!nom?.trim()) return err(res, 400, 'Le nom du relais est requis')

        const existe = await Relais.findOne({ nom: nom.trim() })
        if (existe) return err(res, 409, 'Ce nom existe déjà')

        const relais = await Relais.create({
            nom: nom.trim(),
            contact:            contactId             || undefined,
            district:           districtId            || undefined,
            structureSanitaire: structureSanitaireId  || undefined,
            nbreAnneesExperience: nbreAnneesExperience ?? 0,
            typeRelais:         typeRelais             || 'RCom',
        })

        const populated = await Relais.findById(relais._id)
            .populate('contact', 'whatsappId nom')
            .populate('district', 'nom')
            .populate('structureSanitaire', 'nom')

        res.status(201).json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.put('/relais/:id', async (req, res) => {
    try {
        const relais = await Relais.findById(req.params.id)
        if (!relais) return err(res, 404, 'Relais introuvable')

        const { nom, contactId, districtId, structureSanitaireId, nbreAnneesExperience, typeRelais } = req.body

        if (nom?.trim() && nom.trim() !== relais.nom) {
            const existe = await Relais.findOne({ nom: nom.trim(), _id: { $ne: req.params.id } })
            if (existe) return err(res, 409, 'Ce nom existe déjà')
            relais.nom = nom.trim()
        }

        if (contactId            !== undefined) relais.contact            = contactId            || undefined
        if (districtId           !== undefined) relais.district           = districtId           || undefined
        if (structureSanitaireId !== undefined) relais.structureSanitaire = structureSanitaireId || undefined
        if (nbreAnneesExperience !== undefined) relais.nbreAnneesExperience = nbreAnneesExperience
        if (typeRelais)                         relais.typeRelais          = typeRelais

        await relais.save()

        const populated = await Relais.findById(relais._id)
            .populate('contact', 'whatsappId nom')
            .populate('district', 'nom')
            .populate('structureSanitaire', 'nom')

        res.json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.delete('/relais/:id', async (req, res) => {
    try {
        const relais = await Relais.findById(req.params.id)
        if (!relais) return err(res, 404, 'Relais introuvable')
        await relais.deleteOne()
        res.json({ message: 'Relais supprimé avec succès' })
    } catch (error) {
        err(res, 500, error.message)
    }
})

// ═══════════════════════════════════════════════════════
// SENSIBILISATION COMMUNAUTAIRE (MobilisationSociale)
// ═══════════════════════════════════════════════════════

router.get('/sensibilisation', async (_req, res) => {
    try {
        const items = await MobilisationSociale.find()
            .populate('creePar', 'nom email')
            .sort({ createdAt: -1 })
        res.json(items)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.post('/sensibilisation', async (req, res) => {
    try {
        const { nom, dateDebutMobSoc, dateFinMobSoc } = req.body
        if (!nom?.trim())          return err(res, 400, 'Le nom est requis')
        if (!dateDebutMobSoc)      return err(res, 400, 'La date de début est requise')
        if (!dateFinMobSoc)        return err(res, 400, 'La date de fin est requise')
        if (new Date(dateDebutMobSoc) > new Date(dateFinMobSoc))
            return err(res, 400, 'La date de début doit être avant la date de fin')

        const item = await MobilisationSociale.create({
            nom: nom.trim(),
            dateDebutMobSoc,
            dateFinMobSoc,
            creePar: req.user?.id || undefined,
        })

        const populated = await MobilisationSociale.findById(item._id).populate('creePar', 'nom email')
        res.status(201).json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.put('/sensibilisation/:id', async (req, res) => {
    try {
        const item = await MobilisationSociale.findById(req.params.id)
        if (!item) return err(res, 404, 'Sensibilisation introuvable')

        const { nom, dateDebutMobSoc, dateFinMobSoc } = req.body
        const debut = dateDebutMobSoc ? new Date(dateDebutMobSoc) : item.dateDebutMobSoc
        const fin   = dateFinMobSoc   ? new Date(dateFinMobSoc)   : item.dateFinMobSoc
        if (debut > fin) return err(res, 400, 'La date de début doit être avant la date de fin')

        if (nom?.trim())      item.nom             = nom.trim()
        if (dateDebutMobSoc)  item.dateDebutMobSoc = dateDebutMobSoc
        if (dateFinMobSoc)    item.dateFinMobSoc   = dateFinMobSoc

        await item.save()
        const populated = await MobilisationSociale.findById(item._id).populate('creePar', 'nom email')
        res.json(populated)
    } catch (error) {
        err(res, 500, error.message)
    }
})

router.delete('/sensibilisation/:id', async (req, res) => {
    try {
        const item = await MobilisationSociale.findById(req.params.id)
        if (!item) return err(res, 404, 'Sensibilisation introuvable')
        await item.deleteOne()
        res.json({ message: 'Sensibilisation supprimée avec succès' })
    } catch (error) {
        err(res, 500, error.message)
    }
})

// ═══════════════════════════════════════════════════════
// RÉUNIONS / PLAIDOYERS (liés à une campagne)
// ═══════════════════════════════════════════════════════

router.get('/reunion-plaidoyer', async (req, res) => {
    try {
        const filter = {};
        if (req.query.campagne) filter.campagne = req.query.campagne;
        const items = await ReunionPlaidoyer.find(filter)
            .populate('district', 'nom')
            .populate('campagne', 'nom')
            .populate('creePar', 'nom')
            .sort({ date: 1, createdAt: -1 });
        res.json(items);
    } catch (e) { err(res, 500, e.message); }
});

router.post('/reunion-plaidoyer', async (req, res) => {
    try {
        const { nom, type, date, lieu, districtId, nbParticipants, description, campagneId } = req.body;
        if (!nom?.trim())  return err(res, 400, 'Le nom est requis');
        if (!campagneId)   return err(res, 400, 'La campagne est requise');

        const item = await ReunionPlaidoyer.create({
            nom: nom.trim(),
            type: type || 'Réunion',
            date: date || undefined,
            lieu: lieu || '',
            district: districtId || undefined,
            nbParticipants: nbParticipants || 0,
            description: description || '',
            campagne: campagneId,
            creePar: req.user?.id || undefined,
        });

        const populated = await ReunionPlaidoyer.findById(item._id)
            .populate('district', 'nom')
            .populate('campagne', 'nom')
            .populate('creePar', 'nom');
        res.status(201).json(populated);
    } catch (e) { err(res, 500, e.message); }
});

router.put('/reunion-plaidoyer/:id', async (req, res) => {
    try {
        const item = await ReunionPlaidoyer.findById(req.params.id);
        if (!item) return err(res, 404, 'Réunion/Plaidoyer introuvable');

        const { nom, type, date, lieu, districtId, nbParticipants, description } = req.body;
        if (nom?.trim())              item.nom            = nom.trim();
        if (type)                     item.type           = type;
        if (date !== undefined)       item.date           = date || undefined;
        if (lieu !== undefined)       item.lieu           = lieu;
        if (districtId !== undefined) item.district       = districtId || undefined;
        if (nbParticipants !== undefined) item.nbParticipants = Number(nbParticipants);
        if (description !== undefined) item.description   = description;

        await item.save();
        const populated = await ReunionPlaidoyer.findById(item._id)
            .populate('district', 'nom')
            .populate('campagne', 'nom')
            .populate('creePar', 'nom');
        res.json(populated);
    } catch (e) { err(res, 500, e.message); }
});

router.delete('/reunion-plaidoyer/:id', async (req, res) => {
    try {
        const item = await ReunionPlaidoyer.findById(req.params.id);
        if (!item) return err(res, 404, 'Réunion/Plaidoyer introuvable');
        await item.deleteOne();
        res.json({ message: 'Réunion/Plaidoyer supprimé(e) avec succès' });
    } catch (e) { err(res, 500, e.message); }
});

export default router
