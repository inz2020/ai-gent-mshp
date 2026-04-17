import { useEffect, useState } from 'react';
import { getSensibilisations, createSensibilisation, updateSensibilisation, deleteSensibilisation } from '../../api/index.js';
import { useSort } from '../../hooks/useSort.js';
import SortableTh from '../../components/SortableTh.jsx';

const DEFAULT_FORM = { nom: '', dateDebutMobSoc: '', dateFinMobSoc: '' };

function statutCampagne(debut, fin) {
    const now = new Date();
    const d = new Date(debut);
    const f = new Date(fin);
    if (now < d) return { label: 'Planifiée', cls: 'dt-badge-inactif' };
    if (now > f) return { label: 'Terminée',  cls: 'dt-badge-actif' };
    return { label: 'En cours', cls: 'dt-badge-warning' };
}

export default function Sensibilisation() {
    const [items, setItems]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(false);
    const [editing, setEditing]     = useState(null);
    const [form, setForm]           = useState(DEFAULT_FORM);
    const [saving, setSaving]       = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            setItems(await getSensibilisations());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditing(null);
        setForm(DEFAULT_FORM);
        setError('');
        setModal(true);
    }

    function openEdit(item) {
        setEditing(item);
        setForm({
            nom:             item.nom ?? '',
            dateDebutMobSoc: item.dateDebutMobSoc?.slice(0, 10) ?? '',
            dateFinMobSoc:   item.dateFinMobSoc?.slice(0, 10) ?? '',
        });
        setError('');
        setModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editing) {
                const updated = await updateSensibilisation(editing._id, form);
                setItems(a => a.map(x => x._id === updated._id ? updated : x));
                setSuccess('Sensibilisation mise a jour.');
            } else {
                const created = await createSensibilisation(form);
                setItems(a => [created, ...a]);
                setSuccess('Sensibilisation ajoutee.');
            }
            setModal(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        try {
            await deleteSensibilisation(id);
            setItems(a => a.filter(x => x._id !== id));
            setConfirmId(null);
            setSuccess('Sensibilisation supprimee.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message);
        }
    }

    const duree = (debut, fin) => {
        const d = Math.round((new Date(fin) - new Date(debut)) / (1000 * 60 * 60 * 24));
        return d >= 0 ? `${d} jour${d !== 1 ? 's' : ''}` : '—';
    };

    const { sorted, sortKey, sortDir, toggleSort } = useSort(items, 'nom');

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Sensibilisation Communautaire</h1>
            <p className="dash-page-sub">Planification des activites de mobilisation sociale.</p>

            {success && <div className="dt-success">&#10003; {success}</div>}
            {error && !modal && <div className="dt-error">&#9888; {error}</div>}

            <div className="dt-toolbar">
                <button className="dt-btn dt-btn-primary" onClick={openCreate}>+ Nouvelle activite</button>
                <button className="dt-btn" onClick={fetchAll}>&#8635; Actualiser</button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <SortableTh label="Nom de l'activite" field="nom"              sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Statut</th>
                            <SortableTh label="Date debut"        field="dateDebutMobSoc"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Date fin"          field="dateFinMobSoc"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Duree</th>
                            <th>Cree par</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                        ) : sorted.length === 0 ? (
                            <tr><td colSpan="7" className="dt-center">Aucune activite de sensibilisation.</td></tr>
                        ) : sorted.map(item => {
                            const s = statutCampagne(item.dateDebutMobSoc, item.dateFinMobSoc);
                            return (
                                <tr key={item._id}>
                                    <td><strong>{item.nom}</strong></td>
                                    <td><span className={`dt-badge ${s.cls}`}>{s.label}</span></td>
                                    <td style={{ fontSize: '0.82rem' }}>
                                        {new Date(item.dateDebutMobSoc).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td style={{ fontSize: '0.82rem' }}>
                                        {new Date(item.dateFinMobSoc).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280' }}>
                                        {duree(item.dateDebutMobSoc, item.dateFinMobSoc)}
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                                        {item.creePar?.nom ?? <span className="dt-muted">—</span>}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="dt-btn dt-btn-edit" onClick={() => openEdit(item)}>
                                                <i className="bi bi-pencil-fill"></i>
                                            </button>
                                            <button className="dt-btn dt-btn-danger" onClick={() => setConfirmId(item._id)}>
                                                <i className="bi bi-trash-fill"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{items.length} activite{items.length !== 1 ? 's' : ''}</span>
            </div>

            {modal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Modifier l\'activite' : 'Nouvelle activite de sensibilisation'}</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            {error && <div className="modal-error">&#9888; {error}</div>}

                            <div className="form-group">
                                <label>Nom de l'activite <span className="req">*</span></label>
                                <input
                                    placeholder="Ex: Campagne vaccination rougeole Zinder"
                                    value={form.nom}
                                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Date de debut <span className="req">*</span></label>
                                <input
                                    type="date"
                                    value={form.dateDebutMobSoc}
                                    onChange={e => setForm(f => ({ ...f, dateDebutMobSoc: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Date de fin <span className="req">*</span></label>
                                <input
                                    type="date"
                                    value={form.dateFinMobSoc}
                                    min={form.dateDebutMobSoc}
                                    onChange={e => setForm(f => ({ ...f, dateFinMobSoc: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Enregistrement...' : editing ? 'Mettre a jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmId && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h2>Confirmer la suppression</h2>
                            <button className="modal-close" onClick={() => setConfirmId(null)}>&#10005;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Voulez-vous vraiment supprimer cette activite de sensibilisation ?</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmId(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleDelete(confirmId)}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
