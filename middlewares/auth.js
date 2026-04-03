import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Non autorisé.' });
    }
    try {
        req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }
    next();
}
