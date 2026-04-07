import { Navigate, Outlet } from 'react-router-dom';

function checkToken() {
    const token = localStorage.getItem('token');
    if (!token) return 'absent';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now() ? 'valide' : 'expire';
    } catch {
        return 'absent';
    }
}

export default function PrivateRoute() {
    const statut = checkToken();
    if (statut === 'valide') return <Outlet />;
    if (statut === 'expire') return <Navigate to="/session-expiree" replace />;
    return <Navigate to="/connexion" replace />;
}
