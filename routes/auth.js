import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../db/models/User.js';
import { validerMotDePasse } from '../constants/passwordPolicy.js';

const router = express.Router();

// POST /api/login
router.post('/login', async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
    }

    const { valide, erreurs } = validerMotDePasse(password);
    if (!valide) {
        return res.status(400).json({ message: erreurs[0] });
    }

    try {
        const user = await User.findOne({ login, actif: true });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants incorrects.' });
        }

        const motDePassevalide = await user.verifierPassword(password);
        if (!motDePassevalide) {
            return res.status(401).json({ message: 'Identifiants incorrects.' });
        }

        const token = jwt.sign(
            { id: user._id, login: user.login, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, nom: user.nom, role: user.role });
    } catch (err) {
        console.error('[Login error]', err.message);
        res.status(500).json({ message: 'Erreur serveur, réessayez.' });
    }
});

// GET /api/me — vérifie si le token est valide
router.get('/me', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Non autorisé.' });
    }
    try {
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        res.json({ id: payload.id, login: payload.login, role: payload.role });
    } catch {
        res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
});

export default router;
