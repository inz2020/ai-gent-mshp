import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getContacts, getContactConversations } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const LANG_LABEL = { fr: 'Français', ha: 'Hausa', hausa: 'Hausa', unknown: 'Inconnu' };
const VAX_BADGE  = { 'A jour': 'dt-badge-actif', 'En retard': 'dt-badge-danger', 'Inconnu': 'dt-badge-inactif' };

export default function Contacts() {
    const [contacts, setContacts]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [search, setSearch]       = useState('');
    const [selected, setSelected]   = useState(null);
    const [convs, setConvs]         = useState([]);
    const [convLoad, setConvLoad]   = useState(false);

    useEffect(() => { fetchContacts(); }, []);

    async function fetchContacts() {
        setLoading(true);
        try { setContacts(await getContacts()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    async function openDetail(contact) {
        setSelected(contact);
        setConvLoad(true);
        try { setConvs(await getContactConversations(contact._id)); }
        catch { setConvs([]); }
        finally { setConvLoad(false); }
    }

    function closeDetail() { setSelected(null); setConvs([]); }

    const filtered = contacts.filter(c =>
        c.whatsappId.includes(search) ||
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        (c.region?.nom ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    function exportExcel() {
        const rows = filtered.map(c => ({
            'N° WhatsApp':       `+${c.whatsappId}`,
            'Nom':               c.nom,
            'Région':            c.region?.nom ?? '',
            'District':          c.district?.nom ?? '',
            'Langue':            LANG_LABEL[c.langue] ?? c.langue,
            'Statut vaccin':     c.statutVaxEnfants,
            'Dernière position': c.dernierePosition?.latitude != null
                                    ? `${c.dernierePosition.latitude}, ${c.dernierePosition.longitude}`
                                    : '',
            'Date inscription':  new Date(c.dateInscription).toLocaleDateString('fr-FR'),
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [18, 24, 16, 16, 12, 16, 24, 16].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
        XLSX.writeFile(wb, `contacts_esante_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Contacts</h1>
            <p className="dash-page-sub">Liste des numéros ayant contacté le chatbot Hawa.</p>

            {error && <div className="dt-error">⚠️ {error}</div>}

            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher par numéro, nom ou région..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="dt-btn" onClick={fetchContacts}>↻ Actualiser</button>
                <button className="dt-btn dt-btn-export" onClick={exportExcel} disabled={filtered.length === 0}>
                    ⬇ Exporter Excel ({filtered.length})
                </button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>N° WhatsApp</th>
                            <th>Nom</th>
                            <th>Région</th>
                            <th>District</th>
                            <th>Langue</th>
                            <th>Statut vaccin</th>
                            <th>Inscrit le</th>
                            <th>Détail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucun contact trouvé.</td></tr>
                        ) : paged.map(c => (
                            <tr key={c._id}>
                                <td><span className="dt-mono">+{c.whatsappId}</span></td>
                                <td>
                                    <span className="dt-avatar">{c.nom?.[0]?.toUpperCase() ?? '?'}</span>
                                    {c.nom}
                                </td>
                                <td>{c.region?.nom ?? <span className="dt-muted">—</span>}</td>
                                <td>{c.district?.nom ?? <span className="dt-muted">—</span>}</td>
                                <td>
                                    <span className="dt-badge dt-badge-lang">
                                        {LANG_LABEL[c.langue] ?? c.langue}
                                    </span>
                                </td>
                                <td>
                                    <span className={`dt-badge ${VAX_BADGE[c.statutVaxEnfants] ?? 'dt-badge-inactif'}`}>
                                        {c.statutVaxEnfants}
                                    </span>
                                </td>
                                <td>{new Date(c.dateInscription).toLocaleDateString('fr-FR')}</td>
                                <td>
                                    <button className="dt-btn dt-btn-edit" onClick={() => openDetail(c)}>
                                        Voir
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* Panneau détail contact */}
            {selected && (
                <div className="modal-overlay" onClick={closeDetail}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Contact — +{selected.whatsappId}</h2>
                            <button className="modal-close" onClick={closeDetail}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div><strong>Nom</strong><span>{selected.nom}</span></div>
                                <div><strong>Langue</strong><span>{LANG_LABEL[selected.langue] ?? selected.langue}</span></div>
                                <div><strong>Région</strong><span>{selected.region?.nom ?? '—'}</span></div>
                                <div><strong>District</strong><span>{selected.district?.nom ?? '—'}</span></div>
                                <div><strong>Statut vaccin</strong><span>{selected.statutVaxEnfants}</span></div>
                                <div><strong>Inscrit le</strong><span>{new Date(selected.dateInscription).toLocaleDateString('fr-FR')}</span></div>
                                <div>
                                    <strong>Dernière position</strong>
                                    <span>
                                        {selected.dernierePosition?.latitude != null ? (
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${selected.dernierePosition.latitude}&mlon=${selected.dernierePosition.longitude}&zoom=14`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: '#0a7c4e', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                            >
                                                📍 {selected.dernierePosition.latitude.toFixed(4)}, {selected.dernierePosition.longitude.toFixed(4)}
                                                {selected.dernierePosition.updatedAt && (
                                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontFamily: 'inherit' }}>
                                                        ({new Date(selected.dernierePosition.updatedAt).toLocaleDateString('fr-FR')})
                                                    </span>
                                                )}
                                            </a>
                                        ) : <span className="dt-muted">Non partagée</span>}
                                    </span>
                                </div>
                            </div>

                            <h3 style={{ margin: '16px 0 8px', fontSize: 14, color: '#64748b' }}>
                                Conversations ({convLoad ? '…' : convs.length})
                            </h3>
                            {convLoad ? (
                                <p className="dt-center">Chargement...</p>
                            ) : convs.length === 0 ? (
                                <p className="dt-muted">Aucune conversation.</p>
                            ) : (
                                <table className="dt-table">
                                    <thead>
                                        <tr>
                                            <th>Statut</th>
                                            <th>Langue</th>
                                            <th>Messages</th>
                                            <th>Dernière activité</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {convs.map(cv => (
                                            <tr key={cv._id}>
                                                <td><span className={`dt-badge dt-badge-${cv.statut === 'ouvert' ? 'actif' : 'inactif'}`}>{cv.statut}</span></td>
                                                <td>{LANG_LABEL[cv.langue] ?? cv.langue}</td>
                                                <td>{cv.nbMessages}</td>
                                                <td>{new Date(cv.derniereMiseAJour).toLocaleString('fr-FR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={closeDetail}>Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
