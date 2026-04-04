import { useEffect, useRef, useState } from 'react';
import { getBroadcasts, getBroadcastById, getContacts, sendBroadcast, uploadBroadcastMedia } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const TEMPLATES = [
    { name: 'esante',          label: 'eSante — Message de sante',        parametres: 0 },
    { name: 'rappel_vaccin',   label: 'Rappel de vaccination',             parametres: 2 },
    { name: 'alerte_campagne', label: 'Alerte campagne de vaccination',    parametres: 1 },
    { name: 'audio_sante',     label: 'Message audio sante (MP3)',         parametres: 0 },
    { name: 'image_sante',     label: 'Visuel sante (image)',              parametres: 0 },
    { name: 'document_guide',  label: 'Guide PDF (document)',              parametres: 0 },
];

// Types de media — les types "header" sont mutuellement exclusifs entre eux
// "texte" (variables) peut se combiner avec n'importe quel header
const MEDIA_OPTIONS = [
    { value: 'texte',    label: 'Variables',    icon: '💬', isHeader: false },
    { value: 'tts',      label: 'Audio TTS',    icon: '🔊', isHeader: true  },
    { value: 'audio',    label: 'Fichier audio',icon: '🎵', isHeader: true  },
    { value: 'image',    label: 'Image',        icon: '🖼️', isHeader: true  },
    { value: 'document', label: 'Document',     icon: '📄', isHeader: true  },
];

const ACCEPT = { audio: 'audio/*,.ogg,.mp3,.m4a', image: 'image/*', document: '.pdf,.doc,.docx' };

const STATUT_COLOR  = { planifie:'dt-badge-inactif', en_cours:'dt-badge-warning', termine:'dt-badge-actif', erreur:'dt-badge-danger' };
const STATUT_LABEL  = { planifie:'Planifie', en_cours:'En cours', termine:'Termine', erreur:'Erreur' };
const TYPE_ICON     = { texte:'💬', tts:'🔊', audio:'🎵', image:'🖼️', document:'📄' };

const DEFAULT_FORM = {
    templateName:    'esante',
    langueTemplate:  'fr',
    parametres:      [],
    mediaTypes:      [],       // tableau : ex. ['image', 'texte']
    messageAudio:    '',
    mediaUrl:        '',
    mediaFileName:   '',
    traduire:        false,
    langueTraduction:'ha',
    dateEnvoi:       '',
    contactIds:      [],       // IDs des contacts selectionnes
};

export default function Diffusions() {
    const [broadcasts, setBroadcasts]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [modal, setModal]               = useState(false);
    const [sending, setSending]           = useState(false);
    const [uploading, setUploading]       = useState(false);
    const [success, setSuccess]           = useState('');
    const [error, setError]               = useState('');
    const [form, setForm]                 = useState(DEFAULT_FORM);
    const [preview, setPreview]           = useState(null);

    // Selecteur de contacts
    const [contacts, setContacts]         = useState([]);
    const [contactSearch, setContactSearch] = useState('');
    const [contactPanelOpen, setContactPanelOpen] = useState(false);
    const [loadingContacts, setLoadingContacts]   = useState(false);

    const fileInputRef = useRef(null);
    const pollingRef   = useRef(null);

    const { paged: pagedBroadcasts, page, setPage, totalPages } = usePagination(broadcasts);
    const selectedTemplate = TEMPLATES.find(t => t.name === form.templateName) ?? TEMPLATES[0];
    const nbParams    = selectedTemplate.parametres ?? 0;
    const headerType  = form.mediaTypes.find(t => MEDIA_OPTIONS.find(o => o.value === t)?.isHeader);
    const hasTexte    = form.mediaTypes.includes('texte');
    const needsFile   = ['audio', 'image', 'document'].includes(headerType);
    const needsTTS    = headerType === 'tts';

    // Contacts filtres par la recherche
    const filteredContacts = contacts.filter(c => {
        const q = contactSearch.toLowerCase();
        return !q || c.nom?.toLowerCase().includes(q) || c.whatsappId?.includes(q);
    });

    useEffect(() => { fetchBroadcasts(); }, []);

    useEffect(() => {
        const hasActive = broadcasts.some(b => b.statut === 'en_cours');
        if (hasActive && !pollingRef.current) {
            pollingRef.current = setInterval(async () => {
                const active  = broadcasts.filter(b => b.statut === 'en_cours');
                const updated = await Promise.all(active.map(b => getBroadcastById(b._id).catch(() => b)));
                setBroadcasts(prev => prev.map(b => updated.find(u => u._id === b._id) ?? b));
                if (!updated.some(u => u.statut === 'en_cours')) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            }, 4000);
        }
        if (!hasActive && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
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

    // ── Gestion multi-select media ──────────────────────────────
    function toggleMediaType(value) {
        const opt = MEDIA_OPTIONS.find(o => o.value === value);
        setForm(f => {
            let types = [...f.mediaTypes];
            if (types.includes(value)) {
                types = types.filter(t => t !== value);
            } else {
                if (opt.isHeader) {
                    // Remplace tout autre header existant
                    types = types.filter(t => !MEDIA_OPTIONS.find(o => o.value === t)?.isHeader);
                }
                types.push(value);
            }
            // Reset champs media si le header change
            const prevHeader = f.mediaTypes.find(t => MEDIA_OPTIONS.find(o => o.value === t)?.isHeader);
            const newHeader  = types.find(t => MEDIA_OPTIONS.find(o => o.value === t)?.isHeader);
            return {
                ...f,
                mediaTypes:   types,
                mediaUrl:     newHeader !== prevHeader ? '' : f.mediaUrl,
                mediaFileName:newHeader !== prevHeader ? '' : f.mediaFileName,
                messageAudio: newHeader !== prevHeader ? '' : f.messageAudio,
            };
        });
        if (needsFile) setPreview(null);
    }

    // ── Upload fichier ──────────────────────────────────────────
    async function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const result = await uploadBroadcastMedia(file, headerType);
            setForm(f => ({ ...f, mediaUrl: result.url, mediaFileName: file.name }));
            setPreview({ type: headerType, url: result.url, name: file.name });
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    }

    function clearFile() {
        setForm(f => ({ ...f, mediaUrl: '', mediaFileName: '' }));
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ── Selection de contacts ───────────────────────────────────
    function toggleContact(id) {
        setForm(f => ({
            ...f,
            contactIds: f.contactIds.includes(id)
                ? f.contactIds.filter(c => c !== id)
                : [...f.contactIds, id],
        }));
    }

    function selectAll() {
        setForm(f => ({ ...f, contactIds: filteredContacts.map(c => c._id) }));
    }

    function deselectAll() {
        setForm(f => ({ ...f, contactIds: [] }));
    }

    // ── Envoi ───────────────────────────────────────────────────
    async function handleSend(e) {
        e.preventDefault();
        if (form.contactIds.length === 0) { setError('Veuillez selectionner au moins un contact.'); return; }
        if (needsFile && !form.mediaUrl)  { setError('Veuillez charger un fichier avant de lancer.'); return; }
        if (needsTTS && !form.messageAudio.trim()) { setError('Saisissez le texte a convertir en audio.'); return; }
        setSending(true); setError('');
        try {
            const res = await sendBroadcast({
                templateName:     form.templateName,
                type:             headerType ?? 'texte',
                langue:           'tous',
                contactIds:       form.contactIds,
                langueTemplate:   form.langueTemplate,
                parametres:       form.parametres,
                messageAudio:     form.messageAudio,
                mediaUrl:         form.mediaUrl,
                mediaFileName:    form.mediaFileName,
                traduire:         form.traduire,
                langueTraduction: form.langueTraduction,
                dateEnvoi:        form.dateEnvoi || undefined,
            });
            setSuccess(res.message);
            setModal(false);
            setForm(DEFAULT_FORM);
            setPreview(null);
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
        setPreview(null);
        setContactPanelOpen(false);
        setContactSearch('');
        setError('');
        setModal(true);
    }

    const totalEnvoyes  = broadcasts.reduce((s,b) => s+(b.envoyes??0),0);
    const totalContacts = broadcasts.reduce((s,b) => s+(b.total??0),0);
    const totalLivre    = broadcasts.reduce((s,b) => s+(b.livre??0),0);
    const totalLu       = broadcasts.reduce((s,b) => s+(b.lu??0),0);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Diffusions WhatsApp</h1>
            <p className="dash-page-sub">Envoyez des messages texte, audio, image ou document a vos contacts.</p>

            {success && <div className="dt-success">&#10003; {success}</div>}
            {error   && !modal && <div className="dt-error">&#9888; {error}</div>}

            <div className="broadcast-stats">
                {[
                    { num: broadcasts.length, label: 'Diffusions' },
                    { num: totalEnvoyes,       label: 'Envoyes' },
                    { num: totalLivre,         label: 'Livres' },
                    { num: totalLu,            label: 'Lus' },
                    { num: totalContacts > 0 ? Math.round((totalEnvoyes/totalContacts)*100)+'%' : '0%', label: 'Taux envoi' },
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

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Template</th><th>Type</th><th>Total</th>
                            <th>Envoyes</th><th>Livres</th><th>Lus</th>
                            <th>Echecs</th><th>Statut</th><th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="dt-center">Chargement...</td></tr>
                        ) : broadcasts.length === 0 ? (
                            <tr><td colSpan="9" className="dt-center">Aucune diffusion.</td></tr>
                        ) : pagedBroadcasts.map(b => {
                            const pct = b.total > 0 ? Math.round(((b.envoyes??0)/b.total)*100) : 0;
                            return (
                                <tr key={b._id}>
                                    <td><span className="dt-mono">{b.templateName}</span></td>
                                    <td style={{ textAlign:'center', fontSize:'1.1rem' }}>{TYPE_ICON[b.type]??'💬'}</td>
                                    <td style={{ textAlign:'center' }}>{b.total}</td>
                                    <td style={{ textAlign:'center' }}>
                                        <strong style={{ color:'#16a34a' }}>{b.envoyes}</strong>
                                        {b.statut==='en_cours' && <span style={{ fontSize:'0.75rem',color:'#9ca3af',marginLeft:4 }}>({pct}%)</span>}
                                    </td>
                                    <td style={{ textAlign:'center',color:'#2563eb' }}>{b.livre??0}</td>
                                    <td style={{ textAlign:'center',color:'#7c3aed' }}>{b.lu??0}</td>
                                    <td style={{ textAlign:'center',color:(b.echecs??0)>0?'#dc2626':'#9ca3af' }}>{b.echecs??0}</td>
                                    <td><span className={`dt-badge ${STATUT_COLOR[b.statut]??'dt-badge-inactif'}`}>{STATUT_LABEL[b.statut]??b.statut}</span></td>
                                    <td style={{ fontSize:'0.82rem',color:'#6b7280' }}>
                                        {b.dateEnvoi && b.statut==='planifie'
                                            ? `Plan. : ${new Date(b.dateEnvoi).toLocaleString('fr-FR')}`
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
                <span>{broadcasts.length} diffusion{broadcasts.length!==1?'s':''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* ══════════════ MODAL ══════════════ */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(false)}>
                    <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nouvelle diffusion</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>

                        <form onSubmit={handleSend} className="modal-form">
                            {error && <div className="modal-error">&#9888; {error}</div>}

                            {/* ── Template ── */}
                            <div className="form-group">
                                <label>Template WhatsApp</label>
                                <select value={form.templateName} onChange={e => {
                                    const tpl = TEMPLATES.find(t => t.name === e.target.value) ?? TEMPLATES[0];
                                    setForm(f => ({ ...f, templateName: tpl.name, parametres: Array(tpl.parametres).fill('') }));
                                }}>
                                    {TEMPLATES.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.label}{t.parametres > 0 ? ` — ${t.parametres} var.` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ── Types de media (multi-select) ── */}
                            <div className="form-group">
                                <label>Contenu du message <span style={{ fontWeight:400, color:'var(--gray-400)', fontSize:'0.8rem' }}>(plusieurs possibles)</span></label>
                                <div className="bc-media-tabs">
                                    {MEDIA_OPTIONS.map(opt => {
                                        const active = form.mediaTypes.includes(opt.value);
                                        return (
                                            <button key={opt.value} type="button"
                                                className={`bc-media-tab${active ? ' active' : ''}`}
                                                onClick={() => toggleMediaType(opt.value)}
                                            >
                                                <span>{opt.icon}</span>
                                                <span>{opt.label}</span>
                                                {active && <span className="bc-check">&#10003;</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {headerType && <small style={{ color:'#94a3b8', fontSize:'0.78rem' }}>Header : {headerType}{hasTexte ? ' + variables corps' : ''}</small>}
                            </div>

                            {/* ── Variables texte ── */}
                            {hasTexte && nbParams > 0 && (
                                <div className="form-group">
                                    <label>Variables du template</label>
                                    {Array.from({ length: nbParams }).map((_, i) => (
                                        <input key={i} style={{ marginBottom:6 }}
                                            placeholder={`{{${i+1}}} — parametre ${i+1}`}
                                            value={form.parametres[i]??''}
                                            onChange={e => {
                                                const p = [...form.parametres]; p[i] = e.target.value;
                                                setForm(f => ({ ...f, parametres: p }));
                                            }}
                                            required
                                        />
                                    ))}
                                </div>
                            )}

                            {/* ── TTS ── */}
                            {needsTTS && (
                                <div className="form-group">
                                    <label>Texte a convertir en audio</label>
                                    <textarea rows={3} style={{ resize:'vertical', minHeight:80 }}
                                        placeholder="Ecrivez le message qui sera converti en voix..."
                                        value={form.messageAudio}
                                        onChange={e => setForm(f => ({ ...f, messageAudio: e.target.value }))}
                                        required
                                    />
                                    <div className="bc-translate-row">
                                        <label className="bc-toggle">
                                            <input type="checkbox" checked={form.traduire}
                                                onChange={e => setForm(f => ({ ...f, traduire: e.target.checked }))} />
                                            <span className="bc-toggle-track" />
                                            <span className="bc-toggle-label">Traduire avant envoi</span>
                                        </label>
                                        {form.traduire && (
                                            <select value={form.langueTraduction}
                                                onChange={e => setForm(f => ({ ...f, langueTraduction: e.target.value }))}
                                                style={{ marginLeft:8, padding:'4px 10px', borderRadius:6, border:'1.5px solid #e5e7eb', fontSize:'0.85rem' }}>
                                                <option value="ha">Vers Hausa</option>
                                                <option value="fr">Vers Francais</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Upload fichier ── */}
                            {needsFile && (
                                <div className="form-group">
                                    <label>
                                        {headerType==='audio' && 'Fichier audio (MP3, OGG, M4A)'}
                                        {headerType==='image' && 'Image (JPG, PNG, WEBP)'}
                                        {headerType==='document' && 'Document (PDF, DOC, DOCX)'}
                                    </label>
                                    {!preview ? (
                                        <div className="bc-upload-zone"
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                                            onDrop={e => {
                                                e.preventDefault(); e.currentTarget.classList.remove('drag-over');
                                                const f = e.dataTransfer.files?.[0];
                                                if (f) handleFileChange({ target:{ files:[f] } });
                                            }}>
                                            {uploading
                                                ? <><span className="bc-spinner"/><span>Upload en cours...</span></>
                                                : <><span style={{ fontSize:'1.8rem' }}>{headerType==='audio'?'🎵':headerType==='image'?'🖼️':'📄'}</span><span>Cliquez ou glissez le fichier ici</span></>
                                            }
                                        </div>
                                    ) : (
                                        <div className="bc-file-preview">
                                            {preview.type==='image'    && <img src={preview.url} alt="preview" className="bc-preview-img" />}
                                            {preview.type==='audio'    && <audio controls src={preview.url} className="bc-preview-audio" />}
                                            {preview.type==='document' && <div className="bc-preview-doc"><span>📄</span><a href={preview.url} target="_blank" rel="noreferrer">{preview.name}</a></div>}
                                            <button type="button" className="bc-remove-file" onClick={clearFile}>&#10005; Supprimer</button>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" accept={ACCEPT[headerType]} style={{ display:'none' }} onChange={handleFileChange} />
                                </div>
                            )}

                            {/* ── Langue template ── */}
                            <div className="form-group">
                                <label>Langue du template (code Meta)</label>
                                <select value={form.langueTemplate} onChange={e => setForm(f => ({ ...f, langueTemplate: e.target.value }))}>
                                    <option value="fr">Francais (fr)</option>
                                    <option value="ha">Hausa (ha)</option>
                                    <option value="fr_FR">Francais FR (fr_FR)</option>
                                </select>
                            </div>

                            {/* ── Selecteur de contacts ── */}
                            <div className="form-group">
                                <div className="bc-contacts-header">
                                    <label>
                                        Contacts destinataires
                                        {form.contactIds.length > 0 && (
                                            <span className="bc-contacts-count">{form.contactIds.length} selectionne{form.contactIds.length>1?'s':''}</span>
                                        )}
                                    </label>
                                    <button type="button" className="dt-btn dt-btn-primary bc-contacts-btn"
                                        onClick={openContactPanel}>
                                        {contactPanelOpen ? 'Fermer la liste' : '+ Choisir les contacts'}
                                    </button>
                                </div>

                                {contactPanelOpen && (
                                    <div className="bc-contact-panel">
                                        <div className="bc-contact-search-row">
                                            <input
                                                placeholder="Rechercher par nom ou numero..."
                                                value={contactSearch}
                                                onChange={e => setContactSearch(e.target.value)}
                                                className="bc-contact-search"
                                            />
                                            <button type="button" className="bc-sel-btn" onClick={selectAll}>Tout</button>
                                            <button type="button" className="bc-sel-btn" onClick={deselectAll}>Aucun</button>
                                        </div>

                                        <div className="bc-contact-list">
                                            {loadingContacts ? (
                                                <div className="bc-contact-loading"><span className="bc-spinner"/><span>Chargement...</span></div>
                                            ) : filteredContacts.length === 0 ? (
                                                <div className="bc-contact-empty">Aucun contact trouve.</div>
                                            ) : filteredContacts.map(c => {
                                                const checked = form.contactIds.includes(c._id);
                                                return (
                                                    <label key={c._id} className={`bc-contact-row${checked?' checked':''}`}>
                                                        <input type="checkbox" checked={checked}
                                                            onChange={() => toggleContact(c._id)} />
                                                        <div className="bc-contact-info">
                                                            <span className="bc-contact-name">{c.nom}</span>
                                                            <span className="bc-contact-phone">+{c.whatsappId}</span>
                                                        </div>
                                                        <span className={`bc-contact-lang bc-lang-${c.langue==='fr'?'fr':'ha'}`}>
                                                            {c.langue==='fr'?'FR':'HA'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <div className="bc-contact-footer">
                                            {form.contactIds.length} / {contacts.length} contact{contacts.length!==1?'s':''} selectionne{form.contactIds.length>1?'s':''}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Planification ── */}
                            <div className="form-group">
                                <label>Planifier l'envoi (optionnel)</label>
                                <input type="datetime-local" value={form.dateEnvoi}
                                    onChange={e => setForm(f => ({ ...f, dateEnvoi: e.target.value }))} />
                                <small style={{ color:'#94a3b8', fontSize:'0.78rem' }}>Laissez vide pour envoyer immediatement.</small>
                            </div>

                            <div className="broadcast-warning">
                                &#9888; Cette action enverra un message WhatsApp aux contacts selectionnes.
                                Assurez-vous que le template est approuve par Meta.
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={sending || uploading}>
                                    {sending ? 'Lancement...' : form.dateEnvoi ? 'Planifier' : `Envoyer a ${form.contactIds.length} contact${form.contactIds.length!==1?'s':''}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
