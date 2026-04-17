import { useEffect, useRef, useState } from 'react';
import { getRelais, createRelais, updateRelais, deleteRelais } from '../../api/index.js';
import { getDistricts, getStructures } from '../../api/index.js';
import { useSort } from '../../hooks/useSort.js';
import SortableTh from '../../components/SortableTh.jsx';

const TYPES_RELAIS = ['RCom', 'ICCM'];

const DEFAULT_FORM = {
    nom: '', telephone: '', districtId: '', structureSanitaireId: '', nbreAnneesExperience: 0, typeRelais: 'RCom',
};

const TYPE_COLOR = { RCom: 'dt-badge-actif', ICCM: 'dt-badge-warning' };

// ── Export CSV ──────────────────────────────────────────────────────────────
function exportCSV(rows) {
    const headers = ['Nom', 'Telephone', 'Type', 'District', 'Structure', 'Exp.(ans)'];
    const lines = rows.map(r => [
        r.nom ?? '',
        r.telephone ?? '',
        r.typeRelais ?? '',
        r.district?.nom ?? '',
        r.structureSanitaire?.nom ?? '',
        r.nbreAnneesExperience ?? 0,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const csv = [headers.join(';'), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'relais.csv'; a.click();
    URL.revokeObjectURL(url);
}

// ── Parse CSV ───────────────────────────────────────────────────────────────
function parseCSV(text) {
    const [headerLine, ...lines] = text.trim().split(/\r?\n/);
    const headers = headerLine.split(';').map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
    return lines
        .filter(l => l.trim())
        .map(line => {
            const cols = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
            const row = {};
            headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
            return row;
        });
}

export default function Relais() {
    const [relais, setRelais]             = useState([]);
    const [districts, setDistricts]       = useState([]);
    const [structures, setStructures]     = useState([]);
    const [filteredStructures, setFilteredStructures] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [modal, setModal]               = useState(false);
    const [editing, setEditing]           = useState(null);
    const [form, setForm]                 = useState(DEFAULT_FORM);
    const [saving, setSaving]             = useState(false);
    const [confirmId, setConfirmId]       = useState(null);
    const [error, setError]               = useState('');
    const [success, setSuccess]           = useState('');
    const [search, setSearch]             = useState('');
    const [importing, setImporting]       = useState(false);
    const [importResults, setImportResults] = useState(null);
    const importRef = useRef(null);

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [r, d, s] = await Promise.all([getRelais(), getDistricts(), getStructures()]);
            setRelais(r); setDistricts(d); setStructures(s);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function onChangeDistricts(e) {
        const filtered = structures.filter(s => s.districtId._id === e.target.value);
        setFilteredStructures(filtered);
        setForm(f => ({ ...f, districtId: e.target.value }));
    }
    function onChangeStructures(e) {
        setForm(f => ({ ...f, structureSanitaireId: e.target.value }));
    }

    function openCreate() {
        setEditing(null); setForm(DEFAULT_FORM); setError(''); setModal(true);
    }

    function openEdit(r) {
        setEditing(r);
        const distFiltered = structures.filter(s => s.districtId._id === (r.district?._id ?? ''));
        setFilteredStructures(distFiltered);
        setForm({
            nom:                  r.nom ?? '',
            telephone:            r.telephone ?? '',
            districtId:           r.district?._id ?? '',
            structureSanitaireId: r.structureSanitaire?._id ?? '',
            nbreAnneesExperience: r.nbreAnneesExperience ?? 0,
            typeRelais:           r.typeRelais ?? 'RCom',
        });
        setError(''); setModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            const payload = {
                nom:                  form.nom.trim(),
                telephone:            form.telephone.trim(),
                districtId:           form.districtId || undefined,
                structureSanitaireId: form.structureSanitaireId || undefined,
                nbreAnneesExperience: Number(form.nbreAnneesExperience),
                typeRelais:           form.typeRelais,
            };
            if (editing) {
                const updated = await updateRelais(editing._id, payload);
                setRelais(a => a.map(x => x._id === updated._id ? updated : x));
                setSuccess('Relais mis à jour.');
            } else {
                const created = await createRelais(payload);
                setRelais(a => [...a, created]);
                setSuccess('Relais ajouté.');
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
            await deleteRelais(id);
            setRelais(a => a.filter(x => x._id !== id));
            setConfirmId(null);
            setSuccess('Relais supprimé.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) { setError(e.message); }
    }

    // ── Import CSV ────────────────────────────────────────────────────────────
    async function handleImport(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImporting(true);
        const text = await file.text();
        const rows = parseCSV(text);

        let ok = 0, errors = [];
        for (const row of rows) {
            try {
                const districtMatch = districts.find(d =>
                    d.nom.toLowerCase() === (row['district'] ?? '').toLowerCase()
                );
                const structureMatch = structures.find(s =>
                    s.nom.toLowerCase() === (row['structure'] ?? '').toLowerCase()
                );
                const payload = {
                    nom:                  row['nom'] || row['Nom'] || '',
                    telephone:            row['telephone'] || row['Telephone'] || '',
                    typeRelais:           row['type'] || row['Type'] || 'RCom',
                    districtId:           districtMatch?._id,
                    structureSanitaireId: structureMatch?._id,
                    nbreAnneesExperience: Number(row['exp.(ans)'] ?? row['exp'] ?? 0),
                };
                if (!payload.nom) { errors.push(`Ligne ignorée : nom vide`); continue; }
                const created = await createRelais(payload);
                setRelais(a => [...a, created]);
                ok++;
            } catch (err) {
                errors.push(`"${row['nom'] ?? '?'}" : ${err.message}`);
            }
        }
        setImportResults({ ok, errors });
        setImporting(false);
    }

    // ── Filtrage ──────────────────────────────────────────────────────────────
    const { sorted, sortKey, sortDir, toggleSort } = useSort(relais, 'nom');

    const q = search.toLowerCase();
    const filtered = sorted.filter(r =>
        !q ||
        r.nom.toLowerCase().includes(q) ||
        (r.telephone ?? '').includes(q) ||
        (r.typeRelais ?? '').toLowerCase().includes(q) ||
        (r.district?.nom ?? '').toLowerCase().includes(q) ||
        (r.structureSanitaire?.nom ?? '').toLowerCase().includes(q)
    );

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Relais Communautaires</h1>
            <p className="dash-page-sub">Gestion des agents relais (RCom et ICCM).</p>

            {success && <div className="dt-success"><i className="bi bi-check-lg"></i> {success}</div>}
            {error && !modal && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}

            {importResults && (
                <div className={importResults.errors.length ? 'dt-error' : 'dt-success'} style={{ marginBottom: 8 }}>
                    <strong>{importResults.ok} importé{importResults.ok !== 1 ? 's' : ''}</strong>
                    {importResults.errors.length > 0 && (
                        <ul style={{ margin: '6px 0 0 16px', fontSize: '0.83rem' }}>
                            {importResults.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    )}
                    <button className="dt-btn" style={{ marginTop: 6, fontSize: '0.78rem', padding: '2px 10px' }}
                        onClick={() => setImportResults(null)}>
                        Fermer
                    </button>
                </div>
            )}

            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher par nom, téléphone, type, district..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="dt-btn dt-btn-primary" onClick={openCreate}>
                    <i className="bi bi-plus-lg"></i> Ajouter
                </button>
                <button className="dt-btn" onClick={() => exportCSV(filtered)}
                    title="Exporter en CSV">
                    <i className="bi bi-download"></i> Exporter
                </button>
                <button className="dt-btn" onClick={() => importRef.current?.click()}
                    disabled={importing} title="Importer depuis un CSV">
                    <i className="bi bi-upload"></i> {importing ? 'Importation...' : 'Importer'}
                </button>
                <input ref={importRef} type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={handleImport} />
                <button className="dt-btn" onClick={fetchAll}>
                    <i className="bi bi-arrow-clockwise"></i> Actualiser
                </button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <SortableTh label="Nom"        field="nom"                   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Téléphone</th>
                            <SortableTh label="Type"       field="typeRelais"             sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="District"   field="district.nom"           sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Structure"  field="structureSanitaire.nom" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortableTh label="Exp. (ans)" field="nbreAnneesExperience"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="dt-center">Aucun relais communautaire.</td></tr>
                        ) : filtered.map(r => (
                            <tr key={r._id}>
                                <td><strong>{r.nom}</strong></td>
                                <td style={{ fontSize: '0.83rem' }}>{r.telephone || <span className="dt-muted">—</span>}</td>
                                <td>
                                    <span className={`dt-badge ${TYPE_COLOR[r.typeRelais] ?? 'dt-badge-inactif'}`}>
                                        {r.typeRelais}
                                    </span>
                                </td>
                                <td>{r.district?.nom ?? <span className="dt-muted">—</span>}</td>
                                <td>{r.structureSanitaire?.nom ?? <span className="dt-muted">—</span>}</td>
                                <td style={{ textAlign: 'center' }}>{r.nbreAnneesExperience ?? 0}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="dt-btn dt-btn-edit" onClick={() => openEdit(r)}>
                                            <i className="bi bi-pencil-fill"></i>
                                        </button>
                                        <button className="dt-btn dt-btn-danger" onClick={() => setConfirmId(r._id)}>
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
                <span>{filtered.length} relais{search ? ` sur ${sorted.length}` : ''}</span>
            </div>

            {/* ── Modal Ajout / Édition ── */}
            {modal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Modifier le relais' : 'Nouveau relais communautaire'}</h2>
                            <button className="modal-close" onClick={() => setModal(false)}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            {error && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}

                            <div className="form-group">
                                <label>Nom complet <span className="req">*</span></label>
                                <input
                                    placeholder="Ex: Aminatou Moussa"
                                    value={form.nom}
                                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Téléphone</label>
                                <input
                                    placeholder="Ex: 22790000000"
                                    value={form.telephone}
                                    onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label>Type de relais</label>
                                <select value={form.typeRelais} onChange={e => setForm(f => ({ ...f, typeRelais: e.target.value }))}>
                                    {TYPES_RELAIS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>District</label>
                                <select value={form.districtId} onChange={onChangeDistricts}>
                                    <option value="">-- Aucun district --</option>
                                    {districts.map(d => <option key={d._id} value={d._id}>{d.nom}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Structure sanitaire</label>
                                <select value={form.structureSanitaireId} onChange={onChangeStructures}>
                                    <option value="">-- Aucune structure --</option>
                                    {filteredStructures.map(s => <option key={s._id} value={s._id}>{s.nom}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Années d'expérience</label>
                                <input
                                    type="number" min="0" max="50"
                                    value={form.nbreAnneesExperience}
                                    onChange={e => setForm(f => ({ ...f, nbreAnneesExperience: e.target.value }))}
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Confirmation suppression ── */}
            {confirmId && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h2>Confirmer la suppression</h2>
                            <button className="modal-close" onClick={() => setConfirmId(null)}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Voulez-vous vraiment supprimer ce relais communautaire ?</p>
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
