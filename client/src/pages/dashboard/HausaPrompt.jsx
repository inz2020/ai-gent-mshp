import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    getHausaVocab, createHausaEntry, updateHausaEntry, deleteHausaEntry, importHausaVocab
} from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const CATEGORIES = [
    'vaccination', 'calendrier', 'nourrisson', 'grossesse', 'symptome',
    'medicament', 'structure_sante', 'famille', 'salutation', 'urgence',
    'demande', 'paludisme', 'adverbe', 'interrogatif', 'sante', 'autre'
];

const EMPTY_MOT    = { type: 'mot',    valeur: '', traduction_fr: '', categorie: 'autre' };
const EMPTY_PHRASE = { type: 'phrase', valeur: '', traduction_fr: '', categorie: 'autre' };

export default function HausaPrompt() {
    const [rows, setRows]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [toast, setToast]       = useState('');
    const [tab, setTab]           = useState('mot');
    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm]         = useState(EMPTY_MOT);
    const [formErr, setFormErr]   = useState('');
    const [saving, setSaving]     = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try { setRows(await getHausaVocab()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
    function close()        { setModal(null); setSelected(null); setFormErr(''); }

    function openAdd() {
        setForm(tab === 'mot' ? { ...EMPTY_MOT } : { ...EMPTY_PHRASE });
        setFormErr('');
        setModal('add');
    }

    function openDelete(row) { setSelected(row); setModal('delete'); }

    function openEdit(row) {
        setSelected(row);
        setForm({ type: row.type, valeur: row.valeur, traduction_fr: row.traduction_fr || '', categorie: row.categorie || 'autre' });
        setFormErr('');
        setModal('edit');
    }

    async function handleEdit(e) {
        e.preventDefault();
        if (!form.valeur.trim()) { setFormErr('La valeur Hausa est obligatoire.'); return; }
        setSaving(true);
        try {
            const updated = await updateHausaEntry(selected._id, form);
            setRows(r => r.map(x => x._id === selected._id ? updated : x));
            showToast('Entree modifiee.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!form.valeur.trim()) { setFormErr('La valeur Hausa est obligatoire.'); return; }
        setSaving(true);
        try {
            const created = await createHausaEntry(form);
            setRows(r => [...r, created]);
            showToast('Entree ajoutee.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteHausaEntry(selected._id);
            setRows(r => r.filter(x => x._id !== selected._id));
            showToast('Entree supprimee.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    // ── Import Excel ──────────────────────────────────────────
    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb   = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        e.target.value = '';
        if (json.length === 0) { setError('Fichier vide ou format invalide.'); return; }
        try {
            const res = await importHausaVocab(json);
            showToast(res.message);
            load();
        } catch (e) { setError(e.message); }
    }

    // ── Export Excel ──────────────────────────────────────────
    function exportExcel() {
        const data = filtered.map(r => ({
            type: r.type,
            valeur: r.valeur,
            traduction_fr: r.traduction_fr || '',
            categorie: r.categorie || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 8 }, { wch: 44 }, { wch: 44 }, { wch: 16 }];
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'HausaVocab');
        XLSX.writeFile(wb, `hausa_vocabulaire_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // ── Modele Excel ──────────────────────────────────────────
    function downloadTemplate() {
        const data = [
            { type: 'mot',    valeur: 'yau',              traduction_fr: 'aujourd hui',          categorie: 'adverbe' },
            { type: 'mot',    valeur: 'gobe',             traduction_fr: 'demain',               categorie: 'adverbe' },
            { type: 'phrase', valeur: 'yaya kake',        traduction_fr: 'comment vas-tu',       categorie: 'salutation' },
            { type: 'phrase', valeur: 'ina son taimako',  traduction_fr: 'j ai besoin d aide',   categorie: 'demande' },
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 8 }, { wch: 44 }, { wch: 44 }, { wch: 16 }];
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'HausaVocab');
        XLSX.writeFile(wb, 'modele_hausa_vocabulaire.xlsx');
    }

    const filtered = rows
        .filter(r => r.type === tab)
        .filter(r =>
            r.valeur.toLowerCase().includes(search.toLowerCase()) ||
            (r.traduction_fr || '').toLowerCase().includes(search.toLowerCase())
        );

    const { paged, page, setPage, totalPages } = usePagination(filtered, 20);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Vocabulaire Hausa</h1>
            <p className="dash-page-sub">
                Enrichissez le vocabulaire Hausa de l'IA. Chaque mot ou phrase ajouté améliore
                la détection de la langue et la qualité des réponses. Indiquez la traduction
                française pour faciliter la maintenance.
            </p>

            {error && <div className="dt-error">⚠️ {error}</div>}
            {toast && <div className="dt-toast">{toast}</div>}

            {/* Onglets */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                    className={`dt-btn ${tab === 'mot' ? 'dt-btn-primary' : ''}`}
                    onClick={() => { setTab('mot'); setSearch(''); }}
                >
                    Mots ({rows.filter(r => r.type === 'mot').length})
                </button>
                <button
                    className={`dt-btn ${tab === 'phrase' ? 'dt-btn-primary' : ''}`}
                    onClick={() => { setTab('phrase'); setSearch(''); }}
                >
                    Phrases ({rows.filter(r => r.type === 'phrase').length})
                </button>
            </div>

            {/* Barre d outils */}
            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher en Hausa ou en francais..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="dt-btn dt-btn-primary" onClick={openAdd}>
                    + Ajouter
                </button>
                <label className="dt-btn dt-btn-import">
                    Import Excel
                    <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
                </label>
                <button className="dt-btn dt-btn-export" onClick={exportExcel} disabled={filtered.length === 0}>
                    Export ({filtered.length})
                </button>
                <button className="dt-btn" onClick={downloadTemplate}>
                    Modele Excel
                </button>
            </div>

            {/* Format */}
            <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px',
                padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#0369a1'
            }}>
                <strong>Format Excel :</strong> colonnes <code>type</code> (mot/phrase) · <code>valeur</code> (Hausa) · <code>traduction_fr</code> (optionnel) · <code>categorie</code> (optionnel)
            </div>

            {/* Tableau */}
            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Valeur Hausa</th>
                            <th>Traduction francaise</th>
                            <th>Categorie</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="dt-center">Chargement...</td></tr>
                        ) : paged.length === 0 ? (
                            <tr><td colSpan="5" className="dt-center">
                                Aucun {tab} trouve. Importez un fichier Excel ou ajoutez manuellement.
                            </td></tr>
                        ) : paged.map(row => (
                            <tr key={row._id}>
                                <td><strong>{row.valeur}</strong></td>
                                <td style={{ color: '#6b7280', fontStyle: row.traduction_fr ? 'normal' : 'italic' }}>
                                    {row.traduction_fr || '—'}
                                </td>
                                <td>
                                    {row.categorie
                                        ? <span className="dt-badge dt-badge-code">{row.categorie}</span>
                                        : <span className="dt-muted">—</span>}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                    {new Date(row.createdAt).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="dt-actions">
                                    <button className="dt-btn" onClick={() => openEdit(row)}>
                                        Modifier
                                    </button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => openDelete(row)}>
                                        Supprimer
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} {tab}{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* Modal Ajout */}
            {modal === 'add' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Ajouter un {tab} Hausa</h2>
                            <button className="modal-close" onClick={close}>X</button>
                        </div>
                        <form onSubmit={handleSave} className="modal-form">
                            {formErr && <div className="modal-error">⚠️ {formErr}</div>}
                            <div className="form-group">
                                <label>Valeur Hausa</label>
                                <input
                                    value={form.valeur}
                                    onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))}
                                    placeholder={tab === 'mot' ? 'ex: rigakafi' : 'ex: ina son yi wa yaro allurar'}
                                    required autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Traduction francaise (optionnel)</label>
                                <input
                                    value={form.traduction_fr}
                                    onChange={e => setForm(f => ({ ...f, traduction_fr: e.target.value }))}
                                    placeholder={tab === 'mot' ? 'ex: vaccin' : 'ex: je veux vacciner mon enfant'}
                                />
                            </div>
                            <div className="form-group">
                                <label>Categorie</label>
                                <select
                                    value={form.categorie}
                                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={close}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Ajout...' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Modification */}
            {modal === 'edit' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Modifier le {selected?.type} Hausa</h2>
                            <button className="modal-close" onClick={close}>X</button>
                        </div>
                        <form onSubmit={handleEdit} className="modal-form">
                            {formErr && <div className="modal-error">⚠️ {formErr}</div>}
                            <div className="form-group">
                                <label>Valeur Hausa</label>
                                <input
                                    value={form.valeur}
                                    onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))}
                                    placeholder={selected?.type === 'mot' ? 'ex: rigakafi' : 'ex: ina son yi wa yaro allurar'}
                                    required autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Traduction francaise (optionnel)</label>
                                <input
                                    value={form.traduction_fr}
                                    onChange={e => setForm(f => ({ ...f, traduction_fr: e.target.value }))}
                                    placeholder={selected?.type === 'mot' ? 'ex: vaccin' : 'ex: je veux vacciner mon enfant'}
                                />
                            </div>
                            <div className="form-group">
                                <label>Categorie</label>
                                <select
                                    value={form.categorie}
                                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={close}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Suppression */}
            {modal === 'delete' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Supprimer</h2>
                            <button className="modal-close" onClick={close}>X</button>
                        </div>
                        <div className="modal-body">
                            {formErr && <div className="modal-error">⚠️ {formErr}</div>}
                            <p>
                                Supprimer le {tab} <strong>"{selected?.valeur}"</strong>
                                {selected?.traduction_fr ? ` (${selected.traduction_fr})` : ''} ?
                                Cette action est irreversible.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={close}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={handleDelete} disabled={saving}>
                                {saving ? 'Suppression...' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
