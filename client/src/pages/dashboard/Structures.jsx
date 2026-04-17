import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getStructures, createStructure, updateStructure, deleteStructure, importStructures, getDistricts } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { useSort } from '../../hooks/useSort.js';
import Pagination from '../../components/Pagination.jsx';
import SortableTh from '../../components/SortableTh.jsx';

const TYPES = ['CSI', 'CS', 'Hôpital District', 'CH R'];
const EMPTY = { nom: '', type: 'CSI', districtId: '', coordonnees: { latitude: '', longitude: '' }, contactUrgence: '', statutVaccination: true };

export default function Structures() {
    const [rows, setRows]         = useState([]);
    const [districts, setDistricts] = useState([]);
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
            const [s, d] = await Promise.all([getStructures(), getDistricts()]);
            setRows(s); setDistricts(d);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
    function openCreate() { setForm({ ...EMPTY, districtId: districts[0]?._id || '' }); setFormErr(''); setModal('create'); }
    function openEdit(s) {
        setSelected(s);
        setForm({
            nom: s.nom, type: s.type, districtId: s.districtId?._id || '',
            coordonnees: { latitude: s.coordonnees?.latitude ?? '', longitude: s.coordonnees?.longitude ?? '' },
             statutVaccination: s.statutVaccination
        });
        setFormErr(''); setModal('edit');
    }
    function openDelete(s) { setSelected(s); setFormErr(''); setModal('delete'); }
    function close() { setModal(null); setSelected(null); setFormErr(''); }

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        if (name === 'latitude' || name === 'longitude') {
            setForm(f => ({ ...f, coordonnees: { ...f.coordonnees, [name]: value } }));
        } else {
            setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
        }
    }

    function buildPayload() {
        return {
            ...form,
            coordonnees: {
                latitude: parseFloat(form.coordonnees.latitude),
                longitude: parseFloat(form.coordonnees.longitude)
            }
        };
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createStructure(buildPayload());
                setRows(r => [...r, created].sort((a, b) => a.nom.localeCompare(b.nom)));
                showToast('Structure créée.');
            } else {
                const updated = await updateStructure(selected._id, buildPayload());
                setRows(r => r.map(x => x._id === updated._id ? updated : x));
                showToast('Structure modifiée.');
            }
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteStructure(selected._id);
            setRows(r => r.filter(x => x._id !== selected._id));
            showToast('Structure supprimée.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(filtered.map(s => ({
            nom: s.nom, type: s.type,
            district: s.districtId?.nom ?? '',
            region: s.districtId?.regionId?.nom ?? '',
            latitude: s.coordonnees?.latitude ?? '',
            longitude: s.coordonnees?.longitude ?? '',
/*             contactUrgence: s.contactUrgence ?? '', */
            statutVaccination: s.statutVaccination ? 'Oui' : 'Non'
        })));
        ws['!cols'] = [28, 14, 24, 18, 12, 12, 18, 16].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Structures');
        XLSX.writeFile(wb, `structures_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        e.target.value = '';
        try {
            const res = await importStructures(json);
            showToast(res.message);
            fetchAll();
        } catch (e) { setError(e.message); }
    }

    const filtered = rows.filter(s =>
        s.nom.toLowerCase().includes(search.toLowerCase()) ||
        s.type.toLowerCase().includes(search.toLowerCase()) ||
        (s.districtId?.nom ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.districtId?.regionId?.nom ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'nom');
    const { paged, page, setPage, totalPages } = usePagination(sorted);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Structures sanitaires</h1>
            <p className="dash-page-sub">Gestion des centres de santé et hôpitaux.</p>

            {error && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {toast && <div className="dt-toast">{toast}</div>}

            <div className="dt-toolbar">
                <input className="dt-search" placeholder="Rechercher par nom, type, district..." value={search} onChange={e => setSearch(e.target.value)} />
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
                        <tr>
                            <SortableTh label="Nom"      field="nom"                    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Type"     field="type"                   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="District" field="districtId.nom"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Région"   field="districtId.regionId.nom" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Coords GPS</th>
                            <th>Vaccine</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" className="dt-center">Aucune structure trouvée.</td></tr>
                        ) : paged.map(s => (
                            <tr key={s._id}>
                                <td><strong>{s.nom}</strong></td>
                                <td><span className="dt-badge dt-badge-type">{s.type}</span></td>
                                <td>{s.districtId?.nom ?? '—'}</td>
                                <td>{s.districtId?.regionId?.nom ?? '—'}</td>
                                <td className="dt-mono" style={{ fontSize: '0.78rem' }}>
                                    {s.coordonnees?.latitude != null
                                        ? `${s.coordonnees.latitude.toFixed(3)}, ${s.coordonnees.longitude.toFixed(3)}`
                                        : <span className="dt-muted">—</span>}
                                </td>
{/*                                 <td>{s.contactUrgence || <span className="dt-muted">—</span>}</td>
 */}                                
 <td><span className={`dt-badge ${s.statutVaccination ? 'dt-badge-actif' : 'dt-badge-inactif'}`}>{s.statutVaccination ? 'Oui' : 'Non'}</span></td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openEdit(s)}><i className="bi bi-pencil-fill"></i></button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => openDelete(s)}><i className="bi bi-trash-fill"></i></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="dt-footer">
                <span>{filtered.length} structure{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Ajouter une structure' : 'Modifier la structure'}</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-form">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nom</label>
                                    <input name="nom" value={form.nom} onChange={handleChange} placeholder="ex: CSI Dar Es Salam" required />
                                </div>
                                <div className="form-group">
                                    <label>Type</label>
                                    <select name="type" value={form.type} onChange={handleChange} required>
                                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>District</label>
                                    <select name="districtId" value={form.districtId} onChange={handleChange} required>
                                        <option value="">— Sélectionner —</option>
                                        {districts.map(d => <option key={d._id} value={d._id}>{d.nom} ({d.regionId?.nom})</option>)}
                                    </select>
                                </div>
                              {/*   <div className="form-group">
                                    <label>Contact urgence</label>
                                    <input name="contactUrgence" value={form.contactUrgence} onChange={handleChange} placeholder="+227 XX XX XX XX" />
                                </div> */}
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Latitude</label>
                                    <input name="latitude" type="number" step="any" value={form.coordonnees.latitude} onChange={handleChange} placeholder="13.5137" />
                                </div>
                                <div className="form-group">
                                    <label>Longitude</label>
                                    <input name="longitude" type="number" step="any" value={form.coordonnees.longitude} onChange={handleChange} placeholder="2.1098" />
                                </div>
                            </div>
                            <div className="form-group form-group-check">
                                <label>
                                    <input type="checkbox" name="statutVaccination" checked={form.statutVaccination} onChange={handleChange} />
                                    Centre de vaccination actif
                                </label>
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
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer la structure</h2>
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
