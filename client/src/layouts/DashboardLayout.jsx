import { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';

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
            { to:'/dashboard/communication/configurations', label:'Configurations'   },
            { to:'/dashboard/communication/relais', label:'Relais'   },
            { to:'/dashboard/communication/diffusions', label:'Diffusions'},
            { to:'/dashboard/communication/sensibilisation', label:'Sensibilisation Communautaire'},

        ]
    },

    { to: '/dashboard/parametres', icon: 'bi bi-gear-fill', label: 'Paramètres' },
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
