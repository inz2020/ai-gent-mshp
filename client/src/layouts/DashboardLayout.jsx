import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { refreshToken } from '../api/index.js';

const NAV_ITEMS = [
    { to: '/dashboard',             icon: 'bi bi-house-fill',      label: 'Dashboard', end: true },
    { to: '/dashboard/discussions', icon: 'bi bi-chat-dots-fill',  label: 'Discussions' },
    { to: '/dashboard/contacts',    icon: 'bi bi-clipboard-fill',  label: 'Contacts' },
    {
        key: 'utilisateurs',
        icon: 'bi bi-people-fill', label: 'Utilisateurs',
        prefix: '/dashboard/utilisateurs',
        children: [
            { to: '/dashboard/utilisateurs',        label: 'Liste des utilisateurs' },
            { to: '/dashboard/utilisateurs/roles',  label: 'Rôles & permissions' },
        ]
    },
    // { to: '/dashboard/diffusions',  icon: 'bi bi-megaphone-fill',  label: 'Diffusions' },
    { to: '/dashboard/campagnes',   icon: 'bi bi-broadcast',       label: 'Campagnes' },
    {
        key: 'metadonnees',
        icon: 'bi bi-folder-fill', label: 'Métadonnées',
        prefix: '/dashboard/metadonnees',
        children: [
            { to: '/dashboard/metadonnees/regions',       label: 'Régions' },
            { to: '/dashboard/metadonnees/districts',     label: 'Districts' },
            { to: '/dashboard/metadonnees/structures',    label: 'Structures' },
            { to: '/dashboard/metadonnees/vaccins',       label: 'Vaccins' },
            { to: '/dashboard/metadonnees/calendrier',    label: 'Calendrier vaccinal' },
            { to: '/dashboard/metadonnees/hausa-prompt',  label: 'Vocabulaire Hausa' },
        ]
    },
    { key:'communication', icon:'bi bi-megaphone-fill', label:'Communication',
        prefix:'/dashboard/communication',
        children:[
            { to:'/dashboard/communication/agent-comm', label:'Configurations'   },
            { to:'/dashboard/communication/relais', label:'Relais'   },
            { to:'/dashboard/communication/diffusions', label:'Diffusions'},
            { to:'/dashboard/communication/sensibilisation', label:'Sensibilisation Communautaire'},

        ]
    },

    { to: '/dashboard/parametres', icon: 'bi bi-gear-fill', label: 'Paramètres' },
];

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 min
const WARNING_AT       = 55 * 60 * 1000; // avertissement à 55 min
const REFRESH_EVERY    = 30 * 60 * 1000; // refresh token toutes les 30 min d'activité

export default function DashboardLayout() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    // Mobile (<768px) : sidebar overlay fermée par défaut
    const [mobileOpen, setMobileOpen] = useState(false);
    const userNom  = localStorage.getItem('user_nom') || 'Administrateur';
    const userRole = localStorage.getItem('user_role') || '';

    // ── Inactivité ──────────────────────────────────────────────
    const lastActivity  = useRef(Date.now());
    const [warning, setWarning] = useState(false);   // modal "session expire bientôt"
    const [countdown, setCountdown] = useState(300); // secondes restantes

    useEffect(() => {
        const markActive = () => { lastActivity.current = Date.now(); setWarning(false); };
        const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        EVENTS.forEach(e => window.addEventListener(e, markActive, { passive: true }));

        // Vérifie l'inactivité toutes les 10 s
        const inactivityTimer = setInterval(() => {
            const idle = Date.now() - lastActivity.current;
            if (idle >= INACTIVITY_LIMIT) {
                localStorage.removeItem('token');
                localStorage.removeItem('user_nom');
                localStorage.removeItem('user_role');
                navigate('/session-expired', { replace: true });
            } else if (idle >= WARNING_AT) {
                setCountdown(Math.ceil((INACTIVITY_LIMIT - idle) / 1000));
                setWarning(true);
            }
        }, 10_000);

        // Renouvelle le token toutes les 30 min si l'utilisateur est actif
        const refreshTimer = setInterval(async () => {
            if (Date.now() - lastActivity.current < REFRESH_EVERY) {
                try {
                    const { token } = await refreshToken();
                    localStorage.setItem('token', token);
                } catch { /* 401 géré par api/index.js → /session-expired */ }
            }
        }, REFRESH_EVERY);

        return () => {
            EVENTS.forEach(e => window.removeEventListener(e, markActive));
            clearInterval(inactivityTimer);
            clearInterval(refreshTimer);
        };
    }, [navigate]);

    async function stayConnected() {
        try {
            const { token } = await refreshToken();
            localStorage.setItem('token', token);
            lastActivity.current = Date.now();
            setWarning(false);
        } catch { /* redirigé par api/index.js */ }
    }

    // Ferme la sidebar mobile à chaque changement de page
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    // État des sous-menus : { utilisateurs: bool, metadonnees: bool }
    const [openMenus, setOpenMenus] = useState(() => {
        const init = {};
        NAV_ITEMS.forEach(item => {
            if (item.key) init[item.key] = location.pathname.startsWith(item.prefix);
        });
        return init;
    });

    function toggleMenu(key) {
        setOpenMenus(m => ({ ...m, [key]: !m[key] }));
    }

    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user_nom');
        localStorage.removeItem('user_role');
        navigate('/connexion');
    }

    return (
        <div className={`dash-wrapper ${collapsed ? 'collapsed' : ''}`}>
            {/* Modal inactivité */}
            {warning && (
                <div style={inactivityOverlay}>
                    <div style={inactivityCard}>
                        <i className="bi bi-clock-history" style={{ fontSize: '2.5rem', color: 'var(--orange, #f59e0b)' }} />
                        <h2 style={{ margin: '1rem 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
                            Session expiration
                        </h2>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Votre session expire dans <strong>{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</strong> en raison d'inactivité.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button style={btnPrimary} onClick={stayConnected}>Rester connecté</button>
                            <button style={btnSecondary} onClick={handleLogout}>Se déconnecter</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop mobile */}
            {mobileOpen && (
                <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <img
                        src="https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png"
                        alt="PEV"
                    />
                    {!collapsed && <span>PEV Niger</span>}
                </div>

                <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
                    <i className={collapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'}></i>
                </button>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(item => {
                        if (item.children) {
                            const isActive = location.pathname.startsWith(item.prefix);
                            const isOpen   = openMenus[item.key];
                            return (
                                <div key={item.key} className="sidebar-group">
                                    <button
                                        className={`sidebar-link sidebar-group-btn ${isActive ? 'active' : ''}`}
                                        onClick={() => !collapsed && toggleMenu(item.key)}
                                    >
                                        <i className={`sidebar-icon ${item.icon}`}></i>
                                        {!collapsed && (
                                            <>
                                                <span className="sidebar-label">{item.label}</span>
                                                <i className={`sidebar-chevron bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                                            </>
                                        )}
                                    </button>
                                    {!collapsed && isOpen && (
                                        <div className="sidebar-submenu">
                                            {item.children.map(child => (
                                                <NavLink
                                                    key={child.to}
                                                    to={child.to}
                                                    end
                                                    className={({ isActive }) =>
                                                        `sidebar-sublink ${isActive ? 'active' : ''}`
                                                    }
                                                >
                                                    {child.label}
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <i className={`sidebar-icon ${item.icon}`}></i>
                                {!collapsed && <span className="sidebar-label">{item.label}</span>}
                            </NavLink>
                        );
                    })}
                </nav>

                <button className="sidebar-logout" onClick={handleLogout}>
                    <i className="sidebar-icon bi bi-box-arrow-right"></i>
                    {!collapsed && <span className="sidebar-label">Déconnexion</span>}
                </button>
            </aside>

            <div className="dash-content">
                <header className="dash-topbar">
                    {/* Hamburger — visible uniquement sur mobile */}
                    <button className="sidebar-hamburger" onClick={() => setMobileOpen(o => !o)}>
                        <i className="bi bi-list"></i>
                    </button>
                    <h2 className="dash-title">Espace Administration</h2>
                    <div className="dash-user">
                        <i className="dash-avatar bi bi-person-fill"></i>
                        <span>{userNom}{userRole ? ` (${userRole})` : ''}</span>
                    </div>
                </header>
                <main className="dash-main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

const inactivityOverlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const inactivityCard = {
    background: '#fff', borderRadius: 12, padding: '2rem 2.5rem',
    textAlign: 'center', maxWidth: 380, width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};
const btnPrimary = {
    background: 'var(--green, #16a34a)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 600,
    fontSize: '0.9rem', cursor: 'pointer',
};
const btnSecondary = {
    background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db',
    borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 600,
    fontSize: '0.9rem', cursor: 'pointer',
};
