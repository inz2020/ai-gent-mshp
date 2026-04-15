import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { getCalendrier, createCalendrier, updateCalendrier, deleteCalendrier, importCalendrier, getVaccins } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const CIBLES = [
    { value: 'nourrisson',      label: 'Nourrisson' },
    { value: 'femme_enceinte',  label: 'Femme enceinte' },
];
const EMPTY = { vaccinId: '', ageLabel: '', ageEnSemaines: '', cible: 'nourrisson', notes: '' };

export default function CalendrierVaccinal() {
    const [rows, setRows]         = useState([]);
    const [vaccins, setVaccins]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm]         = useState(EMPTY);
    const [formErr, setFormErr]   = useState('');
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState('');

    // Combobox vaccin
    const [vaccinSearch, setVaccinSearch] = useState('');
    const [vaccinOpen,   setVaccinOpen]   = useState(false);
    const comboRef = useRef(null);

    useEffect(() => { fetchAll(); }, []);

    // Ferme la liste si clic en dehors
    useEffect(() => {
        function onClickOutside(e) {
            if (comboRef.current && !comboRef.current.contains(e.target)) setVaccinOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [cal, vac] = await Promise.all([getCalendrier(), getVaccins()]);
            setRows(cal); setVaccins(vac.filter(v => v.actif));
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
    function openCreate() {
        setForm(EMPTY);
        setVaccinSearch('');
        setVaccinOpen(false);
        setFormErr('');
        setModal('create');
    }
    function openEdit(r) {
        setSelected(r);
        setForm({ vaccinId: r.vaccinId?._id || '', ageLabel: r.ageLabel, ageEnSemaines: r.ageEnSemaines, cible: r.cible, notes: r.notes || '' });
        setVaccinSearch(r.vaccinId ? `${r.vaccinId.code} — ${r.vaccinId.nom}` : '');
        setVaccinOpen(false);
        setFormErr('');
        setModal('edit');
    }
    function openDelete(r) { setSelected(r); setFormErr(''); setModal('delete'); }
    function close() { setModal(null); setSelected(null); setVaccinSearch(''); setVaccinOpen(false); setFormErr(''); }
    function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createCalendrier({ ...form, ageEnSemaines: Number(form.ageEnSemaines) });
                setRows(r => [...r, created].sort((a, b) => a.ageEnSemaines - b.ageEnSemaines));
                showToast('Entrée créée.');
            } else {
                const updated = await updateCalendrier(selected._id, { ...form, ageEnSemaines: Number(form.ageEnSemaines) });
                setRows(r => r.map(x => x._id === updated._id ? updated : x));
                showToast('Entrée modifiée.');
            }
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteCalendrier(selected._id);
            setRows(r => r.filter(x => x._id !== selected._id));
            showToast('Entrée supprimée.');
            close();
        } catch (e) { setFormErr(e.message); }
        finally { setSaving(false); }
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
            vaccin: r.vaccinId?.code ?? '',
            nomVaccin: r.vaccinId?.nom ?? '',
            ageLabel: r.ageLabel,
            ageEnSemaines: r.ageEnSemaines,
            cible: r.cible,
            notes: r.notes || ''
        })));
        ws['!cols'] = [10, 28, 20, 14, 16, 30].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new(); wb.Props = { CreatedDate: new Date() };
        XLSX.utils.book_append_sheet(wb, ws, 'Calendrier');
        XLSX.writeFile(wb, `calendrier_vaccinal_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        e.target.value = '';
        try {
            const res = await importCalendrier(json);
            showToast(res.message);
            fetchAll();
        } catch (e) { setError(e.message); }
    }

    const filtered = rows.filter(r =>
        (r.vaccinId?.code ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.vaccinId?.nom ?? '').toLowerCase().includes(search.toLowerCase()) ||
        r.ageLabel.toLowerCase().includes(search.toLowerCase()) ||
        r.cible.toLowerCase().includes(search.toLowerCase())
    );
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    const cibleLabel = v => CIBLES.find(c => c.value === v)?.label ?? v;

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Calendrier vaccinal</h1>
            <p className="dash-page-sub">Planification officielle des vaccinations PEV Niger.</p>

            {error && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {toast && <div className="dt-toast">{toast}</div>}

            <div className="dt-toolbar">
                <input className="dt-search" placeholder="Rechercher par vaccin, âge, cible..." value={search} onChange={e => setSearch(e.target.value)} />
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
                        <tr><th>Vaccin</th><th>Âge d'administration</th><th>Semaines</th><th>Cible</th><th>Notes</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="6" className="dt-center">Aucune entrée trouvée.</td></tr>
                        ) : paged.map(r => (
                            <tr key={r._id}>
                                <td>
                                    <span className="dt-badge dt-badge-code">{r.vaccinId?.code}</span>
                                    <span style={{ marginLeft: 6, fontSize: '0.82rem', color: '#4b5563' }}>{r.vaccinId?.nom}</span>
                                </td>
                                <td><strong>{r.ageLabel}</strong></td>
                                <td style={{ textAlign: 'center' }}>{r.ageEnSemaines} sem.</td>
                                <td><span className={`dt-badge ${r.cible === 'nourrisson' ? 'dt-badge-actif' : 'dt-badge-lang'}`}>{cibleLabel(r.cible)}</span></td>
                                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{r.notes || <span className="dt-muted">—</span>}</td>
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
                <span>{filtered.length} entrée{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Ajouter une entrée' : 'Modifier l\'entrée'}</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-form">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <div className="form-group" ref={comboRef} style={{ position: 'relative' }}>
                                <label>Vaccin</label>
                                <input
                                    placeholder="Rechercher un vaccin..."
                                    value={vaccinSearch}
                                    autoComplete="off"
                                    onChange={e => {
                                        setVaccinSearch(e.target.value);
                                        setVaccinOpen(true);
                                        setForm(f => ({ ...f, vaccinId: '' }));
                                    }}
                                    onFocus={() => setVaccinOpen(true)}
                                    required={!form.vaccinId}
                                    style={{ borderColor: form.vaccinId ? undefined : vaccinSearch ? '#f59e0b' : undefined }}
                                />
                                {/* champ caché pour la validation HTML */}
                                <input type="hidden" name="vaccinId" value={form.vaccinId} required />
                                {vaccinOpen && (
                                    <div className="vaccin-combo-list">
                                        {vaccins
                                            .filter(v => {
                                                const q = vaccinSearch.toLowerCase();
                                                return !q || v.code.toLowerCase().includes(q) || v.nom.toLowerCase().includes(q);
                                            })
                                            .map(v => (
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    className={`vaccin-combo-item${form.vaccinId === v._id ? ' selected' : ''}`}
                                                    onMouseDown={e => {
                                                        e.preventDefault();
                                                        setForm(f => ({ ...f, vaccinId: v._id }));
                                                        setVaccinSearch(`${v.code} — ${v.nom}`);
                                                        setVaccinOpen(false);
                                                    }}
                                                >
                                                    <span className="vaccin-combo-code">{v.code}</span>
                                                    <span className="vaccin-combo-nom">{v.nom}</span>
                                                </button>
                                            ))
                                        }
                                        {vaccins.filter(v => {
                                            const q = vaccinSearch.toLowerCase();
                                            return !q || v.code.toLowerCase().includes(q) || v.nom.toLowerCase().includes(q);
                                        }).length === 0 && (
                                            <div className="vaccin-combo-empty">Aucun vaccin trouvé.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Âge (libellé)</label>
                                    <input name="ageLabel" value={form.ageLabel} onChange={handleChange} placeholder="ex: À la naissance" required />
                                </div>
                                <div className="form-group">
                                    <label>Âge en semaines</label>
                                    <input name="ageEnSemaines" type="number" min="0" value={form.ageEnSemaines} onChange={handleChange} placeholder="0" required />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cible</label>
                                    <select name="cible" value={form.cible} onChange={handleChange}>
                                        {CIBLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <input name="notes" value={form.notes} onChange={handleChange} placeholder="ex: Avec fièvre jaune" />
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
                            <h2>Supprimer l'entrée</h2>
                            <button className="modal-close" onClick={close}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body">
                            {formErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formErr}</div>}
                            <p>Supprimer <strong>{selected?.vaccinId?.code} — {selected?.ageLabel}</strong> ?</p>
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
