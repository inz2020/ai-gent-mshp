import { useEffect, useRef, useState } from 'react';
import {
    getConversations,
    getConversationMessages,
    toggleConversationMode,
    sendOperatorMessage,
    toggleContactBlock,
    enregistrerContact,
    deleteConversation,
} from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const LANG_LABEL   = { fr: 'Français', ha: 'Hausa', hausa: 'Hausa', unknown: 'Inconnu' };
const STATUT_COLOR = { ouvert: 'dt-badge-actif', ferme: 'dt-badge-inactif', escalade_humain: 'dt-badge-danger' };
const STATUT_LABEL = { ouvert: 'Ouvert', ferme: 'Fermé', escalade_humain: 'Mode Humain' };

function formatTime(date) {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Groupe les messages par date
function groupByDate(messages) {
    const groups = [];
    let lastDate = null;
    for (const m of messages) {
        const d = new Date(m.dateEnvoi).toDateString();
        if (d !== lastDate) { groups.push({ type: 'date', label: formatDate(m.dateEnvoi), key: d }); lastDate = d; }
        groups.push({ type: 'msg', data: m });
    }
    return groups;
}

export default function Discussions() {
    const [convs, setConvs]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [search, setSearch]       = useState('');
    const [selected, setSelected]   = useState(null);
    const [messages, setMessages]   = useState([]);
    const [msgLoad, setMsgLoad]     = useState(false);
    const [opText, setOpText]       = useState('');
    const [sending, setSending]     = useState(false);
    const [toggling, setToggling]   = useState(false);
    const [blocking, setBlocking]   = useState(false);
    const [lastSync, setLastSync]   = useState(null);
    const [saveModal, setSaveModal] = useState(null);   // { contactId, whatsappId, nom }
    const [saveName, setSaveName]   = useState('');
    const [saving, setSaving]       = useState(false);
    const [savedIds, setSavedIds]   = useState(new Set());
    const [gpsModal, setGpsModal]   = useState(null);   // { nom, whatsappId, dernierePosition }
    const [deleteModal, setDeleteModal] = useState(null); // conversation à supprimer
    const [deleting, setDeleting]       = useState(false);
    const threadEndRef              = useRef(null);
    const textareaRef               = useRef(null);
    const selectedRef               = useRef(null);
    const messagesRef               = useRef([]);

    // Garde les refs à jour pour les intervalles (closures)
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // ── Polling conversations (8s) ──────────────────────────────
    useEffect(() => {
        fetchConvs();
        const id = setInterval(fetchConvsSilent, 8000);
        return () => clearInterval(id);
    }, []);

    // ── Polling messages du fil ouvert (4s) ────────────────────
    useEffect(() => {
        if (!selected) return;
        const id = setInterval(pollMessages, 4000);
        return () => clearInterval(id);
    }, [selected?._id]);

    useEffect(() => {
        if (!msgLoad) {
            setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        }
    }, [messages, msgLoad]);

    async function fetchConvs() {
        setLoading(true);
        try {
            const data = await getConversations();
            setConvs(data);
            setLastSync(new Date());
        }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    async function fetchConvsSilent() {
        try {
            const data = await getConversations();
            setConvs(data);
            setLastSync(new Date());
            // Met à jour la conversation sélectionnée si elle a changé
            const sel = selectedRef.current;
            if (sel) {
                const updated = data.find(c => c._id === sel._id);
                if (updated) setSelected(prev => ({ ...prev, statut: updated.statut, contactId: updated.contactId }));
            }
        } catch { /* silencieux */ }
    }

    async function pollMessages() {
        const sel = selectedRef.current;
        if (!sel) return;
        try {
            const fresh = await getConversationMessages(sel._id);
            const current = messagesRef.current;
            if (fresh.length > current.length) {
                setMessages(fresh);
            }
        } catch { /* silencieux */ }
    }

    async function openThread(conv) {
        setSelected(conv);
        setMessages([]);
        setOpText('');
        setMsgLoad(true);
        try { setMessages(await getConversationMessages(conv._id)); }
        catch { setMessages([]); }
        finally { setMsgLoad(false); }
    }

    function closeThread() { setSelected(null); setMessages([]); setOpText(''); }

    async function handleDeleteConversation() {
        setDeleting(true);
        try {
            await deleteConversation(deleteModal._id);
            setConvs(prev => prev.filter(c => c._id !== deleteModal._id));
            if (selected?._id === deleteModal._id) closeThread();
            setDeleteModal(null);
        } catch (e) {
            setError(e.message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setDeleting(false);
        }
    }

    function openGpsModal(c) {
        setGpsModal({
            nom: c.contactId?.nom ?? 'Inconnu',
            whatsappId: c.contactId?.whatsappId,
            dernierePosition: c.contactId?.dernierePosition ?? null,
        });
    }

    function openSaveModal(c) {
        if (!c.contactId?._id) return;
        setSaveModal({ contactId: c.contactId._id, whatsappId: c.contactId.whatsappId });
        setSaveName(c.contactId.nom && c.contactId.nom !== 'Utilisateur Inconnu' ? c.contactId.nom : '');
    }

    async function handleSaveContact() {
        if (!saveModal || saving) return;
        const nom = saveName.trim();
        if (!nom) return;
        setSaving(true);
        try {
            await enregistrerContact(saveModal.contactId, nom);
            setSavedIds(prev => new Set([...prev, saveModal.contactId]));
            setConvs(prev => prev.map(c =>
                c.contactId?._id === saveModal.contactId
                    ? { ...c, contactId: { ...c.contactId, nom, source: 'dashboard' } }
                    : c
            ));
            setSaveModal(null);
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleBlock(contactId) {
        if (blocking) return;
        setBlocking(true);
        try {
            const res = await toggleContactBlock(contactId);
            // Met à jour bloque dans la liste des conversations
            setConvs(prev => prev.map(c =>
                c.contactId?._id === contactId
                    ? { ...c, contactId: { ...c.contactId, bloque: res.bloque } }
                    : c
            ));
            // Met à jour la conversation sélectionnée si c'est la même
            if (selected?.contactId?._id === contactId) {
                setSelected(s => ({ ...s, contactId: { ...s.contactId, bloque: res.bloque } }));
            }
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setBlocking(false);
        }
    }

    async function handleToggleMode() {
        if (!selected || toggling) return;
        setToggling(true);
        try {
            const updated = await toggleConversationMode(selected._id);
            setSelected(updated);
            setConvs(prev => prev.map(c => c._id === updated._id ? { ...c, statut: updated.statut } : c));
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setToggling(false);
        }
    }

    async function handleSend() {
        if (!opText.trim() || sending) return;
        setSending(true);
        try {
            const msg = await sendOperatorMessage(selected._id, opText.trim());
            setMessages(prev => [...prev, msg]);
            setOpText('');
            setConvs(prev => prev.map(c =>
                c._id === selected._id ? { ...c, nbMessages: (c.nbMessages ?? 0) + 1 } : c
            ));
            if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
        } catch (e) {
            alert('Erreur envoi : ' + e.message);
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleTextareaChange(e) {
        setOpText(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }

    const isHuman = selected?.statut === 'escalade_humain';
    const contactName = selected?.contactId?.nom ?? 'Inconnu';
    const contactPhone = selected?.contactId?.whatsappId ?? '';
    const contactInitial = contactName[0]?.toUpperCase() ?? '?';
    const contactIsUnknown = selected?.contactId?.source === 'webhook';
    const contactIsBlocked = selected?.contactId?.bloque === true;

    const filtered = convs.filter(c => {
        const phone = c.contactId?.whatsappId ?? '';
        const nom   = c.contactId?.nom ?? '';
        const q = search.toLowerCase();
        return phone.includes(q) || nom.toLowerCase().includes(q) || c.statut.includes(q);
    });
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Discussions</h1>
            <p className="dash-page-sub">Historique des conversations WhatsApp avec Hawa.</p>

            {error && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}

            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher par numéro, nom ou statut..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lastSync && (
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse-live 2s infinite' }} />
                            Live · {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                    <button className="dt-btn" onClick={fetchConvs}><i className="bi bi-arrow-clockwise"></i> Actualiser</button>
                </div>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Contact</th>
                            <th>Numéro</th>
                            <th>Statut</th>
                            <th>Langue</th>
                            <th>Messages</th>
                            <th>Dernière activité</th>
                            <th>Créée le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucune discussion trouvée.</td></tr>
                        ) : paged.map(c => {
                            const isUnknown = c.contactId?.source === 'webhook';
                            const isBlocked = c.contactId?.bloque === true;
                            return (
                            <tr key={c._id} style={isBlocked ? { opacity: 0.6 } : undefined}>
                                <td>
                                    <span className="dt-avatar">{(c.contactId?.nom?.[0] ?? '?').toUpperCase()}</span>
                                    {c.contactId?.nom ?? 'Inconnu'}
                                    {isBlocked && <span className="dt-badge dt-badge-danger" style={{ marginLeft: 6, fontSize: '0.7rem' }}>Bloqué</span>}
                                </td>
                                <td><span className="dt-mono">{c.contactId?.whatsappId ? `+${c.contactId.whatsappId}` : '—'}</span></td>
                                <td>
                                    <span className={`dt-badge ${STATUT_COLOR[c.statut] ?? 'dt-badge-inactif'}`}>
                                        {STATUT_LABEL[c.statut] ?? c.statut}
                                    </span>
                                </td>
                                <td>{LANG_LABEL[c.contactId?.langue] ?? c.contactId?.langue ?? '—'}</td>
                                <td style={{ textAlign: 'center' }}>{c.nbMessages}</td>
                                <td>{new Date(c.derniereMiseAJour).toLocaleString('fr-FR')}</td>
                                <td>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openThread(c)}>
                                        Ouvrir
                                    </button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => setDeleteModal(c)} title="Supprimer cette conversation">
                                        <i className="bi bi-trash-fill"></i> Supprimer
                                    </button>
                                    <button
                                        className="dt-btn"
                                        onClick={() => openGpsModal(c)}
                                        title="Voir la dernière position GPS"
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        <i className="bi bi-geo-alt-fill"></i> GPS
                                    </button>
                                    {c.contactId?.source === 'webhook' && !savedIds.has(c.contactId?._id) && (
                                        <button className="dt-btn dt-btn-primary" onClick={() => openSaveModal(c)} title="Enregistrer dans les contacts">
                                            + Contact
                                        </button>
                                    )}
                                    {(c.contactId?.source === 'dashboard' || savedIds.has(c.contactId?._id)) && (
                                        <span className="dt-badge dt-badge-actif" style={{ fontSize: '0.7rem' }}><i className="bi bi-check-lg"></i> Enregistré</span>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* ══════════ MODAL SUPPRESSION CONVERSATION ══════════ */}
            {deleteModal && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer la conversation</h2>
                            <button className="modal-close" onClick={() => setDeleteModal(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            <p>Voulez-vous supprimer la conversation de <strong>+{deleteModal.contactId?.whatsappId}</strong>{deleteModal.contactId?.nom ? ` (${deleteModal.contactId.nom})` : ''} ?</p>
                            <p style={{ color: 'var(--red, #dc2626)', fontSize: '0.88rem', marginTop: 8 }}>
                                Tous les messages seront definitivement supprimés.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setDeleteModal(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={handleDeleteConversation} disabled={deleting}>
                                {deleting ? 'Suppression...' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL GPS ══════════ */}
            {gpsModal && (() => {
                const pos = gpsModal.dernierePosition;
                const hasPos = pos?.latitude != null && pos?.longitude != null;
                const mapsUrl = hasPos
                    ? `https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`
                    : null;
                return (
                    <div className="modal-overlay">
                        <div className="modal modal-sm">
                            <div className="modal-header">
                                <h2>📍 Position GPS</h2>
                                <button className="modal-close" onClick={() => setGpsModal(null)}>✕</button>
                            </div>
                            <div className="modal-form">
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>{gpsModal.nom}</p>
                                <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 12 }}>
                                    {gpsModal.whatsappId ? `+${gpsModal.whatsappId}` : '—'}
                                </p>
                                {hasPos ? (
                                    <>
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534' }}>
                                                <strong>Latitude :</strong> {pos.latitude.toFixed(6)}<br />
                                                <strong>Longitude :</strong> {pos.longitude.toFixed(6)}
                                            </p>
                                            {pos.updatedAt && (
                                                <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                                                    Mise à jour le {new Date(pos.updatedAt).toLocaleString('fr-FR')}
                                                </p>
                                            )}
                                        </div>
                                        <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="dt-btn dt-btn-primary"
                                            style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                                        >
                                            🗺️ Ouvrir dans Google Maps
                                        </a>
                                    </>
                                ) : (
                                    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                                        Aucune position GPS disponible.<br />
                                        <small>Le contact n'a pas encore partagé sa localisation.</small>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="dt-btn" onClick={() => setGpsModal(null)}>Fermer</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ══════════ MODAL SAVE CONTACT ══════════ */}
            {saveModal && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Enregistrer le contact</h2>
                            <button className="modal-close" onClick={() => setSaveModal(null)}>✕</button>
                        </div>
                        <div className="modal-form">
                            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                                +{saveModal.whatsappId}
                            </p>
                            <div className="form-group">
                                <label>Nom du contact</label>
                                <input
                                    value={saveName}
                                    onChange={e => setSaveName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveContact()}
                                    placeholder="Ex : Aminata Diallo"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setSaveModal(null)} disabled={saving}>
                                Annuler
                            </button>
                            <button
                                className="dt-btn dt-btn-primary"
                                onClick={handleSaveContact}
                                disabled={saving || !saveName.trim()}
                            >
                                {saving ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ FENÊTRE WHATSAPP ══════════ */}
            {selected && (
                <div className="modal-overlay">
                    <div className="wa-window">

                        {/* ── Header style WhatsApp ── */}
                        <div className="wa-header">
                            <button className="wa-back" onClick={closeThread} title="Fermer">
                                <i className="bi bi-arrow-left"></i>
                            </button>

                            <div className="wa-header-avatar">{contactInitial}</div>

                            <div className="wa-header-info">
                                <span className="wa-header-name">
                                    {contactName}
                                    {contactIsBlocked && (
                                        <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                                            Bloqué
                                        </span>
                                    )}
                                </span>
                                <span className="wa-header-sub">
                                    {contactPhone ? `+${contactPhone}` : '—'} &nbsp;·&nbsp;
                                    {isHuman ? <><i className="bi bi-person-badge-fill"></i> Mode Humain</> : <><i className="bi bi-robot"></i> Mode IA</>}
                                </span>
                            </div>

                            <div className="wa-header-actions">
                                <button
                                    className={`wa-mode-btn ${isHuman ? 'wa-mode-btn-ai' : 'wa-mode-btn-human'}`}
                                    onClick={handleToggleMode}
                                    disabled={toggling}
                                    title={isHuman ? 'Repasser en mode IA' : 'Prendre la main (Mode Humain)'}
                                >
                                    {toggling ? '…' : isHuman
                                        ? <><RobotIcon /> IA</>
                                        : <><AgentIcon /> Prendre la main</>
                                    }
                                </button>
                            </div>
                        </div>

                        {/* ── Fond chat + bulles ── */}
                        <div className="wa-chat-bg">
                            {msgLoad ? (
                                <div className="wa-loading">
                                    <span className="wa-loading-dot" /><span className="wa-loading-dot" /><span className="wa-loading-dot" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="wa-empty">Aucun message enregistré.</div>
                            ) : (
                                groupByDate(messages).map((item) => {
                                    if (item.type === 'date') {
                                        return (
                                            <div key={item.key} className="wa-date-pill">
                                                {item.label}
                                            </div>
                                        );
                                    }
                                    const m = item.data;
                                    const isRight = m.emetteurType === 'agent_ia' || m.emetteurType === 'operateur_sante';
                                    const isOp    = m.emetteurType === 'operateur_sante';

                                    return (
                                        <div key={m._id} className={`wa-row ${isRight ? 'wa-row-right' : 'wa-row-left'}`}>
                                            <div className={`wa-bubble ${
                                                isRight
                                                    ? isOp ? 'wa-bubble-op' : 'wa-bubble-ai'
                                                    : 'wa-bubble-user'
                                            }`}>
                                                {/* Étiquette expéditeur (uniquement en bulles gauche) */}
                                                {!isRight && (
                                                                    <span className="wa-sender-label">
                                                        <i className="bi bi-person-fill"></i> Contact
                                                        {m.langue === 'unknown' && (
                                                            <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                                                                <i className="bi bi-globe"></i> Langue non détectée
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                {isOp && (
                                                    <span className="wa-sender-label wa-sender-op"><i className="bi bi-person-badge-fill"></i> Vous</span>
                                                )}
                                                {m.emetteurType === 'agent_ia' && (
                                                    <span className="wa-sender-label wa-sender-ai"><i className="bi bi-robot"></i> Hawa</span>
                                                )}

                                                {/* Contenu */}
                                                {m.typeContenu === 'location' && m.coordonnees?.latitude != null ? (
                                                    <a
                                                        href={`https://www.openstreetmap.org/?mlat=${m.coordonnees.latitude}&mlon=${m.coordonnees.longitude}&zoom=14`}
                                                        target="_blank" rel="noreferrer"
                                                        className="wa-location-link"
                                                    >
                                                        <i className="bi bi-geo-alt-fill wa-location-icon"></i>
                                                        <span>
                                                            Position GPS<br />
                                                            <small>{m.coordonnees.latitude.toFixed(4)}, {m.coordonnees.longitude.toFixed(4)}</small>
                                                        </span>
                                                    </a>
                                                ) : m.typeContenu === 'audio' ? (
                                                    <div className="wa-audio-block">
                                                        {m.audioUrl ? (
                                                            <audio controls src={m.audioUrl} className="wa-audio" />
                                                        ) : (
                                                            <em className="wa-text-empty"><i className="bi bi-music-note-beamed"></i> Message audio</em>
                                                        )}
                                                        {m.texteBrut && m.texteBrut !== '[Audio reçu en mode humain]' && (
                                                            <div className="wa-audio-transcript">
                                                                <span className="wa-transcript-label">
                                                                    {m.emetteurType === 'agent_ia' ? <><i className="bi bi-pencil-square"></i> Réponse</> : <><i className="bi bi-mic-fill"></i> Transcription</>}
                                                                </span>
                                                                <em>"{m.texteBrut}"</em>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="wa-text">{m.texteBrut || <em className="wa-text-empty">Message vide</em>}</p>
                                                )}

                                                {/* Heure + coches */}
                                                <div className="wa-meta">
                                                    <span className="wa-time">{formatTime(m.dateEnvoi)}</span>
                                                    {isRight && <i className="bi bi-check-all wa-ticks"></i>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={threadEndRef} />
                        </div>

                        {/* ── Barre de saisie style WhatsApp ── */}
                        {isHuman ? (
                            <div className="wa-input-bar">
                                <button className="wa-input-icon" title="Emoji" tabIndex={-1}>
                                    <i className="bi bi-emoji-smile"></i>
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    className="wa-input-field"
                                    placeholder="Écrire un message..."
                                    value={opText}
                                    onChange={handleTextareaChange}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={sending}
                                    autoFocus
                                />

                                <button
                                    className={`wa-send-btn ${opText.trim() ? 'wa-send-btn-active' : ''}`}
                                    onClick={handleSend}
                                    disabled={sending || !opText.trim()}
                                    title="Envoyer"
                                >
                                    {sending ? (
                                        <i className="bi bi-hourglass-split"></i>
                                    ) : opText.trim() ? (
                                        <i className="bi bi-send-fill"></i>
                                    ) : (
                                        <i className="bi bi-mic-fill"></i>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* Mode IA — barre grisée avec hint */
                            <div className="wa-input-bar wa-input-bar-disabled">
                                <button className="wa-input-icon" disabled>
                                    <i className="bi bi-emoji-smile"></i>
                                </button>
                                <div className="wa-input-field wa-input-ai-hint">
                                    <i className="bi bi-robot"></i> Hawa répond automatiquement — cliquez "Prendre la main" pour écrire
                                </div>
                                <button className="wa-send-btn" disabled>
                                    <i className="bi bi-mic-fill"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Icônes inline ── */
function RobotIcon() {
    return <i className="bi bi-robot" style={{ marginRight: 4 }}></i>;
}
function AgentIcon() {
    return <i className="bi bi-person-badge-fill" style={{ marginRight: 4 }}></i>;
}
