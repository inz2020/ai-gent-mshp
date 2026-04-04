import express from 'express';
import User, { genererLogin } from '../models/User.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.js';
import { validerMotDePasse } from '../../constants/passwordPolicy.js';

const router = express.Router();

// Tous les endpoints nécessitent auth + admin
router.use(requireAuth, requireAdmin);

// GET /api/users — liste tous les utilisateurs
router.get('/', async (req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
});

// POST /api/users — créer un utilisateur
router.post('/', async (req, res) => {
    const { nom, email, password, role } = req.body;

    if (!nom || !email || !password) {
        return res.status(400).json({ message: 'Nom, email et mot de passe requis.' });
    }

    const { valide, erreurs } = validerMotDePasse(password);
    if (!valide) return res.status(400).json({ message: erreurs[0] });

    const login = genererLogin(nom);

    const [emailExiste, loginExiste] = await Promise.all([
        User.findOne({ email }),
        User.findOne({ login }),
    ]);
    if (emailExiste) return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    if (loginExiste) return res.status(409).json({ message: `L'identifiant "${login}" est déjà utilisé. Choisissez un nom différent.` });

    const user = await User.create({ nom, login, email, password, role });
    
    res.status(201).json({
        _id: user._id, nom: user.nom, login: user.login, email: user.email,
        role: user.role, actif: user.actif, createdAt: user.createdAt
    });
});

// PUT /api/users/:id — modifier un utilisateur
router.put('/:id', async (req, res) => {
    const { nom, email, password, role, actif } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    // Empêcher de modifier le seul admin
    if (user.role === 'admin' && role === 'agent') {
        const nbAdmins = await User.countDocuments({ role: 'admin', actif: true });
        if (nbAdmins <= 1) {
            return res.status(400).json({ message: 'Impossible de rétrograder le seul administrateur.' });
        }
    }

    if (nom)   user.nom   = nom;
    if (email) user.email = email;
    if (role)  user.role  = role;
    if (actif !== undefined) user.actif = actif;

    if (password) {
        const { valide, erreurs } = validerMotDePasse(password);
        if (!valide) return res.status(400).json({ message: erreurs[0] });
        user.password = password;
    }

    await user.save();
    res.json({
        _id: user._id, nom: user.nom, login: user.login, email: user.email,
        role: user.role, actif: user.actif, createdAt: user.createdAt
    });
});

// DELETE /api/users/:id — supprimer un utilisateur
router.delete('/:id', async (req, res) => {
    if (req.user.id === req.params.id) {
        return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    if (user.role === 'admin') {
        const nbAdmins = await User.countDocuments({ role: 'admin', actif: true });
        if (nbAdmins <= 1) {
            return res.status(400).json({ message: 'Impossible de supprimer le seul administrateur.' });
        }
    }

    await user.deleteOne();
    res.json({ message: 'Utilisateur supprimé.' });
});

export default router;
