import React from 'react';

const STATS = [
    { icon: '💬', label: 'Messages reçus',     value: '—', color: '#0a7c4e' },
    { icon: '🎙️', label: 'Messages audio',      value: '—', color: '#6366f1' },
    { icon: '📝', label: 'Messages texte',      value: '—', color: '#f59e0b' },
    { icon: '👥', label: 'Contacts uniques',    value: '—', color: '#ec4899' },
];

export default function DashHome() {
    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Dashboard</h1>
            <p className="dash-page-sub">Bienvenue sur l'espace de gestion du chatbot Hawa 🇳🇪</p>

            <div className="dash-stats-grid">
                {STATS.map(s => (
                    <div key={s.label} className="stat-card" style={{ borderTopColor: s.color }}>
                        <span className="stat-icon">{s.icon}</span>
                        <div>
                            <p className="stat-value">{s.value}</p>
                            <p className="stat-label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dash-section">
                <h3>Activité récente</h3>
                <p className="dash-empty">Aucune activité récente pour le moment.</p>
            </div>
        </div>
    );
}
