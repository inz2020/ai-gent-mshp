import { useEffect, useState } from 'react';
import { getBroadcasts, sendBroadcast } from '../../api/index.js';

const TEMPLATES = [
    { name: 'esante', label: 'eSanté — Message de santé', parametres: 0 },
    // Ajouter ici d'autres templates : { name: 'rappel_vaccin', label: '...', parametres: 2 }
];

const CIBLES = [
    { value: 'tous',  label: 'Tous les contacts'      },
    { value: 'fr',    label: 'Contacts francophones'  },
    { value: 'ha',    label: 'Contacts Hausa'         },
];

const STATUT_COLOR = {
    en_cours: 'dt-badge-inactif',
    termine:  'dt-badge-actif',
    erreur:   'dt-badge-danger',
};
const STATUT_LABEL = {
    en_cours: 'En cours',
    termine:  'Terminé',
    erreur:   'Erreur',
};

export default function Diffusions() {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState(false);
    const [sending, setSending]       = useState(false);
    const [success, setSuccess]       = useState('');
    const [error, setError]           = useState('');
    const [form, setForm]             = useState({ templateName: 'esante', langue: 'tous', langueTemplate: 'fr', parametres: [] });

    const selectedTemplate = TEMPLATES.find(t => t.name === form.templateName);
    const nbParams = selectedTemplate?.parametres ?? 0;

    function handleTemplateChange(name) {
        const tpl = TEMPLATES.find(t => t.name === name);
        setForm(f => ({ ...f, templateName: name, parametres: Array(tpl?.parametres ?? 0).fill('') }));
    }

    function handleParamChange(index, value) {
        setForm(f => {
            const params = [...f.parametres];
            params[index] = value;
            return { ...f, parametres: params };
        });
    }

    useEffect(() => { fetchBroadcasts(); }, []);

    async function fetchBroadcasts() {
        setLoading(true);
        try { setBroadcasts(await getBroadcasts()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    async function handleSend(e) {
        e.preventDefault();
        setSending(true);
        setError('');
        try {
            const res = await sendBroadcast(form);
            setSuccess(res.message);
            setModal(false);
            setTimeout(() => { setSuccess(''); fetchBroadcasts(); }, 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    }

    const totalEnvoyes = broadcasts.reduce((s, b) => s + (b.envoyes ?? 0), 0);
    const totalContacts = broadcasts.reduce((s, b) => s + (b.total ?? 0), 0);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Diffusions WhatsApp</h1>
            <p className="dash-page-sub">Envoyez un message template à vos contacts via WhatsApp Business API.</p>

            {success && <div className="dt-success">✓ {success}</div>}
            {error   && <div className="dt-error">⚠️ {error}</div>}

            {/* Stats rapides */}
            <div className="broadcast-stats">
                <div className="bstat-card">
                    <span className="bstat-num">{broadcasts.length}</span>
                    <span className="bstat-label">Diffusions lancées</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">{totalEnvoyes}</span>
                    <span className="bstat-label">Messages envoyés</span>
                </div>
                <div className="bstat-card">
                    <span className="bstat-num">
                        {totalContacts > 0 ? Math.round((totalEnvoyes / totalContacts) * 100) : 0}%
                    </span>
                    <span className="bstat-label">Taux de livraison</span>
                </div>
            </div>

            <div className="dt-toolbar">
                <button className="dt-btn dt-btn-primary" onClick={() => { setModal(true); setError(''); }}>
                    + Nouvelle diffusion
                </button>
                <button className="dt-btn" onClick={fetchBroadcasts}>↻ Actualiser</button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Cible</th>
                            <th>Total</th>
                            <th>Envoyés</th>
                            <th>Échecs</th>
                            <th>Taux</th>
                            <th>Statut</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : broadcasts.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucune diffusion lancée.</td></tr>
                        ) : broadcasts.map(b => {
                            const taux = b.total > 0 ? Math.round((b.envoyes / b.total) * 100) : 0;
                            return (
                                <tr key={b._id}>
                                    <td><span className="dt-mono">{b.templateName}</span></td>
                                    <td>{CIBLES.find(c => c.value === b.langue)?.label ?? b.langue}</td>
                                    <td style={{ textAlign: 'center' }}>{b.total}</td>
                                    <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{b.envoyes}</td>
                                    <td style={{ textAlign: 'center', color: b.echecs > 0 ? '#dc2626' : '#9ca3af' }}>{b.echecs}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                            fontWeight: 600,
                                            color: taux >= 80 ? '#16a34a' : taux >= 50 ? '#d97706' : '#dc2626'
                                        }}>{taux}%</span>
                                    </td>
                                    <td>
                                        <span className={`dt-badge ${STATUT_COLOR[b.statut] ?? 'dt-badge-inactif'}`}>
                                            {STATUT_LABEL[b.statut] ?? b.statut}
                                        </span>
                                    </td>
                                    <td>{new Date(b.createdAt).toLocaleString('fr-FR')}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">{broadcasts.length} diffusion{broadcasts.length !== 1 ? 's' : ''}</div>

            {/* Modal nouvelle diffusion */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nouvelle diffusion</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSend} className="modal-form">
                            {error && <div className="modal-error">⚠️ {error}</div>}

                            <div className="form-group">
                                <label>Template WhatsApp</label>
                                <select
                                    value={form.templateName}
                                    onChange={e => handleTemplateChange(e.target.value)}
                                >
                                    {TEMPLATES.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.label} {t.parametres > 0 ? `(${t.parametres} variable${t.parametres > 1 ? 's' : ''})` : '(fixe)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {nbParams > 0 && (
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
                                        Ces valeurs remplaceront les variables {`{{1}}`}, {`{{2}}`}... dans le template.
                                    </small>
                                </div>
                            )}

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
                                <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                    Code langue tel que défini dans Meta Business Manager
                                </small>
                            </div>

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

                            <div className="broadcast-warning">
                                ⚠️ Cette action enverra un message WhatsApp à tous les contacts sélectionnés.
                                Assurez-vous que le template est bien approuvé par Meta avant de lancer.
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={sending}>
                                    {sending ? 'Lancement...' : 'Lancer la diffusion'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
