import { useEffect, useState } from 'react';
import { getAgentComms, createAgentComm, updateAgentComm, deleteAgentComm } from '../../api/index.js';
import { getDistricts } from '../../api/index.js';
import { useSort } from '../../hooks/useSort.js';
import SortableTh from '../../components/SortableTh.jsx';

const STATUTS = ['Responsable', 'Substitut', 'Stagiaire', 'Autre'];

const DEFAULT_FORM = { nom: '', districtId: '', statut: 'Autre', dateService: '' };

export default function AgentComms() {
    const [agents, setAgents]       = useState([]);
    const [districts, setDistricts] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(false);
    const [editing, setEditing]     = useState(null); // agent en cours d'édition
    const [form, setForm]           = useState(DEFAULT_FORM);
    const [saving, setSaving]       = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [a, d] = await Promise.all([getAgentComms(), getDistricts()]);
            setAgents(a);
            setDistricts(d);
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

    function openEdit(agent) {
        setEditing(agent);
        setForm({
            nom:        agent.nom ?? '',
            districtId: agent.district?._id ?? '',
            statut:     agent.statut ?? 'Autre',
            dateService: agent.dateService ? agent.dateService.slice(0, 10) : '',
        });
        setError('');
        setModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                nom:        form.nom.trim(),
                districtId: form.districtId || undefined,
                statut:     form.statut,
                dateService: form.dateService || undefined,
            };
            if (editing) {
                const updated = await updateAgentComm(editing._id, payload);
                setAgents(a => a.map(x => x._id === updated._id ? updated : x));
                setSuccess('Communicateur mis a jour.');
            } else {
                const created = await createAgentComm(payload);
                setAgents(a => [...a, created]);
                setSuccess('Communicateur ajoute.');
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
            await deleteAgentComm(id);
            setAgents(a => a.filter(x => x._id !== id));
            setConfirmId(null);
            setSuccess('Communicateur supprime.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message);
        }
    }

    const STATUT_COLOR = {
        Responsable: 'dt-badge-actif',
        Substitut:   'dt-badge-warning',
        Stagiaire:   'dt-badge-inactif',
        Autre:       'dt-badge-inactif',
    };

    const { sorted, sortKey, sortDir, toggleSort } = useSort(agents, 'nom');

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Agents Communicateurs</h1>
            <p className="dash-page-sub">Gestion des agents de communication terrain.</p>

            {success && <div className="dt-success">&#10003; {success}</div>}
            {error && !modal && <div className="dt-error">&#9888; {error}</div>}

            <div className="dt-toolbar">
                <button className="dt-btn dt-btn-primary" onClick={openCreate}>+ Ajouter un agent</button>
                <button className="dt-btn" onClick={fetchAll}>&#8635; Actualiser</button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <SortableTh label="Nom"             field="nom"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="District"        field="district.nom" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Role"            field="statut"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Date de service" field="dateService"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="dt-center">Chargement...</td></tr>
                        ) : sorted.length === 0 ? (
                            <tr><td colSpan="5" className="dt-center">Aucun agent communicateur.</td></tr>
                        ) : sorted.map(agent => (
                            <tr key={agent._id}>
                                <td><strong>{agent.nom}</strong></td>
                                <td>{agent.district?.nom ?? <span className="dt-muted">—</span>}</td>
                                <td>
                                    <span className={`dt-badge ${STATUT_COLOR[agent.statut] ?? 'dt-badge-inactif'}`}>
                                        {agent.statut}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                                    {agent.dateService
                                        ? new Date(agent.dateService).toLocaleDateString('fr-FR')
                                        : <span className="dt-muted">—</span>
                                    }
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="dt-btn dt-btn-edit" onClick={() => openEdit(agent)}>
                                            <i className="bi bi-pencil-fill"></i>
                                        </button>
                                        <button className="dt-btn dt-btn-danger" onClick={() => setConfirmId(agent._id)}>
                                            <i className="bi bi-trash-fill"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{sorted.length} agent{sorted.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Modal création / édition ── */}
            {modal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Modifier l\'agent' : 'Nouvel agent communicateur'}</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>&#10005;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            {error && <div className="modal-error">&#9888; {error}</div>}

                            <div className="form-group">
                                <label>Nom complet <span className="req">*</span></label>
                                <input
                                    placeholder="Ex: Moussa Ibrahim"
                                    value={form.nom}
                                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>District</label>
                                <select
                                    value={form.districtId}
                                    onChange={e => setForm(f => ({ ...f, districtId: e.target.value }))}
                                >
                                    <option value="">-- Aucun district --</option>
                                    {districts.map(d => (
                                        <option key={d._id} value={d._id}>{d.nom}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={form.statut}
                                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                                >
                                    {STATUTS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Date de prise de service</label>
                                <input
                                    type="date"
                                    value={form.dateService}
                                    onChange={e => setForm(f => ({ ...f, dateService: e.target.value }))}
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

            {/* ── Modal confirmation suppression ── */}
            {confirmId && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h2>Confirmer la suppression</h2>
                            <button className="modal-close" onClick={() => setConfirmId(null)}>&#10005;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Voulez-vous vraiment supprimer cet agent communicateur ?</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmId(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleDelete(confirmId)}>
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
