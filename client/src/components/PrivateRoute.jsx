import { Navigate, Outlet } from 'react-router-dom';

function tokenValide() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

export default function PrivateRoute() {
    return tokenValide() ? <Outlet /> : <Navigate to="/connexion" replace />;
}
