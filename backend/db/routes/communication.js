import express from 'express'
import axios from 'axios'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import District from '../models/District.js'
import { requireAuth, requireAdmin } from '../../middlewares/auth.js'
import AgentCom from '../models/AgentCom.js'
import Contact from '../models/Contact.js'
import Relais from '../models/Relais.js'
import Structure from '../models/Structure.js'
import MobilisationSociale from '../models/MobilisationSociale.js'
import ReunionPlaidoyer from '../models/ReunionPlaidoyer.js'
import MobilisationRelais from '../models/MobilisationRelais.js'
import WhatsappTemplate from '../models/WhatsappTemplate.js'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

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
        const { nom, telephone, contactId, districtId, structureSanitaireId, nbreAnneesExperience, typeRelais } = req.body
        if (!nom?.trim()) return err(res, 400, 'Le nom du relais est requis')

        const existe = await Relais.findOne({ nom: nom.trim() })
        if (existe) return err(res, 409, 'Ce nom existe déjà')

        const relais = await Relais.create({
            nom: nom.trim(),
            telephone:          telephone?.trim()     || '',
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

        const { nom, telephone, contactId, districtId, structureSanitaireId, nbreAnneesExperience, typeRelais } = req.body

        if (nom?.trim() && nom.trim() !== relais.nom) {
            const existe = await Relais.findOne({ nom: nom.trim(), _id: { $ne: req.params.id } })
            if (existe) return err(res, 409, 'Ce nom existe déjà')
            relais.nom = nom.trim()
        }

        if (telephone            !== undefined) relais.telephone          = telephone?.trim()    || ''
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

// ═══════════════════════════════════════════════════════
// MOBILISATION RELAIS PAR DISTRICT
// ═══════════════════════════════════════════════════════

// POST /mobilisation-relais/upload — upload audio Cloudinary
router.post('/mobilisation-relais/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return err(res, 400, 'Aucun fichier reçu.')
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'video', folder: 'mobilisation_audio', use_filename: true, unique_filename: true },
                (e, r) => e ? reject(e) : resolve(r)
            ).end(req.file.buffer)
        })
        res.json({ url: result.secure_url, publicId: result.public_id, nom: req.file.originalname })
    } catch (e) { err(res, 500, 'Erreur upload : ' + e.message) }
})

// ── Templates WhatsApp CRUD ───────────────────────────────────
router.get('/templates', async (_req, res) => {
    try {
        const templates = await WhatsappTemplate.find().sort({ nom: 1 })
        res.json(templates)
    } catch (e) { err(res, 500, e.message) }
})

router.post('/templates', async (req, res) => {
    try {
        const { nom, templateName, langue, description, statut, typeContenu, variablesCorps, variablesEntete, valeursCorps, valeursEntete, urlMedia, nomFichier } = req.body
        if (!nom?.trim())          return err(res, 400, 'Le nom est requis')
        if (!templateName?.trim()) return err(res, 400, 'Le nom du template Meta est requis')
        const nbCorps  = Number(variablesCorps  ?? 0)
        const nbEntete = Number(variablesEntete ?? 0)
        const tpl = await WhatsappTemplate.create({
            nom: nom.trim(),
            templateName: templateName.trim(),
            langue: langue?.trim() || 'fr',
            description: description?.trim() || '',
            statut: statut || 'actif',
            typeContenu:     typeContenu || 'audio',
            variablesCorps:  nbCorps,
            variablesEntete: nbEntete,
            valeursCorps:    (Array.isArray(valeursCorps)  ? valeursCorps  : []).slice(0, nbCorps),
            valeursEntete:   (Array.isArray(valeursEntete) ? valeursEntete : []).slice(0, nbEntete),
            urlMedia:   urlMedia?.trim()   || '',
            nomFichier: nomFichier?.trim() || 'document.pdf',
        })
        res.status(201).json(tpl)
    } catch (e) {
        if (e.code === 11000) return err(res, 409, 'Ce template (nom + langue) existe déjà')
        err(res, 500, e.message)
    }
})

router.put('/templates/:id', async (req, res) => {
    try {
        const { nom, templateName, langue, description, statut, typeContenu, variablesCorps, variablesEntete, valeursCorps, valeursEntete, urlMedia, nomFichier } = req.body
        const tpl = await WhatsappTemplate.findById(req.params.id)
        if (!tpl) return err(res, 404, 'Template introuvable')
        if (nom             !== undefined) tpl.nom             = nom.trim()
        if (templateName    !== undefined) tpl.templateName    = templateName.trim()
        if (langue          !== undefined) tpl.langue          = langue.trim()
        if (description     !== undefined) tpl.description     = description.trim()
        if (statut          !== undefined) tpl.statut          = statut
        if (typeContenu     !== undefined) tpl.typeContenu     = typeContenu
        if (variablesCorps  !== undefined) tpl.variablesCorps  = Number(variablesCorps)
        if (variablesEntete !== undefined) tpl.variablesEntete = Number(variablesEntete)
        if (valeursCorps    !== undefined) tpl.valeursCorps    = (Array.isArray(valeursCorps)  ? valeursCorps  : []).slice(0, tpl.variablesCorps)
        if (valeursEntete   !== undefined) tpl.valeursEntete   = (Array.isArray(valeursEntete) ? valeursEntete : []).slice(0, tpl.variablesEntete)
        if (urlMedia        !== undefined) tpl.urlMedia        = urlMedia.trim()
        if (nomFichier      !== undefined) tpl.nomFichier      = nomFichier.trim() || 'document.pdf'
        await tpl.save()
        res.json(tpl)
    } catch (e) {
        if (e.code === 11000) return err(res, 409, 'Ce template (nom + langue) existe déjà')
        err(res, 500, e.message)
    }
})

router.delete('/templates/:id', async (req, res) => {
    try {
        await WhatsappTemplate.findByIdAndDelete(req.params.id)
        res.json({ message: 'Template supprimé' })
    } catch (e) { err(res, 500, e.message) }
})

// GET /mobilisation-relais?campagne=:id
router.get('/mobilisation-relais', async (req, res) => {
    const { campagne } = req.query
    if (!campagne) return err(res, 400, 'campagne requis')
    try {
        const records = await MobilisationRelais.find({ campagne })
            .populate('district', 'nom')
            .populate('relais', 'nom telephone typeRelais')
            .populate('template', 'nom templateName langue')
        res.json(records)
    } catch (e) { err(res, 500, e.message) }
})

// POST /mobilisation-relais
router.post('/mobilisation-relais', async (req, res) => {
    const { campagneId, districtId, relaisIds, concessionsVisitees, personnesTouchees, messageAudio, templateId } = req.body
    if (!campagneId || !districtId) return err(res, 400, 'campagneId et districtId requis')
    try {
        const record = await MobilisationRelais.create({
            campagne: campagneId,
            district: districtId,
            relais:   relaisIds ?? [],
            concessionsVisitees: concessionsVisitees ?? 0,
            personnesTouchees:   personnesTouchees   ?? 0,
            messageAudio: messageAudio ?? { url: '', nom: '', publicId: '' },
            template: templateId || null,
        })
        const populated = await MobilisationRelais.findById(record._id)
            .populate('district', 'nom')
            .populate('relais', 'nom telephone typeRelais')
            .populate('template', 'nom templateName langue')
        res.status(201).json(populated)
    } catch (e) {
        if (e.code === 11000) return err(res, 409, 'Un enregistrement existe déjà pour ce district dans cette campagne')
        err(res, 500, e.message)
    }
})

// PUT /mobilisation-relais/:id
router.put('/mobilisation-relais/:id', async (req, res) => {
    try {
        const record = await MobilisationRelais.findById(req.params.id)
        if (!record) return err(res, 404, 'Enregistrement introuvable')
        const { relaisIds, concessionsVisitees, personnesTouchees, messageAudio, templateId } = req.body
        if (relaisIds            !== undefined) record.relais              = relaisIds
        if (concessionsVisitees  !== undefined) record.concessionsVisitees = concessionsVisitees
        if (personnesTouchees    !== undefined) record.personnesTouchees   = personnesTouchees
        if (messageAudio         !== undefined) record.messageAudio        = messageAudio
        if (templateId           !== undefined) record.template            = templateId || null
        await record.save()
        const populated = await MobilisationRelais.findById(record._id)
            .populate('district', 'nom')
            .populate('relais', 'nom telephone typeRelais')
            .populate('template', 'nom templateName langue')
        res.json(populated)
    } catch (e) { err(res, 500, e.message) }
})

// DELETE /mobilisation-relais/:id
router.delete('/mobilisation-relais/:id', async (req, res) => {
    try {
        const record = await MobilisationRelais.findById(req.params.id)
        if (!record) return err(res, 404, 'Enregistrement introuvable')
        await record.deleteOne()
        res.json({ message: 'Enregistrement supprimé.' })
    } catch (e) { err(res, 500, e.message) }
})

// ═══════════════════════════════════════════════════════
// DIFFUSION AUDIO WHATSAPP — RELAIS PAR DISTRICT
// ═══════════════════════════════════════════════════════

const WA_BATCH_SIZE  = 5
const WA_BATCH_DELAY = 600  // ms entre chaque batch

// ── Résolution du numéro WhatsApp d'un relais ─────────────────
function resolvePhone(relais) {
    const raw = relais.contact?.whatsappId || relais.telephone || ''
    const cleaned = raw.replace(/\s+/g, '').replace(/^\+/, '')
    return cleaned.length >= 8 ? cleaned : null
}

// ── Envoi d'un template (avec composants selon typeContenu) puis du média ──
// audioUrl    = URL du fichier MP3 à envoyer en message audio (depuis la mobilisation)
// headerMediaUrl = URL du media pour le header du template (image/document, depuis la config template)
async function envoyerAudioRelais(phone, audioUrl, headerMediaUrl, headers, tplName, tplLang, typeContenu, valeursCorps, valeursEntete) {
    const templateName = tplName || process.env.WA_INVITE_TEMPLATE || 'hello_world'
    const templateLang = tplLang || process.env.WA_INVITE_TEMPLATE_LANG_FR || 'fr'
    const type         = typeContenu || 'aucun'
    const phoneId      = process.env.PHONE_ID
    const base         = `https://graph.facebook.com/v22.0/${phoneId}/messages`

    // Valider que le media header est fourni si requis
    if ((type === 'image' || type === 'document') && !headerMediaUrl) {
        throw new Error(`Template "${templateName}" requiert un header ${type} mais aucune URL media n'est configurée dans le template.`)
    }

    // Construire les composants header du template selon son type
    let components = []
    if (type === 'image' && headerMediaUrl) {
        components.push({ type: 'header', parameters: [{ type: 'image', image: { link: headerMediaUrl } }] })
    } else if (type === 'document' && headerMediaUrl) {
        components.push({ type: 'header', parameters: [{ type: 'document', document: { link: headerMediaUrl, filename: 'document.pdf' } }] })
    } else if (type === 'texte' && valeursEntete?.length > 0) {
        components.push({ type: 'header', parameters: valeursEntete.map(v => ({ type: 'text', text: v || '' })) })
    }
    if (valeursCorps?.length > 0) {
        components.push({ type: 'body', parameters: valeursCorps.map(v => ({ type: 'text', text: v || '' })) })
    }

    console.log(`[ENV_AUDIO] phone=${phone} tplType=${type} tpl=${templateName}/${templateLang} audioUrl=${audioUrl || '(vide)'} headerMedia=${headerMediaUrl || '(vide)'}`)

    // Étape 1 — Template WhatsApp (ouvre la fenêtre 24h)
    const r1 = await axios.post(base, {
        messaging_product: 'whatsapp',
        to:   phone,
        type: 'template',
        template: {
            name:     templateName,
            language: { code: templateLang },
            ...(components.length ? { components } : {}),
        },
    }, { headers })
    console.log(`[ENV_AUDIO] étape1 template wamid=${r1.data?.messages?.[0]?.id ?? 'inconnu'}`)

    // Étape 2 — Envoi du fichier audio en message séparé (toujours, quelle que soit le type du header template)
    if (!audioUrl) throw new Error('Audio URL manquante — impossible d\'envoyer le fichier audio')
    console.log(`[ENV_AUDIO] étape2 envoi audio → ${audioUrl}`)
    const r2 = await axios.post(base, {
        messaging_product: 'whatsapp',
        to:   phone,
        type: 'audio',
        audio: { link: audioUrl },
    }, { headers })
    console.log(`[ENV_AUDIO] étape2 audio wamid=${r2.data?.messages?.[0]?.id ?? 'inconnu'}`)
}

// ── Moteur d'envoi en arrière-plan ────────────────────────────
async function diffuserAudioDistrict(record, targets) {
    const headers = {
        Authorization: `Bearer ${process.env.META_TOKEN}`,
        'Content-Type': 'application/json',
    }
    // audioUrl = fichier MP3 uploadé dans la mobilisation (toujours envoyé en étape 2)
    const audioUrl = record.messageAudio?.url || ''

    // Résoudre le template associé au record (ou fallback env)
    let tplName = null, tplLang = null, tplType = 'aucun', tplValeursCorps = [], tplValeursEntete = [], tplHeaderMedia = ''
    if (record.template) {
        const tpl = await WhatsappTemplate.findById(record.template).lean()
        if (tpl) {
            tplName        = tpl.templateName
            tplLang        = tpl.langue
            tplType        = tpl.typeContenu || 'aucun'
            tplValeursCorps  = tpl.valeursCorps  || []
            tplValeursEntete = tpl.valeursEntete || []
            // URL media pour le HEADER du template (image/document) — distinct de l'audio à diffuser
            tplHeaderMedia = tpl.urlMedia || ''
        }
    }

    console.log(`[DIFFUSION] audioUrl=${audioUrl || '(vide)'} tplHeaderMedia=${tplHeaderMedia || '(vide)'}`)

    let envoyes = 0, echecs = 0

    for (let i = 0; i < targets.length; i += WA_BATCH_SIZE) {
        const batch = targets.slice(i, i + WA_BATCH_SIZE)

        const results = await Promise.allSettled(
            batch.map(t => envoyerAudioRelais(t.phone, audioUrl, tplHeaderMedia, headers, tplName, tplLang, tplType, tplValeursCorps, tplValeursEntete))
        )

        for (let j = 0; j < results.length; j++) {
            if (results[j].status === 'fulfilled') {
                envoyes++
                console.log(`[DIFFUSION] ok +${batch[j].phone}`)
            } else {
                echecs++
                const msg = results[j].reason?.response?.data?.error?.message ?? results[j].reason?.message ?? 'unknown'
                console.error(`[DIFFUSION] fail +${batch[j].phone}: ${msg}`)
            }
        }

        await MobilisationRelais.findByIdAndUpdate(record._id, {
            'diffusion.envoyes': envoyes,
            'diffusion.echecs':  echecs,
        })

        if (i + WA_BATCH_SIZE < targets.length) {
            await new Promise(r => setTimeout(r, WA_BATCH_DELAY))
        }
    }

    const statut = echecs === targets.length ? 'erreur' : 'termine'
    await MobilisationRelais.findByIdAndUpdate(record._id, {
        'diffusion.statut':  statut,
        'diffusion.envoyes': envoyes,
        'diffusion.echecs':  echecs,
    })
    console.log(`[DIFFUSION] district ${record.district} — ${envoyes} ok, ${echecs} fail`)
}

// ── POST /mobilisation-relais/campagne/:campagneId/diffuser-tout ─
// (défini AVANT /:id/diffuser pour éviter le conflit de paramètre)
router.post('/mobilisation-relais/campagne/:campagneId/diffuser-tout', async (req, res) => {
    try {
        const records = await MobilisationRelais.find({
            campagne: req.params.campagneId,
            'messageAudio.url': { $nin: [null, ''] },
        }).populate({
            path: 'relais',
            select: 'nom telephone contact',
            populate: { path: 'contact', select: 'whatsappId' },
        })

        if (!records.length)
            return err(res, 400, 'Aucun district configuré avec un message audio.')

        const enCours = records.filter(r => r.diffusion?.statut === 'en_cours')
        if (enCours.length)
            return err(res, 409, `${enCours.length} district(s) déjà en cours d'envoi.`)

        let totalCibles = 0
        let districtLances = 0

        for (const record of records) {
            const targets = record.relais
                .map(r => ({ nom: r.nom, phone: resolvePhone(r) }))
                .filter(t => t.phone)

            if (!targets.length) continue

            record.diffusion = {
                statut: 'en_cours', total: targets.length,
                envoyes: 0, echecs: 0, dateEnvoi: new Date(), errorLog: '',
            }
            await record.save()

            totalCibles += targets.length
            districtLances++
            diffuserAudioDistrict(record, targets).catch(e =>
                console.error('[DIFFUSION-TOUT]', e.message))
        }

        if (!districtLances)
            return err(res, 400, 'Aucun relais avec un numéro WhatsApp valide dans les districts configurés.')

        res.json({
            message: `Diffusion lancée vers ${totalCibles} relais sur ${districtLances} district(s).`,
            total: totalCibles, districts: districtLances,
        })
    } catch (e) { err(res, 500, e.message) }
})

// ── POST /mobilisation-relais/:id/diffuser ────────────────────
router.post('/mobilisation-relais/:id/diffuser', async (req, res) => {
    try {
        const record = await MobilisationRelais.findById(req.params.id)
            .populate({
                path: 'relais',
                select: 'nom telephone contact',
                populate: { path: 'contact', select: 'whatsappId' },
            })

        if (!record)                   return err(res, 404, 'Enregistrement introuvable.')
        if (!record.messageAudio?.url) return err(res, 400, 'Aucun message audio configuré pour ce district.')
        if (!record.relais?.length)    return err(res, 400, 'Aucun relais assigné à ce district.')
        if (record.diffusion?.statut === 'en_cours')
            return err(res, 409, 'Une diffusion est déjà en cours pour ce district.')

        const targets    = []
        const sansNumero = []

        for (const r of record.relais) {
            const phone = resolvePhone(r)
            if (phone) targets.push({ nom: r.nom, phone })
            else       sansNumero.push(r.nom)
        }

        if (!targets.length)
            return err(res, 400, 'Aucun relais ne possède de numéro WhatsApp valide.')

        record.diffusion = {
            statut: 'en_cours', total: targets.length,
            envoyes: 0, echecs: 0, dateEnvoi: new Date(),
            errorLog: sansNumero.length ? `Sans numéro: ${sansNumero.join(', ')}` : '',
        }
        await record.save()

        res.json({
            message:     `Diffusion lancée vers ${targets.length} relais.`,
            total:       targets.length,
            sansNumero,
        })

        diffuserAudioDistrict(record, targets).catch(e =>
            console.error('[DIFFUSION]', e.message))

    } catch (e) { err(res, 500, e.message) }
})

export default router
