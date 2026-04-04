import React, { useState } from 'react';

const ROLES = [
    {
        id: 'admin',
        label: 'Administrateur',
        description: 'Accès complet à toutes les fonctionnalités du tableau de bord.',
        color: '#7c3aed',
        bg: '#ede9fe',
        locked: true,
    },
    {
        id: 'agent',
        label: 'Agent de santé',
        description: 'Accès aux discussions et contacts. Pas de gestion des utilisateurs.',
        color: '#0369a1',
        bg: '#e0f2fe',
        locked: false,
    },
    {
        id: 'staff',
        label: 'Staff',
        description: 'Accès en lecture aux discussions, contacts et statistiques.',
        color: '#0f766e',
        bg: '#ccfbf1',
        locked: false,
    },
    {
        id: 'user',
        label: 'Utilisateur',
        description: 'Accès minimal : dashboard uniquement.',
        color: '#b45309',
        bg: '#fef3c7',
        locked: false,
    },
    {
        id: 'autre',
        label: 'Autre',
        description: 'Rôle personnalisé sans accès par défaut.',
        color: '#6b7280',
        bg: '#f3f4f6',
        locked: false,
    },
];

// Toutes les permissions existantes
const ALL_PERMISSIONS = [
    { id: 'dashboard',     label: 'Voir le dashboard',                icon: '🏠' },
    { id: 'discussions',   label: 'Voir les discussions',             icon: '💬' },
    { id: 'contacts',      label: 'Voir les contacts',                icon: '📋' },
    { id: 'users_view',    label: 'Voir les utilisateurs',            icon: '👁️' },
    { id: 'users_manage',  label: 'Gérer les utilisateurs',           icon: '👥' },
    { id: 'roles_manage',  label: 'Modifier les rôles et permissions',icon: '🔑' },
    { id: 'stats',         label: 'Accéder aux statistiques',         icon: '📊' },
    { id: 'settings',      label: 'Configurer les paramètres',        icon: '⚙️' },
];

const INITIAL_MATRIX = {
    admin: new Set(['dashboard', 'discussions', 'contacts', 'users_view', 'users_manage', 'roles_manage', 'stats', 'settings']),
    agent: new Set(['dashboard', 'discussions', 'contacts']),
    staff: new Set(['dashboard', 'discussions', 'contacts', 'users_view', 'stats']),
    user:  new Set(['dashboard']),
    autre: new Set([]),
};

export default function RolesPermissions() {
    const [matrix, setMatrix] = useState(INITIAL_MATRIX);
    const [saved, setSaved]   = useState(false);

    function toggle(roleId, permId) {
        const role = ROLES.find(r => r.id === roleId);
        if (role?.locked) return;
        setMatrix(prev => {
            const next = new Set(prev[roleId]);
            next.has(permId) ? next.delete(permId) : next.add(permId);
            return { ...prev, [roleId]: next };
        });
        setSaved(false);
    }

    function handleSave() {
        // TODO : persister en base via API
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Rôles & Permissions</h1>
            <p className="dash-page-sub">
                Définissez les accès de chaque rôle. Les cases grisées sont fixes.
            </p>

            {/* Cartes des rôles */}
            <div className="roles-cards">
                {ROLES.map(role => (
                    <div key={role.id} className="role-card" style={{ borderTopColor: role.color }}>
                        <div className="role-card-header">
                            <span className="role-badge" style={{ background: role.bg, color: role.color }}>
                                {role.label}
                            </span>
                            <span className="role-perm-count">
                                {matrix[role.id].size} permission{matrix[role.id].size > 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="role-desc">{role.description}</p>
                    </div>
                ))}
            </div>

            {/* Matrice des permissions */}
            <div className="dash-section perm-section">
                <div className="perm-table-wrap">
                    <table className="perm-table">
                        <thead>
                            <tr>
                                <th className="perm-th-label">Permission</th>
                                {ROLES.map(r => (
                                    <th key={r.id} style={{ color: r.color }}>{r.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ALL_PERMISSIONS.map(perm => (
                                <tr key={perm.id}>
                                    <td className="perm-label">
                                        <span>{perm.icon}</span> {perm.label}
                                    </td>
                                    {ROLES.map(role => {
                                        const checked = matrix[role.id].has(perm.id);
                                        const locked  = role.locked;
                                        return (
                                            <td key={role.id} className="perm-cell">
                                                <label className={`perm-toggle ${locked ? 'locked' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={locked}
                                                        onChange={() => toggle(role.id, perm.id)}
                                                    />
                                                    <span className="perm-toggle-slider" />
                                                </label>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="perm-footer">
                    <p className="perm-note">🔒 Les permissions de l'administrateur sont fixes et non modifiables.</p>
                    <button className="dt-btn dt-btn-primary" onClick={handleSave}>
                        {saved ? '✓ Enregistré' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </div>
        </div>
    );
}
