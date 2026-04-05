import { useEffect, useRef, useState } from 'react';
import {
    getConversations,
    getConversationMessages,
    toggleConversationMode,
    sendOperatorMessage,
} from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const LANG_LABEL   = { fr: 'Français', ha: 'Hausa', unknown: 'Inconnu' };
const STATUT_COLOR = { ouvert: 'dt-badge-actif', ferme: 'dt-badge-inactif', escalade_humain: 'dt-badge-danger' };
const STATUT_LABEL = { ouvert: 'Ouvert', ferme: 'Fermé', escalade_humain: 'Mode Humain' };

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
    const threadEndRef              = useRef(null);

    useEffect(() => { fetchConvs(); }, []);

    useEffect(() => {
        if (!msgLoad && messages.length > 0) {
            threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    async function handleToggleMode() {
        if (!selected || toggling) return;
        setToggling(true);
        try {
            const updated = await toggleConversationMode(selected._id);
            setSelected(updated);
            // Mettre à jour la liste
            setConvs(prev => prev.map(c => c._id === updated._id ? { ...c, statut: updated.statut } : c));
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setToggling(false);
        }
    }

    async function handleSend(e) {
        e.preventDefault();
        if (!opText.trim() || sending) return;
        setSending(true);
        try {
            const msg = await sendOperatorMessage(selected._id, opText.trim());
            setMessages(prev => [...prev, msg]);
            setOpText('');
            // Met à jour nbMessages dans la liste
            setConvs(prev => prev.map(c =>
                c._id === selected._id ? { ...c, nbMessages: (c.nbMessages ?? 0) + 1 } : c
            ));
            setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (e) {
            alert('Erreur envoi : ' + e.message);
        } finally {
            setSending(false);
        }
    }

    const isHuman = selected?.statut === 'escalade_humain';

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
                            <th>Fil</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucune discussion trouvée.</td></tr>
                        ) : paged.map(c => (
                            <tr key={c._id}>
                                <td>
                                    <span className="dt-avatar">
                                        {(c.contactId?.nom?.[0] ?? '?').toUpperCase()}
                                    </span>
                                    {c.contactId?.nom ?? 'Inconnu'}
                                </td>
                                <td><span className="dt-mono">+{c.contactId?.whatsappId ?? '—'}</span></td>
                                <td>
                                    <span className={`dt-badge ${STATUT_COLOR[c.statut] ?? 'dt-badge-inactif'}`}>
                                        {STATUT_LABEL[c.statut] ?? c.statut}
                                    </span>
                                </td>
                                <td>{LANG_LABEL[c.langue] ?? c.langue}</td>
                                <td style={{ textAlign: 'center' }}>{c.nbMessages}</td>
                                <td>{new Date(c.derniereMiseAJour).toLocaleString('fr-FR')}</td>
                                <td>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                                <td>
                                    <button className="dt-btn dt-btn-edit" onClick={() => openThread(c)}>
                                        Ouvrir
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* Panneau fil de messages */}
            {selected && (
                <div className="modal-overlay" onClick={closeThread}>
                    <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="modal-header">
                            <div>
                                <h2>Conversation — +{selected.contactId?.whatsappId}</h2>
                                <small style={{ color: '#94a3b8' }}>
                                    {selected.contactId?.nom} &nbsp;·&nbsp;
                                    <span className={`dt-badge ${STATUT_COLOR[selected.statut]}`}>
                                        {STATUT_LABEL[selected.statut]}
                                    </span>
                                </small>
                            </div>

                            {/* Toggle Mode */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    className={`conv-mode-btn ${isHuman ? 'conv-mode-human' : 'conv-mode-ai'}`}
                                    onClick={handleToggleMode}
                                    disabled={toggling}
                                    title={isHuman ? 'Passer en mode IA' : 'Passer en mode Humain'}
                                >
                                    {toggling ? '…' : isHuman ? '🤖 Activer IA' : '👨‍⚕️ Mode Humain'}
                                </button>
                                <button className="modal-close" onClick={closeThread}>✕</button>
                            </div>
                        </div>

                        {/* Bannière mode humain */}
                        {isHuman && (
                            <div className="conv-human-banner">
                                👨‍⚕️ Mode humain activé — l'IA ne répond plus. Vous pouvez écrire directement au contact.
                            </div>
                        )}

                        {/* Fil de messages */}
                        <div className="modal-body thread-body">
                            {msgLoad ? (
                                <p className="dt-center">Chargement des messages...</p>
                            ) : messages.length === 0 ? (
                                <p className="dt-muted">Aucun message enregistré.</p>
                            ) : (
                                <>
                                    {messages.map(m => (
                                        <div
                                            key={m._id}
                                            className={`thread-msg ${
                                                m.emetteurType === 'humain'
                                                    ? 'thread-msg-user'
                                                    : m.emetteurType === 'operateur_sante'
                                                    ? 'thread-msg-op'
                                                    : 'thread-msg-bot'
                                            }`}
                                        >
                                            <div className="thread-msg-header">
                                                <span className="thread-sender">
                                                    {m.emetteurType === 'humain'    ? '👤 Utilisateur'
                                                    : m.emetteurType === 'agent_ia' ? '🤖 Hawa'
                                                    : '👨‍⚕️ Opérateur'}
                                                </span>
                                                <span className="thread-time">
                                                    {new Date(m.dateEnvoi).toLocaleString('fr-FR')}
                                                </span>
                                            </div>
                                            <div className="thread-msg-body">
                                                {m.typeContenu === 'location' && m.coordonnees?.latitude != null ? (
                                                    <a
                                                        href={`https://www.openstreetmap.org/?mlat=${m.coordonnees.latitude}&mlon=${m.coordonnees.longitude}&zoom=14`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: '#0a7c4e', fontSize: '0.88rem' }}
                                                    >
                                                        📍 Position GPS — {m.coordonnees.latitude.toFixed(5)}, {m.coordonnees.longitude.toFixed(5)}
                                                    </a>
                                                ) : m.typeContenu === 'audio' && m.audioUrl ? (
                                                    <>
                                                        {m.texteBrut && <p style={{ marginBottom: 6, fontStyle: 'italic', color: '#64748b' }}>"{m.texteBrut}"</p>}
                                                        <audio controls src={m.audioUrl} style={{ width: '100%' }} />
                                                    </>
                                                ) : (
                                                    <p style={{ whiteSpace: 'pre-wrap' }}>{m.texteBrut || <em className="dt-muted">Message vide</em>}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={threadEndRef} />
                                </>
                            )}
                        </div>

                        {/* Zone de saisie opérateur — visible seulement en mode humain */}
                        {isHuman && (
                            <form className="conv-send-row" onSubmit={handleSend}>
                                <input
                                    className="conv-send-input"
                                    placeholder="Écrire un message WhatsApp..."
                                    value={opText}
                                    onChange={e => setOpText(e.target.value)}
                                    disabled={sending}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className="conv-send-btn"
                                    disabled={sending || !opText.trim()}
                                >
                                    {sending ? '…' : '➤ Envoyer'}
                                </button>
                            </form>
                        )}

                        <div className="modal-footer">
                            <span className="dt-muted" style={{ fontSize: 12 }}>
                                {messages.length} message{messages.length !== 1 ? 's' : ''}
                            </span>
                            <button className="dt-btn" onClick={closeThread}>Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
