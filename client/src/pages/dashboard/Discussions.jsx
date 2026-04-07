import { useEffect, useRef, useState } from 'react';
import {
    getConversations,
    getConversationMessages,
    toggleConversationMode,
    sendOperatorMessage,
    toggleContactBlock,
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
    const threadEndRef              = useRef(null);
    const textareaRef               = useRef(null);

    useEffect(() => { fetchConvs(); }, []);

    useEffect(() => {
        if (!msgLoad) {
            setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        }
    }, [messages, msgLoad]);

    async function fetchConvs() {
        setLoading(true);
        try { setConvs(await getConversations()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
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

            {error && <div className="dt-error">⚠️ {error}</div>}

            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher par numéro, nom ou statut..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="dt-btn" onClick={fetchConvs}>↻ Actualiser</button>
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
                                    {isUnknown && (
                                        <button
                                            className={`dt-btn ${isBlocked ? 'dt-btn-import' : 'dt-btn-danger'}`}
                                            onClick={() => handleToggleBlock(c.contactId._id)}
                                            disabled={blocking}
                                            title={isBlocked ? 'Débloquer ce contact' : 'Bloquer ce contact — il ne pourra plus envoyer de messages'}
                                        >
                                            {isBlocked ? 'Débloquer' : 'Bloquer'}
                                        </button>
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

            {/* ══════════ FENÊTRE WHATSAPP ══════════ */}
            {selected && (
                <div className="modal-overlay" onClick={closeThread}>
                    <div className="wa-window" onClick={e => e.stopPropagation()}>

                        {/* ── Header style WhatsApp ── */}
                        <div className="wa-header">
                            <button className="wa-back" onClick={closeThread} title="Fermer">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                                </svg>
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
                                    {isHuman ? '👨‍⚕️ Mode Humain' : '🤖 Mode IA'}
                                </span>
                            </div>

                            <div className="wa-header-actions">
                                {contactIsUnknown && (
                                    <button
                                        className={`wa-mode-btn ${contactIsBlocked ? 'wa-mode-btn-ai' : 'wa-mode-btn-human'}`}
                                        style={contactIsBlocked ? { background: '#16a34a' } : { background: '#dc2626' }}
                                        onClick={() => handleToggleBlock(selected.contactId._id)}
                                        disabled={blocking}
                                        title={contactIsBlocked ? 'Débloquer ce contact' : 'Bloquer — stoppe toute réponse IA à ce numéro'}
                                    >
                                        {blocking ? '…' : contactIsBlocked ? '✓ Débloquer' : '⛔ Bloquer'}
                                    </button>
                                )}
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
                                                    <span className="wa-sender-label">👤 Contact</span>
                                                )}
                                                {isOp && (
                                                    <span className="wa-sender-label wa-sender-op">👨‍⚕️ Vous</span>
                                                )}
                                                {m.emetteurType === 'agent_ia' && (
                                                    <span className="wa-sender-label wa-sender-ai">🤖 Hawa</span>
                                                )}

                                                {/* Contenu */}
                                                {m.typeContenu === 'location' && m.coordonnees?.latitude != null ? (
                                                    <a
                                                        href={`https://www.openstreetmap.org/?mlat=${m.coordonnees.latitude}&mlon=${m.coordonnees.longitude}&zoom=14`}
                                                        target="_blank" rel="noreferrer"
                                                        className="wa-location-link"
                                                    >
                                                        <span className="wa-location-icon">📍</span>
                                                        <span>
                                                            Position GPS<br />
                                                            <small>{m.coordonnees.latitude.toFixed(4)}, {m.coordonnees.longitude.toFixed(4)}</small>
                                                        </span>
                                                    </a>
                                                ) : m.typeContenu === 'audio' ? (
                                                    <div className="wa-audio-block">
                                                        {m.audioUrl && (
                                                            <audio controls src={m.audioUrl} className="wa-audio" />
                                                        )}
                                                        {m.texteBrut && m.texteBrut !== '[Audio reçu en mode humain]' ? (
                                                            <div className="wa-audio-transcript">
                                                                <span className="wa-transcript-label">🎙️ Transcription</span>
                                                                <em>"{m.texteBrut}"</em>
                                                            </div>
                                                        ) : !m.audioUrl && (
                                                            <em className="wa-text-empty">🎵 Message audio</em>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="wa-text">{m.texteBrut || <em className="wa-text-empty">Message vide</em>}</p>
                                                )}

                                                {/* Heure + coches */}
                                                <div className="wa-meta">
                                                    <span className="wa-time">{formatTime(m.dateEnvoi)}</span>
                                                    {isRight && (
                                                        <svg className="wa-ticks" viewBox="0 0 16 11" width="14" height="10">
                                                            <path d="M11.071.653a.75.75 0 0 1 .206 1.04l-5.5 8a.75.75 0 0 1-1.197.077l-3-3.5a.75.75 0 0 1 1.14-.977l2.418 2.82 4.893-7.254a.75.75 0 0 1 1.04-.206z" fill="currentColor"/>
                                                            <path d="M14.571.653a.75.75 0 0 1 .206 1.04l-5.5 8a.75.75 0 0 1-1.04.206.75.75 0 0 1-.206-1.04l5.5-8a.75.75 0 0 1 1.04-.206z" fill="currentColor" opacity=".5"/>
                                                        </svg>
                                                    )}
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
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                                    </svg>
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
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                                            <circle cx="12" cy="12" r="3" opacity="0.4"/>
                                        </svg>
                                    ) : opText.trim() ? (
                                        /* Icône envoi */
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                        </svg>
                                    ) : (
                                        /* Icône micro */
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* Mode IA — barre grisée avec hint */
                            <div className="wa-input-bar wa-input-bar-disabled">
                                <button className="wa-input-icon" disabled>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                                    </svg>
                                </button>
                                <div className="wa-input-field wa-input-ai-hint">
                                    🤖 Hawa répond automatiquement — cliquez "Prendre la main" pour écrire
                                </div>
                                <button className="wa-send-btn" disabled>
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                    </svg>
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
    return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: 4 }}>
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2H3z"/>
        </svg>
    );
}
function AgentIcon() {
    return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: 4 }}>
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
    );
}
