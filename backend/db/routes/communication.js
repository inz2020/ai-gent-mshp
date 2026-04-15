import express from 'express'
import District from '../models/District'
import Structure from '../models/Structure'
import { requireAuth, requireAdmin } from '../../middlewares/auth'
import AgentCom from '../models/AgentCom'
import Contact from '../models/Contact'

const router = express.Router()
router.use(requireAuth, requireAdmin)

// ═══════════════════════════════════════════════════════
// UTILITAIRE — réponse d'erreur uniforme
// ═══════════════════════════════════════════════════════
const err = (res, status, msg) => res.status(status).json({ message: msg })

// get Agents comunicateurs
router.get('/agents-comm', async (req, res) => {
  try {
    const agentComms = await AgentCom.find().sort({ nom: 1 })
    res.json(agentComms)
  } catch (error) {
    err(res, 500, e.message)
  }
})

//post Agents comm
router.post('/agents-comm', async (req, res) => {
  try {
    const { nom, districtId, contactId, statut, dateService } = req.body
    if (!nom?.trim()) {
      return err(res, 400, 'Le nom du communicateur est requis')
    }
    const existe = await AgentCom.findOne({ nom: nom.trim() })
    if (existe) return err(res, 409, 'Ce nom existe déjà')
    const district = await District.findById(districtId)
    const contact = await District.findById(contactId)
    if (!district) return err(res, 404, 'District Introuvable')
    if (contact) {
      return res
        .status(409)
        .json({ message: `Ce numero existe deja (${contact?.nom}).` })
    }
    const agentComm = await AgentCom.create({
      nom: nom,
      statut: statut,
      dateService: dateService
    })
    const populated = await AgentCom.findById(agentComm._id)
      .populate('district', 'nom')
      .populate('contact', ' whatsappId')
    res.status(500).json(populated)
  } catch (error) {
    err(res, 500, e.message)
  }
})
