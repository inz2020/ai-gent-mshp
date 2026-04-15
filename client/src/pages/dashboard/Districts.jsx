import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getDistricts, createDistrict, updateDistrict, deleteDistrict, importDistricts, getRegions } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const EMPTY = { nom: '', regionId: '' };

export default function Districts() {
    const [rows, setRows]         = useState([]);
    const [regions, setRegions]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm]         = useState(EMPTY);
    const [formErr, setFormErr]   = useState('');
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState('');

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [d, r] = await Promise.all([getDistricts(), getRegions()]);
            setRows(d); setRegions(r);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
    function openCreate() { setForm({ ...EMPTY, regionId: regions[0]?._id || '' });
     setFormErr(''); setModal('create'); }
    function openEdit(r) { setSelected(r); setForm({ nom: r.nom, regionId: r.regionId?._id || '' }); setFormErr(''); setModal('edit'); }
    function openDelete(r) { setSelected(r); setFormErr(''); setModal('delete'); }
    function close() { setModal(null); setSelected(null); setFormErr(''); }
    function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createDistrict(form);
                setRows(r => [...r, created].sort((a, b) => a.nom.localeCompare(b.nom)));
                showToast('District créé.');
            } else {
                const updated = await updateDistrict(selected._id, form);
                setRows(r => r.map(x => x._id === updated._id ? updated : x));
                showToast('District modifié.');
            }
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteDistrict(selected._id);
            setRows(r => r.filter(x => x._id !== selected._id));
            showToast('District supprimé.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({ nom: r.nom, region: r.regionId?.nom ?? '' })));
        ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Districts');
        XLSX.writeFile(wb, `districts_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        e.target.value = '';
        try {
            const res = await importDistricts(json);
            showToast(res.message);
            fetchAll();
        } catch (e) { setError(e.message); }
    }

    const filtered = rows.filter(r =>
        r.nom.toLowerCase().includes(search.toLowerCase()) ||
        (r.regionId?.nom ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Districts</h1>
            <p className="dash-page-sub">Gestion des districts sanitaires.</p>

            {error && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {toast && <div className="dt-toast">{toast}</div>}

            <div className="dt-toolbar">
                <input className="dt-search" placeholder="Rechercher par nom ou région..." value={search} onChange={e => setSearch(e.target.value)} />
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
                        <tr><th>#</th><th>Nom du district</th><th>Région</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="4" className="dt-center">Aucun district trouvé.</td></tr>
                        ) : paged.map((r, i) => (
                            <tr key={r._id}>
                                <td className="dt-muted">{i + 1}</td>
                                <td><strong>{r.nom}</strong></td>
                                <td><span className="dt-badge dt-badge-lang">{r.regionId?.nom ?? '—'}</span></td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openEdit(r)}><i className="bi bi-pencil-fill"></i> Modifier</button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => openDelete(r)}><i className="bi bi-trash-fill"></i> Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="dt-footer">
                <span>{filtered.length} district{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Ajouter un district' : 'Modifier le district'}</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-form">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <div className="form-group">
                                <label>Nom du district</label>
                                <input name="nom" value={form.nom} onChange={handleChange} placeholder="ex: District de Madarounfa" required />
                            </div>
                            <div className="form-group">
                                <label>Région</label>
                                <select name="regionId" value={form.regionId} onChange={handleChange} required>
                                    <option value="">— Sélectionner une région —</option>
                                    {regions.map(r => <option key={r._id} value={r._id}>{r.nom}</option>)}
                                </select>
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
                            <h2>Supprimer le district</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <p>Supprimer <strong>{selected?.nom}</strong> ? Cette action est irréversible.</p>
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
