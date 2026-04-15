import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getVaccins, createVaccin, updateVaccin, deleteVaccin, importVaccins } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const VOIES = ['injectable', 'oral', 'intradermique'];
const EMPTY = { code: '', nom: '', maladiesProtegees: '', nbDoses: 1, voieAdministration: 'injectable', actif: true };

export default function Vaccins() {
    const [rows, setRows]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm]         = useState(EMPTY);
    const [formErr, setFormErr]   = useState('');
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState('');

    useEffect(() => { fetch(); }, []);

    async function fetch() {
        setLoading(true);
        try { setRows(await getVaccins()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
    function openCreate() { setForm(EMPTY); setFormErr(''); setModal('create'); }
    function openEdit(v) { setSelected(v); setForm({ code: v.code, nom: v.nom, maladiesProtegees: v.maladiesProtegees || '', nbDoses: v.nbDoses, voieAdministration: v.voieAdministration, actif: v.actif }); setFormErr(''); setModal('edit'); }
    function openDelete(v) { setSelected(v); setFormErr(''); setModal('delete'); }
    function close() { setModal(null); setSelected(null); setFormErr(''); }
    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createVaccin(form);
                setRows(r => [...r, created].sort((a, b) => a.code.localeCompare(b.code)));
                showToast('Vaccin créé.');
            } else {
                const updated = await updateVaccin(selected._id, form);
                setRows(r => r.map(x => x._id === updated._id ? updated : x));
                showToast('Vaccin modifié.');
            }
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteVaccin(selected._id);
            setRows(r => r.filter(x => x._id !== selected._id));
            showToast('Vaccin supprimé.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(filtered.map(v => ({
            code: v.code, nom: v.nom,
            maladiesProtegees: v.maladiesProtegees || '',
            nbDoses: v.nbDoses,
            voieAdministration: v.voieAdministration,
            actif: v.actif ? 'Oui' : 'Non'
        })));
        ws['!cols'] = [10, 28, 36, 8, 16, 8].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Vaccins');
        XLSX.writeFile(wb, `vaccins_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        e.target.value = '';
        try {
            const res = await importVaccins(json);
            showToast(res.message);
            fetch();
        } catch (e) { setError(e.message); }
    }

    const filtered = rows.filter(v =>
        v.code.toLowerCase().includes(search.toLowerCase()) ||
        v.nom.toLowerCase().includes(search.toLowerCase()) ||
        (v.maladiesProtegees ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Vaccins</h1>
            <p className="dash-page-sub">Gestion du référentiel vaccins du PEV Niger.</p>

            {error && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {toast && <div className="dt-toast">{toast}</div>}

            <div className="dt-toolbar">
                <input className="dt-search" placeholder="Rechercher par code, nom ou maladie..." value={search} onChange={e => setSearch(e.target.value)} />
                <button className="dt-btn dt-btn-primary" onClick={openCreate}><i className="bi bi-plus-lg"></i> Ajouter</button>
                <label className="dt-btn dt-btn-import">
                    <i className="bi bi-upload"></i> Importer Excel
                    <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
                </label>
                <button className="dt-btn dt-btn-export" onClick={exportExcel} disabled={filtered.length === 0}>
                    <i className="bi bi-download"></i> Exporter ({filtered.length})
                </button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr><th>Code</th><th>Nom</th><th>Maladies protégées</th><th>Doses</th><th>Voie</th><th>Statut</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="dt-center">Aucun vaccin trouvé.</td></tr>
                        ) : paged.map(v => (
                            <tr key={v._id}>
                                <td><span className="dt-badge dt-badge-code">{v.code}</span></td>
                                <td><strong>{v.nom}</strong></td>
                                <td style={{ fontSize: '0.82rem', color: '#4b5563' }}>{v.maladiesProtegees || <span className="dt-muted">—</span>}</td>
                                <td style={{ textAlign: 'center' }}>{v.nbDoses}</td>
                                <td><span className="dt-badge dt-badge-voie">{v.voieAdministration}</span></td>
                                <td><span className={`dt-badge ${v.actif ? 'dt-badge-actif' : 'dt-badge-inactif'}`}>{v.actif ? 'Actif' : 'Inactif'}</span></td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openEdit(v)}><i className="bi bi-pencil-fill"></i> Modifier</button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => openDelete(v)}><i className="bi bi-trash-fill"></i> Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="dt-footer">
                <span>{filtered.length} vaccin{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Ajouter un vaccin' : 'Modifier le vaccin'}</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-form">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Code vaccin</label>
                                    <input name="code" value={form.code} onChange={handleChange} placeholder="ex: BCG" required style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div className="form-group">
                                    <label>Nombre de doses</label>
                                    <input name="nbDoses" type="number" min="1" value={form.nbDoses} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Nom complet</label>
                                <input name="nom" value={form.nom} onChange={handleChange} placeholder="ex: Vaccin antituberculeux" required />
                            </div>
                            <div className="form-group">
                                <label>Maladies protégées</label>
                                <input name="maladiesProtegees" value={form.maladiesProtegees} onChange={handleChange} placeholder="ex: Tuberculose grave, méningite tuberculeuse" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Voie d'administration</label>
                                    <select name="voieAdministration" value={form.voieAdministration} onChange={handleChange}>
                                        {VOIES.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="form-group form-group-check" style={{ justifyContent: 'flex-end' }}>
                                    <label>
                                        <input type="checkbox" name="actif" checked={form.actif} onChange={handleChange} />
                                        Vaccin actif
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={close}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Enregistrement...' : modal === 'create' ? 'Créer' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modal === 'delete' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Supprimer le vaccin</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <p>Supprimer <strong>{selected?.code} — {selected?.nom}</strong> ? Cette action est irréversible.</p>
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
