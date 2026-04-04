import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/index.js';
import { validerMotDePasse, PASSWORD_RULES } from '../../utils/passwordPolicy.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

function genLoginPreview(nom) {
    return nom
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/[-\s]+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        + '@sante.gouv.ne';
}

const ROLES = [
    { value: 'admin',  label: 'Administrateur' },
    { value: 'agent',  label: 'Agent de santé'  },
    { value: 'staff',  label: 'Staff'           },
    { value: 'user',   label: 'Utilisateur'     },
    { value: 'autre',  label: 'Autre'           },
];
const EMPTY_FORM = { nom: '', email: '', password: '', role: 'agent', actif: true };

export default function Utilisateurs() {
    const [users, setUsers]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [search, setSearch]         = useState('');
    const [modal, setModal]           = useState(null);   // null | 'create' | 'edit' | 'delete'
    const [selected, setSelected]     = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [formError, setFormError]   = useState('');
    const [saving, setSaving]         = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    async function fetchUsers() {
        setLoading(true);
        try { setUsers(await getUsers()); }
        catch (e) { 
            console.log('e:', e)
            setError(e.message); }
        finally { setLoading(false); }
    }

    function openCreate() {
        setForm(EMPTY_FORM);
        setFormError('');
        setModal('create');
    }

    function openEdit(user) {
        setSelected(user);
        setForm({ nom: user.nom, email: user.email, password: '', role: user.role, actif: user.actif });
        setFormError('');
        setModal('edit');
    }

    function openDelete(user) {
        setSelected(user);
        setModal('delete');
    }

    function closeModal() { setModal(null); setSelected(null); setFormError(''); }

    function handleFormChange(e) {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
        setFormError('');
    }

    async function handleCreate(e) {
        e.preventDefault();
        const { valide, erreurs } = validerMotDePasse(form.password);
        if (!valide) { setFormError(erreurs[0]); return; }
        setSaving(true);
        try {
            const created = await createUser(form);
            setUsers(u => [created, ...u]);
            closeModal();
        } catch (e) { setFormError(e.message); }
        finally { setSaving(false); }
    }

    async function handleEdit(e) {
        e.preventDefault();
        if (form.password) {
            const { valide, erreurs } = validerMotDePasse(form.password);
            if (!valide) { setFormError(erreurs[0]); return; }
        }
        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            const updated = await updateUser(selected._id, payload);
            setUsers(u => u.map(x => x._id === updated._id ? updated : x));
            closeModal();
        } catch (e) { setFormError(e.message); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteUser(selected._id);
            setUsers(u => u.filter(x => x._id !== selected._id));
            closeModal();
        } catch (e) { setFormError(e.message); }
        finally { setSaving(false); }
    }

    const filtered = users.filter(u =>
        u.nom.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
    const { paged, page, setPage, totalPages } = usePagination(filtered);

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Utilisateurs</h1>
            <p className="dash-page-sub">Gestion des comptes administrateurs et agents.</p>

            {error && <div className="dt-error">⚠️ {error}</div>}

            {/* Barre d'outils */}
            <div className="dt-toolbar">
                <input
                    className="dt-search"
                    placeholder="Rechercher par nom ou email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="dt-btn dt-btn-primary" onClick={openCreate}>
                    + Créer un utilisateur
                </button>
            </div>

            {/* Tableau */}
            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Identifiant</th>
                            <th>Email</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Créé le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="6" className="dt-center">Aucun utilisateur trouvé.</td></tr>
                        ) : paged.map(u => (
                            <tr key={u._id}>
                                <td><span className="dt-avatar">{u.nom[0].toUpperCase()}</span>{u.nom}</td>
                                <td><span className="dt-mono">{u.login ?? '—'}</span></td>
                                <td>{u.email}</td>
                                <td><span className={`dt-badge dt-badge-${u.role}`}>{u.role}</span></td>
                                <td><span className={`dt-badge ${u.actif ? 'dt-badge-actif' : 'dt-badge-inactif'}`}>{u.actif ? 'Actif' : 'Inactif'}</span></td>
                                <td>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openEdit(u)}>✏️ Modifier</button>
                                    <button className="dt-btn dt-btn-danger" onClick={() => openDelete(u)}>🗑️ Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* Modal Créer / Modifier */}
            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Créer un utilisateur' : 'Modifier l\'utilisateur'}</h2>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>

                        <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="modal-form">
                            {formError && <div className="modal-error">⚠️ {formError}</div>}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nom complet</label>
                                    <input name="nom" value={form.nom} onChange={handleFormChange} placeholder="Prénom Nom" required />
                                    {modal === 'create' && form.nom.trim() && (
                                        <small style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
                                            Identifiant : <strong>{genLoginPreview(form.nom)}</strong>
                                        </small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="email@exemple.com" required />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Rôle</label>
                                    <select name="role" value={form.role} onChange={handleFormChange}>
                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group form-group-check">
                                    <label>
                                        <input type="checkbox" name="actif" checked={form.actif} onChange={handleFormChange} />
                                        Compte actif
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{modal === 'edit' ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</label>
                                <input name="password" type="password" value={form.password} onChange={handleFormChange} placeholder="••••••••" required={modal === 'create'} />
                                {form.password.length > 0 && (
                                    <ul className="password-rules">
                                        {PASSWORD_RULES.map(rule => (
                                            <li key={rule.message} className={rule.regex.test(form.password) ? 'rule-ok' : 'rule-ko'}>
                                                {rule.regex.test(form.password) ? '✓' : '✗'} {rule.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={closeModal}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving}>
                                    {saving ? 'Enregistrement...' : modal === 'create' ? 'Créer' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Supprimer */}
            {modal === 'delete' && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Confirmer la suppression</h2>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>
                        <div className="modal-body">
                            {formError && <div className="modal-error">⚠️ {formError}</div>}
                            <p>Voulez-vous supprimer l'utilisateur <strong>{selected?.nom}</strong> ?<br />Cette action est irréversible.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={closeModal}>Annuler</button>
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
