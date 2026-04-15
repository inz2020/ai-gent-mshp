import { useEffect, useRef, useState } from 'react';
import {
    getCampagnes, createCampagne, updateCampagne, deleteCampagne,
    lancerCampagne, uploadCampagneMedia,
} from '../../api/index.js';
import { getDistricts } from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import Pagination from '../../components/Pagination.jsx';

const TYPES_CAMPAGNE = [
    { value: 'JNV',                label: 'JNV (Journée Nationale de Vaccination)' },
    { value: 'distribution_masse', label: 'Distribution de masse' },
    { value: 'riposte',            label: 'Riposte' },
];

const MSG_TYPES = [
    { value: 'texte',    label: '✏️ Texte',    icon: '✏️' },
    { value: 'audio',    label: '🎵 Audio',    icon: '🎵' },
    { value: 'image',    label: '🖼️ Image',    icon: '🖼️' },
    { value: 'video',    label: '🎬 Vidéo',    icon: '🎬' },
    { value: 'document', label: '📄 Document', icon: '📄' },
];

const STATUT_BADGE = {
    brouillon: 'dt-badge-inactif',
    en_cours:  'dt-badge-danger',
    terminee:  'dt-badge-actif',
    annulee:   'dt-badge-inactif',
};
const STATUT_LABEL = {
    brouillon: 'Brouillon',
    en_cours:  'En cours',
    terminee:  'Terminée',
    annulee:   'Annulée',
};

const EMPTY_FORM = {
    nom: '', type: 'JNV', produit: '', dateDebut: '', dateFin: '',
    districts: [],
    messageType: 'texte', messageTexte: '', messageMediaUrl: '',
    messageMediaNom: '', messageCaption: '',
};

export default function Campagnes() {
    const [campagnes, setCampagnes]   = useState([]);
    const [districts, setDistricts]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [success, setSuccess]       = useState('');
    const [search, setSearch]         = useState('');

    const [modal, setModal]           = useState(null); // null | 'create' | 'edit' | 'delete' | 'detail'
    const [selected, setSelected]     = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [formError, setFormError]   = useState('');
    const [saving, setSaving]         = useState(false);
    const [uploading, setUploading]   = useState(false);
    const [launching, setLaunching]   = useState(null);

    const fileRef = useRef(null);

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [c, d] = await Promise.all([getCampagnes(), getDistricts()]);
            setCampagnes(c);
            setDistricts(d);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    function openCreate() {
        setForm(EMPTY_FORM);
        setFormError('');
        setModal('create');
    }

    function openEdit(c) {
        setSelected(c);
        setForm({
            nom: c.nom, type: c.type, produit: c.produit ?? '',
            dateDebut: c.dateDebut?.slice(0, 10) ?? '',
            dateFin:   c.dateFin?.slice(0, 10) ?? '',
            districts: c.districts?.map(d => d._id) ?? [],
            messageType: c.messageType, messageTexte: c.messageTexte ?? '',
            messageMediaUrl: c.messageMediaUrl ?? '', messageMediaNom: c.messageMediaNom ?? '',
            messageCaption: c.messageCaption ?? '',
        });
        setFormError('');
        setModal('edit');
    }

    function closeModal() { setModal(null); setSelected(null); setFormError(''); }

    function setField(field, val) {
        setForm(f => ({ ...f, [field]: val }));
        setFormError('');
    }

    function toggleDistrict(id) {
        setForm(f => ({
            ...f,
            districts: f.districts.includes(id)
                ? f.districts.filter(d => d !== id)
                : [...f.districts, id],
        }));
    }

    // Upload média
    async function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploading(true);
        setFormError('');
        try {
            const result = await uploadCampagneMedia(file, form.messageType);
            setForm(f => ({ ...f, messageMediaUrl: result.url, messageMediaNom: result.nom ?? file.name }));
        } catch (err) {
            setFormError('Erreur upload : ' + err.message);
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.nom.trim())   { setFormError('Le nom est requis.'); return; }
        if (!form.dateDebut)    { setFormError('La date de début est requise.'); return; }
        if (!form.dateFin)      { setFormError('La date de fin est requise.'); return; }
        if (form.messageType === 'texte' && !form.messageTexte.trim()) {
            setFormError('Le message texte est requis.'); return;
        }
        if (form.messageType !== 'texte' && !form.messageMediaUrl) {
            setFormError('Veuillez uploader un fichier média.'); return;
        }

        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createCampagne(form);
                setCampagnes(prev => [created, ...prev]);
                setSuccess('Campagne créée.');
            } else {
                const updated = await updateCampagne(selected._id, form);
                setCampagnes(prev => prev.map(c => c._id === updated._id ? updated : c));
                setSuccess('Campagne mise à jour.');
            }
            setTimeout(() => setSuccess(''), 4000);
            closeModal();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        setSaving(true);
        try {
            await deleteCampagne(selected._id);
            setCampagnes(prev => prev.filter(c => c._id !== selected._id));
            setSuccess('Campagne supprimée.');
            setTimeout(() => setSuccess(''), 4000);
            closeModal();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleLancer(campagne) {
        if (!confirm(`Lancer la campagne "${campagne.nom}" vers les contacts des districts sélectionnés ?`)) return;
        setLaunching(campagne._id);
        try {
            const res = await lancerCampagne(campagne._id);
            setSuccess(res.message);
            setTimeout(() => setSuccess(''), 6000);
            await fetchAll();
        } catch (err) {
            setError(err.message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setLaunching(null);
        }
    }

    const filtered = campagnes.filter(c =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.type.toLowerCase().includes(search.toLowerCase()) ||
        (c.produit ?? '').toLowerCase().includes(search.toLowerCase())
    );

    const { paged, page, setPage, totalPages } = usePagination(filtered, 10);

    const accept = {
        audio: 'audio/*', video: 'video/*',
        image: 'image/*', document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
    };

    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Campagnes</h1>
            <p className="dash-page-sub">Planification et envoi de messages en masse aux contacts.</p>

            {error   && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {success && <div className="dt-success"><i className="bi bi-check-lg"></i> {success}</div>}

            <div className="dt-toolbar">
                <input className="dt-search" placeholder="Rechercher par nom, type ou produit..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                <button className="dt-btn dt-btn-primary" onClick={openCreate}><i className="bi bi-plus-lg"></i> Nouvelle campagne</button>
                <button className="dt-btn" onClick={fetchAll}><i className="bi bi-arrow-clockwise"></i> Actualiser</button>
            </div>

            <div className="dt-wrapper">
                <table className="dt-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Type</th>
                            <th>Produit</th>
                            <th>Période</th>
                            <th>Districts</th>
                            <th>Message</th>
                            <th>Statut</th>
                            <th>Progression</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="dt-center">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="9" className="dt-center">Aucune campagne trouvée.</td></tr>
                        ) : paged.map(c => (
                            <tr key={c._id}>
                                <td><strong>{c.nom}</strong></td>
                                <td><span className="dt-badge dt-badge-lang">{TYPES_CAMPAGNE.find(t => t.value === c.type)?.label ?? c.type}</span></td>
                                <td>{c.produit || <span className="dt-muted">—</span>}</td>
                                <td style={{ fontSize: '0.82rem' }}>
                                    {new Date(c.dateDebut).toLocaleDateString('fr-FR')} <i className="bi bi-arrow-right"></i><br />
                                    {new Date(c.dateFin).toLocaleDateString('fr-FR')}
                                </td>
                                <td style={{ textAlign: 'center' }}>{c.districts?.length ?? 0}</td>
                                <td>
                                    <span className="dt-badge dt-badge-inactif">
                                        {MSG_TYPES.find(m => m.value === c.messageType)?.label ?? c.messageType}
                                    </span>
                                </td>
                                <td>
                                    <span className={`dt-badge ${STATUT_BADGE[c.statut] ?? 'dt-badge-inactif'}`}>
                                        {STATUT_LABEL[c.statut] ?? c.statut}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.82rem' }}>
                                    {c.statut === 'brouillon' ? <span className="dt-muted">—</span>
                                        : `${c.nbEnvoyes}/${c.nbCibles} envoyés`}
                                    {c.nbEchecs > 0 && <span style={{ color: '#dc2626' }}> ({c.nbEchecs} échecs)</span>}
                                </td>
                                <td className="dt-actions">
                                    <button className="dt-btn dt-btn-edit" onClick={() => openEdit(c)}
                                        disabled={c.statut === 'en_cours'}>✏️</button>
                                    {(c.statut === 'brouillon' || c.statut === 'annulee') && (
                                        <button className="dt-btn dt-btn-primary"
                                            onClick={() => handleLancer(c)}
                                            disabled={launching === c._id}>
                                            {launching === c._id ? '⏳' : '▶ Lancer'}
                                        </button>
                                    )}
                                    <button className="dt-btn dt-btn-danger"
                                        onClick={() => { setSelected(c); setFormError(''); setModal('delete'); }}
                                        disabled={c.statut === 'en_cours'}><i className="bi bi-trash-fill"></i></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="dt-footer">
                <span>{filtered.length} campagne{filtered.length !== 1 ? 's' : ''}</span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {/* ══ Modal Créer / Modifier ══ */}
            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Nouvelle campagne' : 'Modifier la campagne'}</h2>
                            <button className="modal-close" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            {formError && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formError}</div>}

                            {/* ── Infos générales ── */}
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 12, color: '#475569' }}>Informations générales</p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nom de la campagne *</label>
                                        <input value={form.nom} onChange={e => setField('nom', e.target.value)}
                                            placeholder="Ex : JNV Avril 2025" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Type *</label>
                                        <select value={form.type} onChange={e => setField('type', e.target.value)}>
                                            {TYPES_CAMPAGNE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Produit</label>
                                        <input value={form.produit} onChange={e => setField('produit', e.target.value)}
                                            placeholder="Ex : VPO, Pentavalent..." />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Date de début *</label>
                                        <input type="date" value={form.dateDebut}
                                            onChange={e => setField('dateDebut', e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Date de fin *</label>
                                        <input type="date" value={form.dateFin}
                                            onChange={e => setField('dateFin', e.target.value)} required />
                                    </div>
                                </div>
                            </div>

                            {/* ── Districts ── */}
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: '#475569' }}>
                                    Districts concernés <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.districts.length} sélectionné{form.districts.length !== 1 ? 's' : ''})</span>
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px', maxHeight: 180, overflowY: 'auto' }}>
                                    {districts.map(d => (
                                        <label key={d._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={form.districts.includes(d._id)}
                                                onChange={() => toggleDistrict(d._id)} />
                                            {d.nom}
                                        </label>
                                    ))}
                                </div>
                                {form.districts.length === 0 && (
                                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 6 }}>
                                        Aucun district sélectionné = tous les contacts
                                    </p>
                                )}
                            </div>

                            {/* ── Compositeur de message ── */}
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 12, color: '#475569' }}>Message</p>

                                {/* Sélecteur type */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                                    {MSG_TYPES.map(m => (
                                        <button key={m.value} type="button"
                                            onClick={() => setForm(f => ({ ...f, messageType: m.value, messageMediaUrl: '', messageMediaNom: '' }))}
                                            style={{
                                                padding: '6px 14px', borderRadius: 20, border: '2px solid',
                                                borderColor: form.messageType === m.value ? 'var(--green, #16a34a)' : '#e2e8f0',
                                                background: form.messageType === m.value ? 'var(--green, #16a34a)' : '#fff',
                                                color: form.messageType === m.value ? '#fff' : '#475569',
                                                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                                            }}>
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Contenu selon le type */}
                                {form.messageType === 'texte' ? (
                                    <div className="form-group">
                                        <label>Contenu du message *</label>
                                        <textarea rows={5} value={form.messageTexte}
                                            onChange={e => setField('messageTexte', e.target.value)}
                                            placeholder="Rédigez votre message ici..." required
                                            style={{ resize: 'vertical', minHeight: 100 }} />
                                        <small style={{ color: '#94a3b8' }}>{form.messageTexte.length} caractères</small>
                                    </div>
                                ) : (
                                    <>
                                        <input ref={fileRef} type="file" style={{ display: 'none' }}
                                            accept={accept[form.messageType] ?? '*/*'}
                                            onChange={handleFileChange} />

                                        <div style={{
                                            border: '2px dashed #cbd5e1', borderRadius: 8, padding: '20px 16px',
                                            textAlign: 'center', cursor: 'pointer', marginBottom: 10,
                                            background: form.messageMediaUrl ? '#f0fdf4' : '#fff',
                                        }}
                                            onClick={() => fileRef.current?.click()}>
                                            {uploading ? (
                                                <p style={{ color: '#94a3b8' }}>⏳ Upload en cours...</p>
                                            ) : form.messageMediaUrl ? (
                                                <>
                                                    <p style={{ color: '#16a34a', fontWeight: 600 }}><i className="bi bi-check-lg"></i> Fichier chargé</p>
                                                    <p style={{ fontSize: '0.82rem', color: '#475569' }}>{form.messageMediaNom}</p>
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Cliquer pour remplacer</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p style={{ fontSize: '1.5rem', marginBottom: 6 }}>
                                                        {MSG_TYPES.find(m => m.value === form.messageType)?.icon}
                                                    </p>
                                                    <p style={{ fontWeight: 600, color: '#475569' }}>
                                                        Cliquer pour uploader un fichier {form.messageType}
                                                    </p>
                                                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>Max 25 Mo</p>
                                                </>
                                            )}
                                        </div>

                                        {['image', 'video', 'document'].includes(form.messageType) && (
                                            <div className="form-group">
                                                <label>Légende (optionnelle)</label>
                                                <input value={form.messageCaption}
                                                    onChange={e => setField('messageCaption', e.target.value)}
                                                    placeholder="Texte d'accompagnement..." />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={closeModal}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={saving || uploading}>
                                    {saving ? 'Enregistrement...' : modal === 'create' ? 'Créer' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ Modal suppression ══ */}
            {modal === 'delete' && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Supprimer la campagne</h2>
                            <button className="modal-close" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            {formError && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formError}</div>}
                            <p>Voulez-vous supprimer <strong>{selected?.nom}</strong> ?</p>
                            <p style={{ color: '#dc2626', fontSize: '0.88rem', marginTop: 8 }}>Cette action est irréversible.</p>
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
