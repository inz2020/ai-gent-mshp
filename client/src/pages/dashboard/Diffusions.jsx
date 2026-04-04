import { useEffect, useRef, useState } from 'react';
import { getBroadcasts, getBroadcastById, sendBroadcast } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

// ─── Configuration des templates Meta ────────────────────────
// Ajoutez ici chaque template approuvé dans Meta Business Manager.
// type: 'texte' | 'audio'
// parametres: nombre de variables {{1}}, {{2}}...
const TEMPLATES = [
    { name: 'esante',          label: 'eSanté — Message de santé',       type: 'texte', parametres: 0 },
    { name: 'rappel_vaccin',   label: 'Rappel de vaccination',            type: 'texte', parametres: 2 },
    { name: 'alerte_campagne', label: 'Alerte campagne de vaccination',   type: 'texte', parametres: 1 },
    { name: 'audio_sante',     label: 'Message audio santé (header MP3)', type: 'audio', parametres: 0 },
    { name: 'audio_rappel',    label: 'Rappel audio vaccination (MP3)',   type: 'audio', parametres: 0 },
];

const CIBLES = [
    { value: 'tous', label: 'Tous les contacts'     },
    { value: 'fr',   label: 'Contacts francophones' },
    { value: 'ha',   label: 'Contacts Hausa'        },
];

const STATUT_COLOR = {
    planifie: 'dt-badge-inactif',
    en_cours: 'dt-badge-warning',
    termine:  'dt-badge-actif',
    erreur:   'dt-badge-danger',
};
const STATUT_LABEL = {
    planifie: 'Planifié',
    en_cours: 'En cours',
    termine:  'Terminé',
    erreur:   'Erreur',
};

const DEFAULT_FORM = {
    templateName:  'esante',
    langue:        'tous',
    langueTemplate:'fr',
    parametres:    [],
    messageAudio:  '',
    dateEnvoi:     '',
};

export default function Diffusions() {
    const [broadcasts, setBroadcasts]   = useState([]);
    const [loading, setLoading]         = useState(true);
    const [modal, setModal]             = useState(false);
    const [sending, setSending]         = useState(false);
    const [success, setSuccess]         = useState('');
    const [error, setError]             = useState('');
    const [form, setForm]               = useState(DEFAULT_FORM);
    const pollingRef                    = useRef(null);

    const { paged: pagedBroadcasts, page, setPage, totalPages } = usePagination(broadcasts);

    const selectedTemplate = TEMPLATES.find(t => t.name === form.templateName) ?? TEMPLATES[0];
    const isAudio          = selectedTemplate.type === 'audio';
    const nbParams         = selectedTemplate.parametres ?? 0;

    // Polling des diffusions "en_cours"
    useEffect(() => {
        fetchBroadcasts();
    }, []);

    useEffect(() => {
        const hasActive = broadcasts.some(b => b.statut === 'en_cours');
        if (hasActive && !pollingRef.current) {
            pollingRef.current = setInterval(async () => {
                const active = broadcasts.filter(b => b.statut === 'en_cours');
                const updated = await Promise.all(active.map(b => getBroadcastById(b._id).catch(() => b)));
                setBroadcasts(prev =>
                    prev.map(b => updated.find(u => u._id === b._id) ?? b)
                );
                const stillActive = updated.some(u => u.statut === 'en_cours');
                if (!stillActive) clearInterval(pollingRef.current), pollingRef.current = null;
            }, 4000);
        }
        if (!hasActive && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        return () => {};
    }, [broadcasts]);

    async function fetchBroadcasts() {
        setLoading(true);
        try { setBroadcasts(await getBroadcasts()); }
        catch (e) { setError(e.message); }
        finally   { setLoading(false); }
    }

    function handleTemplateChange(name) {
        const tpl = TEMPLATES.find(t => t.name === name) ?? TEMPLATES[0];
        setForm(f => ({
            ...f,
            templateName: name,
            parametres:   Array(tpl.parametres).fill(''),
            messageAudio: '',
        }));
    }

    function handleParamChange(index, value) {
        setForm(f => {
            const params = [...f.parametres];
            params[index] = value;
            return { ...f, parametres: params };
        });
    }

    async function handleSend(e) {
        e.preventDefault();
        setSending(true);
        setError('');
        try {
            const payload = {
                ...form,
                type: selectedTemplate.type,
                dateEnvoi: form.dateEnvoi || undefined,
            };
            const res = await sendBroadcast(payload);
            setSuccess(res.message);
            setModal(false);
            setForm(DEFAULT_FORM);
            setTimeout(() => { setSuccess(''); fetchBroadcasts(); }, 4000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    }

    // Stats globales
    const totalEnvoyes  = broadcasts.reduce((s, b) => s + (b.envoyes ?? 0), 0);
    const totalContacts = broadcasts.reduce((s, b) => s + (b.total   ?? 0), 0);
    const totalLivre    = broadcasts.reduce((s, b) => s + (b.livre   ?? 0), 0);
    const totalLu       = broadcasts.reduce((s, b) => s + (b.lu      ?? 0), 0);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Diffusions WhatsApp</h1>
            <p className="dash-page-sub">Envoyez des messages texte ou audio à vos contacts via WhatsApp Business API.</p>

            {success && <div className="dt-success">&#10003; {success}</div>}
            {error   && <div className="dt-error">&#9888; {error}</div>}

            {/* Stats */}
            <div className="broadcast-stats">
                <div className="bstat-card">
                    <span className="bstat-num">{broadcasts.length}</span>
                    <span className="bstat-label">Diffusions</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">{totalEnvoyes}</span>
                    <span className="bstat-label">Envoyés</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">{totalLivre}</span>
                    <span className="bstat-label">Livrés</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">{totalLu}</span>
                    <span className="bstat-label">Lus</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">
                        {totalContacts > 0 ? Math.round((totalEnvoyes / totalContacts) * 100) : 0}%
                    </span>
                    <span className="bstat-label">Taux d'envoi</span>
                </div>
            </div>

            <div className="dt-toolbar">
                <button className="dt-btn dt-btn-primary" onClick={() => { setModal(true); setError(''); }}>
                    + Nouvelle diffusion
                </button>
                <button className="dt-btn" onClick={fetchBroadcasts}>&#8635; Actualiser</button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Type</th>
                            <th>Cible</th>
                            <th>Total</th>
                            <th>Envoyés</th>
                            <th>Livrés</th>
                            <th>Lus</th>
                            <th>Échecs</th>
                            <th>Statut</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="10" className="dt-center">Chargement...</td></tr>
                        ) : broadcasts.length === 0 ? (
                            <tr><td colSpan="10" className="dt-center">Aucune diffusion.</td></tr>
                        ) : pagedBroadcasts.map(b => {
                            const isActive = b.statut === 'en_cours';
                            const pct = b.total > 0 ? Math.round(((b.envoyes ?? 0) / b.total) * 100) : 0;
                            return (
                                <tr key={b._id}>
                                    <td><span className="dt-mono">{b.templateName}</span></td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.78rem', fontWeight: 600,
                                            color: b.type === 'audio' ? 'var(--orange)' : 'var(--green)',
                                        }}>
                                            {b.type === 'audio' ? '&#127911; Audio' : '&#128172; Texte'}
                                        </span>
                                    </td>
                                    <td>{CIBLES.find(c => c.value === b.langue)?.label ?? b.langue}</td>
                                    <td style={{ textAlign: 'center' }}>{b.total}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {isActive
                                            ? <><strong style={{ color: '#16a34a' }}>{b.envoyes}</strong> <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({pct}%)</span></>
                                            : <strong style={{ color: '#16a34a' }}>{b.envoyes}</strong>
                                        }
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#2563eb' }}>{b.livre ?? 0}</td>
                                    <td style={{ textAlign: 'center', color: '#7c3aed' }}>{b.lu ?? 0}</td>
                                    <td style={{ textAlign: 'center', color: (b.echecs ?? 0) > 0 ? '#dc2626' : '#9ca3af' }}>{b.echecs ?? 0}</td>
                                    <td>
                                        <span className={`dt-badge ${STATUT_COLOR[b.statut] ?? 'dt-badge-inactif'}`}>
                                            {STATUT_LABEL[b.statut] ?? b.statut}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                                        {b.dateEnvoi && b.statut === 'planifie'
                                            ? <>Planifié : {new Date(b.dateEnvoi).toLocaleString('fr-FR')}</>
                                            : new Date(b.createdAt).toLocaleString('fr-FR')
                                        }
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{broadcasts.length} diffusion{broadcasts.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2>Nouvelle diffusion</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>
                        <form onSubmit={handleSend} className="modal-form">
                            {error && <div className="modal-error">&#9888; {error}</div>}

                            {/* Template */}
                            <div className="form-group">
                                <label>Template WhatsApp</label>
                                <select value={form.templateName} onChange={e => handleTemplateChange(e.target.value)}>
                                    {TEMPLATES.map(t => (
                                        <option key={t.name} value={t.name}>
                                            [{t.type === 'audio' ? 'AUDIO' : 'TEXTE'}] {t.label}
                                            {t.parametres > 0 ? ` — ${t.parametres} variable${t.parametres > 1 ? 's' : ''}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Variables texte */}
                            {!isAudio && nbParams > 0 && (
                                <div className="form-group">
                                    <label>Variables du template</label>
                                    {Array.from({ length: nbParams }).map((_, i) => (
                                        <input
                                            key={i}
                                            style={{ marginBottom: 8 }}
                                            placeholder={`{{${i + 1}}} — valeur du paramètre ${i + 1}`}
                                            value={form.parametres[i] ?? ''}
                                            onChange={e => handleParamChange(i, e.target.value)}
                                            required
                                        />
                                    ))}
                                    <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Ces valeurs remplaceront les variables dans le template.
                                    </small>
                                </div>
                            )}

                            {/* Message audio TTS */}
                            {isAudio && (
                                <div className="form-group">
                                    <label>Texte à convertir en audio (TTS)</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Écrivez le message qui sera converti en voix et envoyé à vos contacts..."
                                        value={form.messageAudio}
                                        onChange={e => setForm(f => ({ ...f, messageAudio: e.target.value }))}
                                        required
                                        style={{ resize: 'vertical', minHeight: 90 }}
                                    />
                                    <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Le fichier audio sera généré une seule fois et envoyé à tous les contacts sélectionnés.
                                    </small>
                                </div>
                            )}

                            {/* Langue template */}
                            <div className="form-group">
                                <label>Langue du template (code Meta)</label>
                                <select
                                    value={form.langueTemplate}
                                    onChange={e => setForm(f => ({ ...f, langueTemplate: e.target.value }))}
                                >
                                    <option value="fr">Français (fr)</option>
                                    <option value="ha">Hausa (ha)</option>
                                    <option value="fr_FR">Français FR (fr_FR)</option>
                                </select>
                            </div>

                            {/* Cible */}
                            <div className="form-group">
                                <label>Envoyer à</label>
                                <select
                                    value={form.langue}
                                    onChange={e => setForm(f => ({ ...f, langue: e.target.value }))}
                                >
                                    {CIBLES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Planification */}
                            <div className="form-group">
                                <label>Planifier l'envoi (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    value={form.dateEnvoi}
                                    onChange={e => setForm(f => ({ ...f, dateEnvoi: e.target.value }))}
                                />
                                <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                    Laissez vide pour envoyer immédiatement. La diffusion sera lancée automatiquement à la date choisie.
                                </small>
                            </div>

                            <div className="broadcast-warning">
                                &#9888; Cette action enverra un message WhatsApp à tous les contacts sélectionnés.
                                Assurez-vous que le template est approuvé par Meta avant de lancer.
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={sending}>
                                    {sending ? 'Lancement...' : form.dateEnvoi ? 'Planifier' : 'Lancer la diffusion'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
