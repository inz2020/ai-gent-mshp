import { useEffect, useState } from 'react';
import { getConversationStats } from '../../api/index.js';

const STAT_DEFS = [
    { icon: 'bi bi-chat-dots-fill', label: 'Messages reçus',  key: 'total',    color: '#0a7c4e' },
    { icon: 'bi bi-mic-fill',       label: 'Messages audio',  key: 'audio',    color: '#6366f1' },
    { icon: 'bi bi-pencil-square',  label: 'Messages texte',  key: 'texte',    color: '#f59e0b' },
    { icon: 'bi bi-people-fill',    label: 'Contacts uniques', key: 'contacts', color: '#ec4899' },
];

export default function DashHome() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        getConversationStats()
            .then(setStats)
            .catch(() => setStats(null));
    }, []);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Dashboard</h1>
            <p className="dash-page-sub">Bienvenue sur l'espace de gestion du chatbot Hawa 🇳🇪</p>

            <div className="dash-stats-grid">
                {STAT_DEFS.map(s => (
                    <div key={s.label} className="stat-card" style={{ borderTopColor: s.color }}>
                        <i className={`stat-icon ${s.icon}`}></i>
                        <div>
                            <p className="stat-value">
                                {stats === null ? '…' : (stats[s.key] ?? 0).toLocaleString()}
                            </p>
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
