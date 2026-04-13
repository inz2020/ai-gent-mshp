import { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
    { to: '/dashboard',             icon: '🏠', label: 'Dashboard', end: true },
    { to: '/dashboard/discussions', icon: '💬', label: 'Discussions' },
    { to: '/dashboard/contacts',    icon: '📋', label: 'Contacts' },
    {
        key: 'utilisateurs',
        icon: '👥', label: 'Utilisateurs',
        prefix: '/dashboard/utilisateurs',
        children: [
            { to: '/dashboard/utilisateurs',        label: 'Liste des utilisateurs' },
            { to: '/dashboard/utilisateurs/roles',  label: 'Rôles & permissions' },
        ]
    },
    { to: '/dashboard/diffusions',  icon: '📣', label: 'Diffusions' },
    { to: '/dashboard/campagnes',   icon: '📢', label: 'Campagnes' },
    {
        key: 'metadonnees',
        icon: '🗂️', label: 'Métadonnées',
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
    { to: '/dashboard/parametres', icon: '⚙️', label: 'Paramètres' },
];

export default function DashboardLayout() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const userNom  = localStorage.getItem('user_nom') || 'Administrateur';
    const userRole = localStorage.getItem('user_role') || '';

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
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img
                        src="https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png"
                        alt="PEV"
                    />
                    {!collapsed && <span>PEV Niger</span>}
                </div>

                <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
                    {collapsed ? '→' : '←'}
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
                                        <span className="sidebar-icon">{item.icon}</span>
                                        {!collapsed && (
                                            <>
                                                <span className="sidebar-label">{item.label}</span>
                                                <span className="sidebar-chevron">{isOpen ? '▾' : '▸'}</span>
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
                                <span className="sidebar-icon">{item.icon}</span>
                                {!collapsed && <span className="sidebar-label">{item.label}</span>}
                            </NavLink>
                        );
                    })}
                </nav>

                <button className="sidebar-logout" onClick={handleLogout}>
                    <span className="sidebar-icon">🚪</span>
                    {!collapsed && <span className="sidebar-label">Déconnexion</span>}
                </button>
            </aside>

            <div className="dash-content">
                <header className="dash-topbar">
                    <h2 className="dash-title">Espace Administration</h2>
                    <div className="dash-user">
                        <span className="dash-avatar">👤</span>
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
