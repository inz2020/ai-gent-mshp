import { useNavigate } from 'react-router-dom';

export default function SessionExpired() {
    const navigate = useNavigate();

    function handleReconnect() {
        localStorage.removeItem('token');
        localStorage.removeItem('user_nom');
        localStorage.removeItem('user_role');
        navigate('/connexion', { replace: true });
    }

    return (
        <div style={s.wrapper}>
            <div style={s.card}>
                <div style={s.iconWrap}>
                    <i className="bi bi-clock" style={{ fontSize: '3rem', color: 'var(--orange)' }}></i>
                </div>
                <h1 style={s.title}>Session expirée</h1>
                <p style={s.message}>
                    Votre session a expiré après une période d'inactivité.<br />
                    Veuillez vous reconnecter pour continuer.
                </p>
                <button style={s.btn} onClick={handleReconnect}>
                    Se reconnecter
                </button>
            </div>
        </div>
    );
}

const s = {
    wrapper: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gray-50)',
        padding: '2rem',
        fontFamily: 'inherit',
    },
    card: {
        background: 'var(--white)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        maxWidth: 420,
        width: '100%',
    },
    iconWrap: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1.25rem',
    },
    title: {
        fontSize: '1.6rem',
        fontWeight: 700,
        color: 'var(--gray-800)',
        marginBottom: '0.75rem',
    },
    message: {
        color: 'var(--gray-600)',
        fontSize: '0.95rem',
        lineHeight: 1.7,
        marginBottom: '2rem',
    },
    btn: {
        display: 'inline-block',
        background: 'var(--green)',
        color: '#fff',
        padding: '0.75rem 2rem',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: '0.95rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        width: '100%',
    },
};
