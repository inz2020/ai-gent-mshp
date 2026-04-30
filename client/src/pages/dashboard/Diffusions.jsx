import { useEffect, useRef, useState } from 'react';
import {
    getBroadcasts, getBroadcastById, getContacts,
    sendBroadcast, uploadBroadcastMedia,
} from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

// ─── Types de variables ───────────────────────────────────────
// image/text/document → inclus dans le template Meta
// audio/audio_tts     → envoyés en message libre après le template (Meta ne supporte pas l'audio dans les templates)
const VAR_TYPES = [
    { value: 'text',      label: 'Texte',    icon: 'bi bi-chat-text-fill' },
    { value: 'image',     label: 'Image',    icon: 'bi bi-image-fill' },
    { value: 'audio',     label: 'Audio',    icon: 'bi bi-music-note-beamed' },
    { value: 'audio_tts', label: 'TTS',      icon: 'bi bi-volume-up-fill' },
    { value: 'document',  label: 'Doc',      icon: 'bi bi-file-earmark-fill' },
];
const AUDIO_VAR_TYPES  = ['audio', 'audio_tts'];
const MEDIA_VAR_TYPES  = ['image','audio','document'];
const ACCEPT_MAP = { image:'image/*', audio:'audio/*,.mp3,.ogg,.m4a', document:'.pdf,.doc,.docx' };

// ─── Statut ───────────────────────────────────────────────────
const STATUT_COLOR = { planifie:'dt-badge-inactif', en_cours:'dt-badge-warning', termine:'dt-badge-actif', erreur:'dt-badge-danger' };
const STATUT_LABEL = { planifie:'Planifie', en_cours:'En cours', termine:'Termine', erreur:'Erreur' };

const LANG_CODES = [
    { code:'fr', label:'Francais (fr)' },
    { code:'ha', label:'Hausa (ha)'   },
    { code:'en', label:'Anglais (en)' },
];

// ─── Helpers ──────────────────────────────────────────────────
let _varId = 0;
function newVar(type = 'text') {
    return { _id: ++_varId, type, value:'', ttsText:'', traduire:false, langueTraduction:'ha', mediaUrl:'', mediaFileName:'', uploading:false };
}

const DEFAULT_FORM = {
    templateName:   '',
    langueTemplate: 'fr',
    hasVariables:   false,
    variables:      [],
    dateEnvoi:      '',
    contactIds:     [],
};

export default function Diffusions() {
    const [broadcasts, setBroadcasts]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [modal, setModal]               = useState(false);
    const [sending, setSending]           = useState(false);
    const [success, setSuccess]           = useState('');
    const [error, setError]               = useState('');
    const [form, setForm]                 = useState(DEFAULT_FORM);

    // Contacts
    const [contacts, setContacts]         = useState([]);
    const [contactSearch, setContactSearch] = useState('');
    const [contactPanelOpen, setContactPanelOpen] = useState(false);
    const [loadingContacts, setLoadingContacts]   = useState(false);

    // Detail broadcast
    const [detail, setDetail]             = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fileRefs = useRef({});
    const pollingRef = useRef(null);
    const mountedRef = useRef(true);
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    const { paged, page, setPage, totalPages } = usePagination(broadcasts, 10);

    useEffect(() => { fetchBroadcasts(); }, []);

    // Polling "en_cours" — pas de stale closure : on lit l'état via setBroadcasts fonctionnel
    useEffect(() => {
        const hasActive = broadcasts.some(b => b.statut === 'en_cours');

        if (hasActive && !pollingRef.current) {
            pollingRef.current = setInterval(() => {
                setBroadcasts(prev => {
                    const active = prev.filter(b => b.statut === 'en_cours');
                    if (active.length === 0) {
                        clearInterval(pollingRef.current); pollingRef.current = null;
                        return prev;
                    }
                    Promise.all(active.map(b => getBroadcastById(b._id).catch(() => b)))
                        .then(updated => {
                            if (!mountedRef.current) return;
                            setBroadcasts(p => p.map(b => updated.find(u => u._id === b._id) ?? b));
                            if (!updated.some(u => u.statut === 'en_cours')) {
                                clearInterval(pollingRef.current); pollingRef.current = null;
                            }
                        });
                    return prev;
                });
            }, 4000);
        }

        if (!hasActive && pollingRef.current) {
            clearInterval(pollingRef.current); pollingRef.current = null;
        }

        return () => {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        };
    }, [broadcasts]);

    async function fetchBroadcasts() {
        setLoading(true);
        try { setBroadcasts(await getBroadcasts()); }
        catch (e) { setError(e.message); }
        finally   { setLoading(false); }
    }

    async function openContactPanel() {
        setContactPanelOpen(true);
        if (contacts.length > 0) return;
        setLoadingContacts(true);
        try { setContacts(await getContacts()); }
        catch (e) { setError(e.message); }
        finally   { setLoadingContacts(false); }
    }

    async function openDetail(b) {
        setDetailLoading(true);
        setDetail(b);
        try { setDetail(await getBroadcastById(b._id)); }
        catch {}
        finally { setDetailLoading(false); }
    }

    // ── Variables ─────────────────────────────────────────────
    function addVar() {
        setForm(f => ({ ...f, variables: [...f.variables, newVar('text')] }));
    }

    function removeVar(id) {
        setForm(f => ({ ...f, variables: f.variables.filter(v => v._id !== id) }));
    }

    function updateVar(id, patch) {
        setForm(f => ({
            ...f,
            variables: f.variables.map(v => v._id === id ? { ...v, ...patch } : v),
        }));
    }

    async function uploadVar(id, file, type) {
        updateVar(id, { uploading: true });
        try {
            const result = await uploadBroadcastMedia(file, type);
            updateVar(id, { mediaUrl: result.url, mediaFileName: file.name, uploading: false });
        } catch (err) {
            setError(err.message);
            updateVar(id, { uploading: false });
        }
    }

    // ── Contacts ──────────────────────────────────────────────
    const filteredContacts = contacts.filter(c => {
        const q = contactSearch.toLowerCase();
        return !q || c.nom?.toLowerCase().includes(q) || c.whatsappId?.includes(q);
    });

    function toggleContact(id) {
        setForm(f => ({
            ...f,
            contactIds: f.contactIds.includes(id) ? f.contactIds.filter(x => x !== id) : [...f.contactIds, id],
        }));
    }

    // ── Envoi ─────────────────────────────────────────────────
    async function handleSend(e) {
        e.preventDefault();
        if (!form.templateName.trim()) { setError('Saisissez le nom du template.'); return; }
        if (form.contactIds.length === 0) { setError('Selectionnez au moins un contact.'); return; }
        setSending(true); setError('');
        try {
            const res = await sendBroadcast({
                templateName:   form.templateName.trim(),
                langueTemplate: form.langueTemplate,
                variables:      form.hasVariables ? form.variables.map(({ _id, uploading, ...v }) => v) : [],
                contactIds:     form.contactIds,
                dateEnvoi:      form.dateEnvoi || undefined,
            });
            setSuccess(res.message);
            setModal(false);
            setForm(DEFAULT_FORM);
            setContactPanelOpen(false);
            setTimeout(() => { setSuccess(''); fetchBroadcasts(); }, 4000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    function openModal() {
        setForm(DEFAULT_FORM);
        setContactPanelOpen(false);
        setContactSearch('');
        setError('');
        setModal(true);
    }

    // ── Stats tableau ─────────────────────────────────────────
    const totalEnvoyes  = broadcasts.reduce((s,b) => s+(b.envoyes??0),0);
    const totalContacts = broadcasts.reduce((s,b) => s+(b.total??0),0);
    const totalLivre    = broadcasts.reduce((s,b) => s+(b.livre??0),0);
    const totalLu       = broadcasts.reduce((s,b) => s+(b.lu??0),0);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Diffusions WhatsApp</h1>
            <p className="dash-page-sub">Creez et suivez vos diffusions de templates vers vos contacts.</p>

            {success && <div className="dt-success">&#10003; {success}</div>}
            {error && !modal && <div className="dt-error">&#9888; {error}</div>}

            {/* Stats */}
            <div className="broadcast-stats">
                {[
                    { num: broadcasts.length, label:'Diffusions' },
                    { num: totalEnvoyes,       label:'Envoyes' },
                    { num: totalLivre,         label:'Livres' },
                    { num: totalLu,            label:'Lus' },
                    { num: totalContacts>0 ? Math.round((totalEnvoyes/totalContacts)*100)+'%' : '0%', label:'Taux envoi' },
                ].map(s => (
                    <div key={s.label} className="bstat-card">
                        <span className="bstat-num">{s.num}</span>
                        <span className="bstat-label">{s.label}</span>
                    </div>
                ))}
            </div>

            <div className="dt-toolbar">
                <button className="dt-btn dt-btn-primary" onClick={openModal}>+ Nouvelle diffusion</button>
                <button className="dt-btn" onClick={fetchBroadcasts}>&#8635; Actualiser</button>
            </div>

            {/* Tableau */}
            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Var.</th>
                            <th>Total</th>
                            <th>Envoyes</th>
                            <th>Livres</th>
                            <th>Lus</th>
                            <th>Echecs</th>
                            <th>Statut</th>
                            <th>Date</th>
                            <th>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="10" className="dt-center">Chargement...</td></tr>
                        ) : broadcasts.length === 0 ? (
                            <tr><td colSpan="10" className="dt-center">Aucune diffusion.</td></tr>
                        ) : paged.map(b => {
                            const pct  = b.total>0 ? Math.round(((b.envoyes??0)/b.total)*100) : 0;
                            const vars = b.variables ?? [];
                            return (
                                <tr key={b._id}>
                                    <td><span className="dt-mono">{b.templateName}</span></td>
                                    <td style={{ textAlign:'center' }}>
                                        {vars.length > 0
                                            ? <span title={vars.map(v=>v.type).join(', ')} style={{ fontSize:'0.78rem', color:'var(--gray-600)', display:'flex', gap:4, justifyContent:'center' }}>
                                                {vars.map((v, i) => {
                                                    const icon = VAR_TYPES.find(t=>t.value===v.type)?.icon;
                                                    return icon ? <i key={i} className={icon}></i> : '?';
                                                })}
                                              </span>
                                            : <span className="dt-muted">—</span>
                                        }
                                    </td>
                                    <td style={{ textAlign:'center' }}>{b.total}</td>
                                    <td style={{ textAlign:'center' }}>
                                        <strong style={{ color:'#16a34a' }}>{b.envoyes??0}</strong>
                                        {b.statut==='en_cours' && <span style={{ fontSize:'0.7rem',color:'#9ca3af',marginLeft:3 }}>({pct}%)</span>}
                                    </td>
                                    <td style={{ textAlign:'center', color:'#2563eb' }}>{b.livre??0}</td>
                                    <td style={{ textAlign:'center', color:'#7c3aed' }}>{b.lu??0}</td>
                                    <td style={{ textAlign:'center', color:(b.echecs??0)>0?'#dc2626':'#9ca3af' }}>{b.echecs??0}</td>
                                    <td>
                                        <span className={`dt-badge ${STATUT_COLOR[b.statut]??'dt-badge-inactif'}`}>
                                            {STATUT_LABEL[b.statut]??b.statut}
                                        </span>
                                    </td>
                                    <td style={{ fontSize:'0.8rem', color:'#6b7280' }}>
                                        {b.dateEnvoi && b.statut==='planifie'
                                            ? `Plan.: ${new Date(b.dateEnvoi).toLocaleString('fr-FR')}`
                                            : new Date(b.createdAt).toLocaleString('fr-FR')
                                        }
                                    </td>
                                    <td>
                                        <button className="dt-btn dt-btn-edit" onClick={() => openDetail(b)}>
                                            Detail
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{broadcasts.length} diffusion{broadcasts.length!==1?'s':''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* ═══════════ MODAL CREATION ═══════════ */}
            {modal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth:580 }}>
                        <div className="modal-header">
                            <h2>Nouvelle diffusion</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>

                        <form onSubmit={handleSend} className="modal-form">
                            {error && <div className="modal-error">&#9888; {error}</div>}

                            {/* ── Nom du template (libre) ── */}
                            <div className="form-group">
                                <label>Nom du template WhatsApp</label>
                                <input
                                    placeholder="Ex: rappel_vaccin, esante_alerte..."
                                    value={form.templateName}
                                    onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))}
                                    required
                                    list="template-suggestions"
                                />
                                <datalist id="template-suggestions">
                                    {[...new Set(broadcasts.map(b => b.templateName))].map(n => (
                                        <option key={n} value={n} />
                                    ))}
                                </datalist>
                                <small style={{ color:'#94a3b8', fontSize:'0.78rem' }}>
                                    Doit correspondre exactement au nom approuvé dans Meta Business Manager.
                                </small>
                            </div>

                            {/* ── Langue ── */}
                            <div className="form-group">
                                <label>Langue du template</label>
                                <select value={form.langueTemplate} onChange={e => setForm(f => ({ ...f, langueTemplate: e.target.value }))}>
                                    {LANG_CODES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                </select>
                            </div>

                            {/* ── Variables ── */}
                            <div className="form-group">
                                <div className="var-section-header">
                                    <label>Variables du template</label>
                                    <label className="bc-toggle" style={{ fontWeight:400 }}>
                                        <input type="checkbox" checked={form.hasVariables}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                hasVariables: e.target.checked,
                                                variables: e.target.checked && f.variables.length === 0 ? [newVar()] : f.variables,
                                            }))} />
                                        <span className="bc-toggle-track" />
                                        <span className="bc-toggle-label">{form.hasVariables ? 'Actif' : 'Sans variable'}</span>
                                    </label>
                                </div>

                                {form.hasVariables && (
                                    <div className="var-list">
                                        {form.variables.map((v, idx) => (
                                            <VarRow key={v._id}
                                                index={idx + 1}
                                                v={v}
                                                fileRef={el => fileRefs.current[v._id] = el}
                                                onChange={patch => updateVar(v._id, patch)}
                                                onUpload={(file, type) => uploadVar(v._id, file, type)}
                                                onRemove={() => removeVar(v._id)}
                                            />
                                        ))}
                                        <button type="button" className="var-add-btn" onClick={addVar}>
                                            + Ajouter une variable
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── Contacts ── */}
                            <div className="form-group">
                                <div className="bc-contacts-header">
                                    <label>
                                        Contacts
                                        {form.contactIds.length > 0 && (
                                            <span className="bc-contacts-count">{form.contactIds.length} selectionne{form.contactIds.length>1?'s':''}</span>
                                        )}
                                    </label>
                                    <button type="button" className="dt-btn dt-btn-primary bc-contacts-btn"
                                        onClick={openContactPanel}>
                                        {contactPanelOpen ? 'Fermer' : '+ Choisir'}
                                    </button>
                                </div>

                                {contactPanelOpen && (
                                    <div className="bc-contact-panel">
                                        <div className="bc-contact-search-row">
                                            <input className="bc-contact-search"
                                                placeholder="Rechercher..."
                                                value={contactSearch}
                                                onChange={e => setContactSearch(e.target.value)} />
                                            <button type="button" className="bc-sel-btn"
                                                onClick={() => setForm(f => ({ ...f, contactIds: filteredContacts.map(c => c._id) }))}>Tout</button>
                                            <button type="button" className="bc-sel-btn"
                                                onClick={() => setForm(f => ({ ...f, contactIds: [] }))}>Aucun</button>
                                        </div>
                                        <div className="bc-contact-list">
                                            {loadingContacts ? (
                                                <div className="bc-contact-loading"><span className="bc-spinner"/><span>Chargement...</span></div>
                                            ) : filteredContacts.length === 0 ? (
                                                <div className="bc-contact-empty">Aucun contact trouvé.</div>
                                            ) : filteredContacts.map(c => {
                                                const checked = form.contactIds.includes(c._id);
                                                const initiale = c.nom?.[0]?.toUpperCase() ?? '?';
                                                return (
                                                    <label key={c._id} className={`bc-contact-row${checked ? ' checked' : ''}`}>
                                                        <input type="checkbox" checked={checked} onChange={() => toggleContact(c._id)} />
                                                        <div className="bc-contact-check" />
                                                        <div className="bc-contact-avatar">{initiale}</div>
                                                        <div className="bc-contact-info">
                                                            <span className="bc-contact-name">{c.nom}</span>
                                                            <span className="bc-contact-phone">+{c.whatsappId}</span>
                                                        </div>
                                                        <span className={`bc-contact-lang bc-lang-${c.langue === 'fr' ? 'fr' : 'ha'}`}>
                                                            {c.langue === 'fr' ? 'FR' : 'HA'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="bc-contact-footer">
                                            <span>{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</span>
                                            <span>
                                                <span className="bc-contact-footer-count">{form.contactIds.length}</span>
                                                {' / '}{contacts.length} sélectionné{form.contactIds.length > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Planification ── */}
                            <div className="form-group">
                                <label>Planifier l'envoi (optionnel)</label>
                                <input type="datetime-local" value={form.dateEnvoi}
                                    onChange={e => setForm(f => ({ ...f, dateEnvoi: e.target.value }))} />
                            </div>

                            <div className="broadcast-warning">
                                &#9888; Le template doit etre approuve par Meta avant de lancer.<br/>
                                <span style={{ fontSize:'0.78rem', opacity:0.85 }}>
                                    &#128247; Image / Texte / Document → envoyes via le template.<br/>
                                    &#127908; Audio / TTS → envoyes en message libre juste apres (Meta ne supporte pas l'audio dans les templates).
                                </span>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={sending}>
                                    {sending ? 'Lancement...' : form.dateEnvoi
                                        ? 'Planifier'
                                        : `Envoyer a ${form.contactIds.length} contact${form.contactIds.length!==1?'s':''}`
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════ MODAL DETAIL ═══════════ */}
            {detail && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth:520 }}>
                        <div className="modal-header">
                            <h2>Detail — <span className="dt-mono" style={{ fontSize:'0.95rem' }}>{detail.templateName}</span></h2>
                            <button className="modal-close" onClick={() => setDetail(null)}>&#10005;</button>
                        </div>
                        <div className="modal-body" style={{ padding:'20px 24px' }}>
                            {detailLoading ? <div className="dt-center">Chargement...</div> : (
                                <>
                                    {/* Statut */}
                                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                                        <span className={`dt-badge ${STATUT_COLOR[detail.statut]??'dt-badge-inactif'}`} style={{ fontSize:'0.9rem', padding:'5px 14px' }}>
                                            {STATUT_LABEL[detail.statut]??detail.statut}
                                        </span>
                                        <span style={{ fontSize:'0.82rem', color:'#9ca3af' }}>
                                            {new Date(detail.createdAt).toLocaleString('fr-FR')}
                                        </span>
                                    </div>

                                    {/* Barre de progression */}
                                    {detail.total > 0 && (
                                        <div style={{ marginBottom:18 }}>
                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'#6b7280', marginBottom:4 }}>
                                                <span>Progression</span>
                                                <span>{detail.envoyes??0} / {detail.total}</span>
                                            </div>
                                            <div style={{ background:'#f3f4f6', borderRadius:99, height:8, overflow:'hidden' }}>
                                                <div style={{
                                                    height:'100%', borderRadius:99, transition:'width 0.4s',
                                                    background: detail.statut==='erreur' ? '#ef4444' : 'var(--green)',
                                                    width: `${Math.round(((detail.envoyes??0)/detail.total)*100)}%`,
                                                }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Stats cards */}
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:18 }}>
                                        {[
                                            { label:'Envoyes',   value:detail.envoyes??0, color:'#16a34a' },
                                            { label:'Livres',    value:detail.livre??0,   color:'#2563eb' },
                                            { label:'Lus',       value:detail.lu??0,      color:'#7c3aed' },
                                            { label:'Echecs',    value:detail.echecs??0,  color:(detail.echecs??0)>0?'#dc2626':'#9ca3af' },
                                        ].map(s => (
                                            <div key={s.label} style={{ textAlign:'center', background:'#f9fafb', borderRadius:8, padding:'10px 6px' }}>
                                                <div style={{ fontWeight:700, fontSize:'1.3rem', color:s.color }}>{s.value}</div>
                                                <div style={{ fontSize:'0.72rem', color:'#9ca3af' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Variables configurees */}
                                    {(detail.variables?.length > 0) && (
                                        <div style={{ marginBottom:16 }}>
                                            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                                                Variables
                                            </div>
                                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                                {detail.variables.map((v, i) => {
                                                    const vt = VAR_TYPES.find(t => t.value === v.type);
                                                    return (
                                                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background:'#f9fafb', borderRadius:8, padding:'8px 12px', fontSize:'0.85rem' }}>
                                                            <span style={{ fontSize:'1rem' }}>{vt?.icon}</span>
                                                            <span style={{ fontWeight:600, color:'#374151' }}>Var {i+1} — {vt?.label}</span>
                                                            {v.type==='text' && <span style={{ color:'#6b7280', marginLeft:'auto' }}>{v.value}</span>}
                                                            {v.mediaUrl && v.type==='image' && (
                                                                <img src={v.mediaUrl} alt="" style={{ height:32, width:32, objectFit:'cover', borderRadius:4, marginLeft:'auto' }} />
                                                            )}
                                                            {v.mediaUrl && v.type==='audio' && (
                                                                <audio controls src={v.mediaUrl} style={{ height:28, marginLeft:'auto' }} />
                                                            )}
                                                            {v.mediaUrl && v.type==='audio_tts' && (
                                                                <audio controls src={v.mediaUrl} style={{ height:28, marginLeft:'auto' }} />
                                                            )}
                                                            {v.mediaUrl && v.type==='document' && (
                                                                <a href={v.mediaUrl} target="_blank" rel="noreferrer" style={{ color:'var(--green)', marginLeft:'auto', fontSize:'0.78rem' }}>{v.mediaFileName || 'Voir'}</a>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Message d'erreur */}
                                    {detail.errorLog && (
                                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:'0.84rem', color:'#dc2626' }}>
                                            <strong>Erreur :</strong> {detail.errorLog}
                                            <div style={{ marginTop:6, color:'#ef4444', fontSize:'0.78rem' }}>
                                                Cause probable : template non approuve par Meta, numero invalide, ou limite de taux atteinte.
                                            </div>
                                        </div>
                                    )}

                                    {/* Guide statuts */}
                                    {!detail.errorLog && (
                                        <div style={{ marginTop:12, fontSize:'0.78rem', color:'#9ca3af', lineHeight:1.7 }}>
                                            <strong style={{ color:'#6b7280' }}>Comprendre les statuts :</strong><br/>
                                            <span style={{ color:'#16a34a' }}>Envoyes</span> = acceptes par l'API Meta •{' '}
                                            <span style={{ color:'#2563eb' }}>Livres</span> = arrives sur le telephone •{' '}
                                            <span style={{ color:'#7c3aed' }}>Lus</span> = ouverts par le contact •{' '}
                                            <span style={{ color:'#dc2626' }}>Echecs</span> = rejetes (template non approuve, numero invalide, hors reseau)
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setDetail(null)}>Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Composant ligne de variable ──────────────────────────────
function VarRow({ index, v, onChange, onUpload, onRemove, fileRef }) {
    const inputRef = useRef(null);
    const isMedia  = MEDIA_VAR_TYPES.includes(v.type);
    const isTTS    = v.type === 'audio_tts';
    const isAudio  = AUDIO_VAR_TYPES.includes(v.type);

    return (
        <div className="var-row">
            {/* Index */}
            <span className="var-index">{index}</span>
            {isAudio && (
                <span title="Envoye en message libre apres le template" style={{ fontSize:'0.68rem', background:'#eff6ff', color:'#2563eb', borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap' }}>
                    msg libre
                </span>
            )}

            {/* Type selector */}
            <div className="var-type-tabs">
                {VAR_TYPES.map(vt => (
                    <button key={vt.value} type="button"
                        title={vt.label}
                        className={`var-type-btn${v.type === vt.value ? ' active' : ''}`}
                        onClick={() => onChange({ type: vt.value, value:'', mediaUrl:'', mediaFileName:'', ttsText:'' })}>
                        <i className={vt.icon}></i>
                    </button>
                ))}
            </div>

            {/* Contenu selon le type */}
            <div className="var-content">
                {v.type === 'text' && (
                    <input placeholder={`Valeur variable {{${index}}}`}
                        value={v.value}
                        onChange={e => onChange({ value: e.target.value })} />
                )}

                {isTTS && (
                    <div className="var-tts">
                        <textarea rows={2} placeholder="Texte a convertir en voix..."
                            value={v.ttsText}
                            onChange={e => onChange({ ttsText: e.target.value })}
                            style={{ resize:'vertical', minHeight:52 }} />
                        <label className="bc-toggle" style={{ marginTop:4 }}>
                            <input type="checkbox" checked={v.traduire}
                                onChange={e => onChange({ traduire: e.target.checked })} />
                            <span className="bc-toggle-track" />
                            <span className="bc-toggle-label" style={{ fontSize:'0.78rem' }}>Traduire</span>
                        </label>
                        {v.traduire && (
                            <select value={v.langueTraduction} onChange={e => onChange({ langueTraduction: e.target.value })}
                                style={{ marginTop:4, padding:'4px 8px', borderRadius:6, border:'1.5px solid #e5e7eb', fontSize:'0.8rem' }}>
                                <option value="ha">Vers Hausa</option>
                                <option value="fr">Vers Francais</option>
                            </select>
                        )}
                    </div>
                )}

                {isMedia && !v.mediaUrl && (
                    <div className={`var-upload${v.uploading ? ' loading' : ''}`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                        onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const f = e.dataTransfer.files?.[0]; if (f) onUpload(f, v.type); }}>
                        {v.uploading
                            ? <><span className="bc-spinner"/><span style={{ fontSize:'0.8rem' }}>Upload...</span></>
                            : <><i className={v.type==='image'?'bi bi-image-fill':v.type==='document'?'bi bi-file-earmark-fill':'bi bi-music-note-beamed'}></i><span style={{ fontSize:'0.78rem' }}>Cliquez ou glissez</span></>
                        }
                    </div>
                )}

                {isMedia && v.mediaUrl && (
                    <div className="var-preview">
                        {v.type==='image'    && <img src={v.mediaUrl} alt="" />}
                        {v.type==='audio'    && <audio controls src={v.mediaUrl} style={{ height:30, width:'100%' }} />}
                        {v.type==='document' && <span style={{ fontSize:'0.8rem' }}><i className="bi bi-file-earmark-fill"></i> {v.mediaFileName}</span>}
                        <button type="button" className="bc-remove-file"
                            onClick={() => onChange({ mediaUrl:'', mediaFileName:'' })}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                )}

                <input ref={r => { inputRef.current = r; if (fileRef) fileRef(r); }}
                    type="file" style={{ display:'none' }}
                    accept={ACCEPT_MAP[v.type]}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f, v.type); }} />
            </div>

            {/* Supprimer */}
            <button type="button" className="var-remove" onClick={onRemove}><i className="bi bi-x-lg"></i></button>
        </div>
    );
}
