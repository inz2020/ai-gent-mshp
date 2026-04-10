import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { getContacts, createContact, importContacts, getContactConversations, inviterContact, deleteContact } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

// Codes pays — Niger en premier, puis ordre alphabétique
const COUNTRY_CODES = [
    { code: '227', name: 'Niger',                flag: '🇳🇪' },
    { code: '213', name: 'Algerie',              flag: '🇩🇿' },
    { code: '244', name: 'Angola',               flag: '🇦🇴' },
    { code: '229', name: 'Benin',                flag: '🇧🇯' },
    { code: '267', name: 'Botswana',             flag: '🇧🇼' },
    { code: '226', name: 'Burkina Faso',         flag: '🇧🇫' },
    { code: '257', name: 'Burundi',              flag: '🇧🇮' },
    { code: '238', name: 'Cap-Vert',             flag: '🇨🇻' },
    { code: '237', name: 'Cameroun',             flag: '🇨🇲' },
    { code: '236', name: 'Centrafrique',         flag: '🇨🇫' },
    { code: '269', name: 'Comores',              flag: '🇰🇲' },
    { code: '242', name: 'Congo',                flag: '🇨🇬' },
    { code: '243', name: 'Congo (RDC)',          flag: '🇨🇩' },
    { code: '253', name: 'Djibouti',             flag: '🇩🇯' },
    { code: '20',  name: 'Egypte',              flag: '🇪🇬' },
    { code: '240', name: 'Guinee equatoriale',   flag: '🇬🇶' },
    { code: '291', name: 'Erythree',             flag: '🇪🇷' },
    { code: '251', name: 'Ethiopie',             flag: '🇪🇹' },
    { code: '241', name: 'Gabon',                flag: '🇬🇦' },
    { code: '220', name: 'Gambie',               flag: '🇬🇲' },
    { code: '233', name: 'Ghana',                flag: '🇬🇭' },
    { code: '224', name: 'Guinee',               flag: '🇬🇳' },
    { code: '245', name: 'Guinee-Bissau',        flag: '🇬🇼' },
    { code: '225', name: 'Cote d\'Ivoire',       flag: '🇨🇮' },
    { code: '254', name: 'Kenya',                flag: '🇰🇪' },
    { code: '266', name: 'Lesotho',              flag: '🇱🇸' },
    { code: '231', name: 'Liberia',              flag: '🇱🇷' },
    { code: '218', name: 'Libye',                flag: '🇱🇾' },
    { code: '261', name: 'Madagascar',           flag: '🇲🇬' },
    { code: '265', name: 'Malawi',               flag: '🇲🇼' },
    { code: '223', name: 'Mali',                 flag: '🇲🇱' },
    { code: '222', name: 'Mauritanie',           flag: '🇲🇷' },
    { code: '230', name: 'Maurice',              flag: '🇲🇺' },
    { code: '212', name: 'Maroc',               flag: '🇲🇦' },
    { code: '258', name: 'Mozambique',           flag: '🇲🇿' },
    { code: '264', name: 'Namibie',              flag: '🇳🇦' },
    { code: '234', name: 'Nigeria',              flag: '🇳🇬' },
    { code: '250', name: 'Rwanda',               flag: '🇷🇼' },
    { code: '239', name: 'Sao Tome-et-Principe', flag: '🇸🇹' },
    { code: '221', name: 'Senegal',              flag: '🇸🇳' },
    { code: '232', name: 'Sierra Leone',         flag: '🇸🇱' },
    { code: '252', name: 'Somalie',              flag: '🇸🇴' },
    { code: '27',  name: 'Afrique du Sud',       flag: '🇿🇦' },
    { code: '211', name: 'Soudan du Sud',        flag: '🇸🇸' },
    { code: '249', name: 'Soudan',               flag: '🇸🇩' },
    { code: '268', name: 'Eswatini',             flag: '🇸🇿' },
    { code: '255', name: 'Tanzanie',             flag: '🇹🇿' },
    { code: '228', name: 'Togo',                 flag: '🇹🇬' },
    { code: '216', name: 'Tunisie',              flag: '🇹🇳' },
    { code: '256', name: 'Ouganda',              flag: '🇺🇬' },
    { code: '260', name: 'Zambie',               flag: '🇿🇲' },
    { code: '263', name: 'Zimbabwe',             flag: '🇿🇼' },
    // Europe
    { code: '33',  name: 'France',               flag: '🇫🇷' },
    { code: '32',  name: 'Belgique',             flag: '🇧🇪' },
    { code: '41',  name: 'Suisse',               flag: '🇨🇭' },
    { code: '352', name: 'Luxembourg',           flag: '🇱🇺' },
    { code: '1',   name: 'USA / Canada',         flag: '🇺🇸' },
    { code: '44',  name: 'Royaume-Uni',          flag: '🇬🇧' },
    { code: '49',  name: 'Allemagne',            flag: '🇩🇪' },
    { code: '34',  name: 'Espagne',              flag: '🇪🇸' },
    { code: '39',  name: 'Italie',               flag: '🇮🇹' },
    { code: '351', name: 'Portugal',             flag: '🇵🇹' },
    // Moyen-Orient
    { code: '966', name: 'Arabie saoudite',      flag: '🇸🇦' },
    { code: '971', name: 'Emirats arabes unis',  flag: '🇦🇪' },
    { code: '974', name: 'Qatar',                flag: '🇶🇦' },
    // Asie
    { code: '91',  name: 'Inde',                 flag: '🇮🇳' },
    { code: '86',  name: 'Chine',                flag: '🇨🇳' },
];

const LANG_LABEL = { fr: 'Francais', ha: 'Hausa', hausa: 'Hausa', unknown: 'Inconnu' };
const VAX_BADGE  = { 'A jour': 'dt-badge-actif', 'En retard': 'dt-badge-danger', 'Inconnu': 'dt-badge-inactif' };

const DEFAULT_FORM = { countryCode: '227', localNumber: '', nom: '', langue: 'fr' };

export default function Contacts() {
    const [contacts, setContacts]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');
    const [search, setSearch]       = useState('');
    const [selected, setSelected]   = useState(null);
    const [convs, setConvs]         = useState([]);
    const [convLoad, setConvLoad]   = useState(false);
    const [inviting, setInviting]   = useState(null); // id du contact en cours d'envoi
    const [deleting, setDeleting]   = useState(null); // id du contact en cours de suppression
    const [confirmDelete, setConfirmDelete] = useState(null); // contact à confirmer

    // Creation
    const [modal, setModal]         = useState(false);
    const [form, setForm]           = useState(DEFAULT_FORM);
    const [saving, setSaving]       = useState(false);
    const [formError, setFormError] = useState('');
    const [codeSearch, setCodeSearch]   = useState('');
    const [ccOpen, setCcOpen]           = useState(false);
    const ccRef                         = useRef(null);

    // Import Excel
    const importInputRef                = useRef(null);
    const [importing, setImporting]     = useState(false);
    const [importResult, setImportResult] = useState(null); // { crees, ignores, erreurs[] }

    useEffect(() => { fetchContacts(); }, []);

    // Ferme le dropdown code pays si clic en dehors
    useEffect(() => {
        if (!ccOpen) return;
        function handleOutside(e) {
            if (ccRef.current && !ccRef.current.contains(e.target)) {
                setCcOpen(false);
            }
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [ccOpen]);

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

    async function handleCreate(e) {
        e.preventDefault();
        if (!form.localNumber.trim()) { setFormError('Saisissez le numero local.'); return; }
        setSaving(true); setFormError('');
        try {
            const whatsappId = form.countryCode + form.localNumber.replace(/\D/g, '');
            const contact = await createContact({ whatsappId, nom: form.nom, langue: form.langue });
            setContacts(prev => [contact, ...prev]);
            setSuccess(`Contact +${whatsappId} cree avec succes.`);
            setModal(false);
            setForm(DEFAULT_FORM);
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(contact) {
        setDeleting(contact._id);
        try {
            await deleteContact(contact._id);
            setContacts(prev => prev.filter(c => c._id !== contact._id));
            setSuccess(`Contact +${contact.whatsappId} supprimé.`);
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Suppression échouée : ' + err.message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    }

    async function handleInvite(contact) {
        if (inviting) return;
        setInviting(contact._id);
        try {
            await inviterContact(contact._id);
            setSuccess(`Invitation envoyée à +${contact.whatsappId}`);
            // Mettre à jour derniereInvitation localement
            setContacts(prev => prev.map(c =>
                c._id === contact._id ? { ...c, derniereInvitation: new Date().toISOString() } : c
            ));
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Envoi échoué : ' + err.message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setInviting(null);
        }
    }

    function openModal() { setForm(DEFAULT_FORM); setFormError(''); setCodeSearch(''); setCcOpen(false); setModal(true); }

    // ── Télécharger le modèle Excel
    function downloadTemplate() {
        const ws = XLSX.utils.json_to_sheet([
            { 'N° WhatsApp': '22790123456', 'Nom': 'Amina Moussa',  'Langue': 'fr' },
            { 'N° WhatsApp': '22791234567', 'Nom': 'Ibrahim Malam', 'Langue': 'ha' },
        ]);
        ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 10 }];
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
        XLSX.writeFile(wb, 'modele_import_contacts.xlsx');
    }

    // ── Lire et envoyer le fichier Excel
    async function handleImportFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';   // reset input pour re-sélectionner le même fichier
        setImporting(true);
        setImportResult(null);
        setError('');
        try {
            const buffer = await file.arrayBuffer();
            const wb     = XLSX.read(buffer, { type: 'array' });
            const ws     = wb.Sheets[wb.SheetNames[0]];
            const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });

            if (rows.length === 0) {
                setError('Le fichier est vide ou ne contient pas de données.');
                return;
            }

            const result = await importContacts(rows);
            setImportResult(result);
            if (result.crees > 0) {
                await fetchContacts();   // recharge la liste
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    }

    const filtered = contacts.filter(c =>
        (c.whatsappId ?? '').includes(search) ||
        (c.nom ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.region?.nom ?? '').toLowerCase().includes(search.toLowerCase())
    );

    const { paged, page, setPage, totalPages } = usePagination(filtered, 10);

    // Codes pays filtrés par la recherche dans le select
    const filteredCodes = codeSearch
        ? COUNTRY_CODES.filter(c =>
            c.name.toLowerCase().includes(codeSearch.toLowerCase()) ||
            c.code.includes(codeSearch)
          )
        : COUNTRY_CODES;

    function exportExcel() {
        const rows = filtered.map(c => ({
            'N° WhatsApp':      `+${c.whatsappId}`,
            'Nom':              c.nom,
            'Region':           c.region?.nom ?? '',
            'District':         c.district?.nom ?? '',
            'Langue':           LANG_LABEL[c.langue] ?? c.langue,
            'Statut vaccin':    c.statutVaxEnfants,
            'Derniere position':c.dernierePosition?.latitude != null
                                    ? `${c.dernierePosition.latitude}, ${c.dernierePosition.longitude}`
                                    : '',
            'Date inscription': new Date(c.dateInscription).toLocaleDateString('fr-FR'),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [18,24,16,16,12,16,24,16].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
        XLSX.writeFile(wb, `contacts_esante_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    const currentCode = COUNTRY_CODES.find(c => c.code === form.countryCode);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Contacts</h1>
            <p className="dash-page-sub">Liste des numéros ayant contacté le chatbot Hawa.</p>

            {error   && <div className="dt-error">&#9888; {error}</div>}
            {success && <div className="dt-success">&#10003; {success}</div>}

            {/* Input caché pour import */}
            <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleImportFile}
            />

            <div className="dt-toolbar">
                <input className="dt-search"
                    placeholder="Rechercher par numero, nom ou region..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                <button className="dt-btn dt-btn-primary" onClick={openModal}>+ Nouveau contact</button>
                <button
                    className="dt-btn dt-btn-import"
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing}
                    title="Importer des contacts depuis un fichier Excel"
                >
                    {importing ? '⏳ Import...' : '⬆ Importer Excel'}
                </button>
                <button className="dt-btn dt-btn-template" onClick={downloadTemplate} title="Telecharger le modele Excel">
                    ⬇ Modele
                </button>
                <button className="dt-btn" onClick={fetchContacts}>&#8635; Actualiser</button>
                <button className="dt-btn dt-btn-export" onClick={exportExcel} disabled={filtered.length === 0}>
                    &#11015; Exporter ({filtered.length})
                </button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>N° WhatsApp</th>
                            <th>Nom</th>
                            <th>Region</th>
                            <th>District</th>
                            <th>Langue</th>
                            <th>Statut vaccin</th>
                            <th>Inscrit le</th>
                            <th>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucun contact trouve.</td></tr>
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
                                                <td style={{ display: 'flex', gap: 6 }}>
                                    <button className="dt-btn dt-btn-edit" onClick={() => openDetail(c)}>Voir</button>
                                    <button className="dt-btn dt-btn-primary" onClick={openModal}>+ Ajouter</button>
                                    <button
                                        className="dt-btn dt-btn-danger"
                                        onClick={() => setConfirmDelete(c)}
                                        disabled={deleting === c._id}
                                    >
                                        {deleting === c._id ? '…' : 'Supprimer'}
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

            {/* ══ Modal creation contact ══ */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(false)}>
                    <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nouveau contact</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>
                        <form onSubmit={handleCreate} className="modal-form">
                            {formError && <div className="modal-error">&#9888; {formError}</div>}

                            {/* Nom */}
                            <div className="form-group">
                                <label>Nom complet</label>
                                <input placeholder="Ex : Amina Moussa"
                                    value={form.nom}
                                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                    required />
                            </div>

                            {/* Numero WhatsApp avec code pays */}
                            <div className="form-group">
                                <label>Numero WhatsApp</label>
                                <div className="cc-phone-row">
                                    {/* Code pays */}
                                    <div className="cc-wrapper" ref={ccRef}>
                                        <div className="cc-selected" onClick={() => { setCcOpen(o => !o); setCodeSearch(''); }}>
                                            <span>{currentCode?.flag}</span>
                                            <span className="cc-code">+{form.countryCode}</span>
                                            <span className="cc-chevron">{ccOpen ? '▲' : '▼'}</span>
                                        </div>
                                        {ccOpen && (
                                            <div className="cc-dropdown">
                                                <input
                                                    className="cc-search"
                                                    placeholder="Rechercher..."
                                                    value={codeSearch}
                                                    onChange={e => setCodeSearch(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="cc-list">
                                                    {filteredCodes.map(c => (
                                                        <div key={c.code}
                                                            className={`cc-item${c.code === form.countryCode ? ' active' : ''}`}
                                                            onMouseDown={() => {
                                                                setForm(f => ({ ...f, countryCode: c.code }));
                                                                setCodeSearch('');
                                                                setCcOpen(false);
                                                            }}>
                                                            <span>{c.flag}</span>
                                                            <span className="cc-item-name">{c.name}</span>
                                                            <span className="cc-item-code">+{c.code}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Numero local */}
                                    <input className="cc-number"
                                        type="tel"
                                        placeholder="90 12 34 56"
                                        value={form.localNumber}
                                        onChange={e => setForm(f => ({ ...f, localNumber: e.target.value.replace(/\D/g,'') }))}
                                        maxLength={12}
                                        required />
                                </div>
                                {form.localNumber && (
                                    <small style={{ color: 'var(--gray-400)', fontSize: '0.78rem' }}>
                                        Numero complet : +{form.countryCode}{form.localNumber}
                                    </small>
                                )}
                            </div>

                            {/* Langue */}
                            <div className="form-group">
                                <label>Langue</label>
                                <select value={form.langue} onChange={e => setForm(f => ({ ...f, langue: e.target.value }))}>
                                    <option value="fr">Francais</option>
                                    <option value="ha">Hausa</option>
                                </select>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Creation...' : 'Creer le contact'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ Modal résultat import ══ */}
            {importResult && (
                <div className="modal-overlay" onClick={() => setImportResult(null)}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Résultat de l'import</h2>
                            <button className="modal-close" onClick={() => setImportResult(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            <div className="import-stats">
                                <div className="import-stat import-stat-ok">
                                    <span className="import-stat-num">{importResult.crees}</span>
                                    <span className="import-stat-label">Créés</span>
                                </div>
                                <div className="import-stat import-stat-skip">
                                    <span className="import-stat-num">{importResult.ignores}</span>
                                    <span className="import-stat-label">Ignorés</span>
                                </div>
                            </div>

                            {importResult.erreurs?.length > 0 && (
                                <div className="import-errors">
                                    <p className="import-errors-title">⚠ Détails des erreurs :</p>
                                    <ul className="import-errors-list">
                                        {importResult.erreurs.map((e, i) => (
                                            <li key={i}>{e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {importResult.crees === 0 && importResult.erreurs?.length === 0 && (
                                <p className="dt-muted" style={{ textAlign: 'center', marginTop: 8 }}>
                                    Tous les contacts existent déjà.
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn dt-btn-primary" onClick={() => setImportResult(null)}>OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Modal confirmation suppression ══ */}
            {confirmDelete && (
                <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Confirmer la suppression</h2>
                            <button className="modal-close" onClick={() => setConfirmDelete(null)}>&#10005;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            <p>Voulez-vous vraiment supprimer le contact <strong>+{confirmDelete.whatsappId}</strong>{confirmDelete.nom ? ` (${confirmDelete.nom})` : ''} ?</p>
                            <p style={{ color: 'var(--red, #dc2626)', fontSize: '0.88rem', marginTop: 8 }}>Cette action est irreversible.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmDelete(null)}>Annuler</button>
                            <button
                                className="dt-btn dt-btn-danger"
                                disabled={deleting === confirmDelete._id}
                                onClick={() => handleDelete(confirmDelete)}
                            >
                                {deleting === confirmDelete._id ? 'Suppression...' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Panneau detail contact ══ */}
            {selected && (
                <div className="modal-overlay" onClick={() => { setSelected(null); setConvs([]); }}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Contact — +{selected.whatsappId}</h2>
                            <button className="modal-close" onClick={() => { setSelected(null); setConvs([]); }}>&#10005;</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div><strong>Nom</strong><span>{selected.nom}</span></div>
                                <div><strong>Langue</strong><span>{LANG_LABEL[selected.langue] ?? selected.langue}</span></div>
                                <div><strong>Region</strong><span>{selected.region?.nom ?? '—'}</span></div>
                                <div><strong>District</strong><span>{selected.district?.nom ?? '—'}</span></div>
                                <div><strong>Statut vaccin</strong><span>{selected.statutVaxEnfants}</span></div>
                                <div><strong>Inscrit le</strong><span>{new Date(selected.dateInscription).toLocaleDateString('fr-FR')}</span></div>
                                <div>
                                    <strong>Derniere position</strong>
                                    <span>
                                        {selected.dernierePosition?.latitude != null ? (
                                            <a href={`https://www.openstreetmap.org/?mlat=${selected.dernierePosition.latitude}&mlon=${selected.dernierePosition.longitude}&zoom=14`}
                                                target="_blank" rel="noreferrer"
                                                style={{ color:'#0a7c4e', fontFamily:'monospace', fontSize:'0.85rem' }}>
                                                &#128205; {selected.dernierePosition.latitude.toFixed(4)}, {selected.dernierePosition.longitude.toFixed(4)}
                                                {selected.dernierePosition.updatedAt && (
                                                    <span style={{ color:'#94a3b8', marginLeft:6, fontFamily:'inherit' }}>
                                                        ({new Date(selected.dernierePosition.updatedAt).toLocaleDateString('fr-FR')})
                                                    </span>
                                                )}
                                            </a>
                                        ) : <span className="dt-muted">Non partagee</span>}
                                    </span>
                                </div>
                            </div>

                            <h3 style={{ margin:'16px 0 8px', fontSize:14, color:'#64748b' }}>
                                Conversations ({convLoad ? '...' : convs.length})
                            </h3>
                            {convLoad ? (
                                <p className="dt-center">Chargement...</p>
                            ) : convs.length === 0 ? (
                                <p className="dt-muted">Aucune conversation.</p>
                            ) : (
                                <table className="dt-table">
                                    <thead>
                                        <tr><th>Statut</th><th>Messages</th><th>Derniere activite</th></tr>
                                    </thead>
                                    <tbody>
                                        {convs.map(cv => (
                                            <tr key={cv._id}>
                                                <td><span className={`dt-badge dt-badge-${cv.statut==='ouvert'?'actif':'inactif'}`}>{cv.statut}</span></td>
                                                <td>{cv.nbMessages}</td>
                                                <td>{new Date(cv.derniereMiseAJour).toLocaleString('fr-FR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => { setSelected(null); setConvs([]); }}>Fermer</button>
                            <button
                                className="dt-btn dt-btn-primary"
                                onClick={() => handleInvite(selected)}
                                disabled={inviting === selected._id}
                                title="Envoyer un template WhatsApp pour initier la conversation"
                            >
                                {inviting === selected._id ? 'Envoi...' : selected.derniereInvitation
                                    ? `📲 Ré-inviter (dernier : ${new Date(selected.derniereInvitation).toLocaleDateString('fr-FR')})`
                                    : '📲 Envoyer invitation WhatsApp'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
