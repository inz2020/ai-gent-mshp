import { useEffect, useRef, useState } from 'react';
import {
    getCampagnes, createCampagne, updateCampagne, deleteCampagne, lancerCampagne,
    getRelais, createRelais, updateRelais, deleteRelais,
    getReunions, createReunion, updateReunion, deleteReunion,
    getMobilisationRelais, createMobilisationRelais, updateMobilisationRelais, deleteMobilisationRelais,
    diffuserMobilisationRelais, diffuserToutCampagne,
    uploadMobilisationAudio,
    getWhatsappTemplates, createWhatsappTemplate, updateWhatsappTemplate, deleteWhatsappTemplate,
    getDistricts, getStructures,
} from '../../api/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { useSort } from '../../hooks/useSort.js';
import Pagination from '../../components/Pagination.jsx';
import SortableTh from '../../components/SortableTh.jsx';
import { TYPES_CAMPAGNE, STATUT_BADGE, STATUT_LABEL, EMPTY_FORM } from '../../utils/constants.js';

// ─── Constantes ───────────────────────────────────────────────
const TYPES_RELAIS   = ['RCom', 'ICCM'];
const TYPES_REUNION  = ['Réunion', 'Plaidoyer'];
const TYPE_COLOR_R   = { RCom: 'dt-badge-actif', ICCM: 'dt-badge-warning' };

const EMPTY_REUNION = { nom: '', type: 'Réunion', date: '', lieu: '', districtId: '', nbParticipants: 0, description: '' };
const EMPTY_RELAIS  = { nom: '', telephone: '', districtId: '', structureSanitaireId: '', nbreAnneesExperience: 0, typeRelais: 'RCom' };

const TABS = [
    { key: 'organisation',  label: 'Organisation',         icon: 'bi-calendar2-check'    },
    { key: 'mobilisation',  label: 'Mobilisation Sociale', icon: 'bi-people-fill'        },
    { key: 'spots',         label: 'Spots',                icon: 'bi-megaphone-fill'     },
    { key: 'validation',    label: 'Validation Campagne',  icon: 'bi-patch-check-fill'   },
    { key: 'rapports',      label: 'Rapports',             icon: 'bi-bar-chart-fill'     },
];

export default function Campagnes() {
    // ── Tab / campagne active
    const [activeTab, setActiveTab]         = useState('organisation');
    const [activeCampagne, setActiveCampagne] = useState(null);

    // ── Organisation ─────────────────────────────────────────────
    const [campagnes, setCampagnes]   = useState([]);
    const [districts, setDistricts]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [success, setSuccess]       = useState('');
    const [search, setSearch]         = useState('');

    const [modal, setModal]           = useState(null);
    const [selected, setSelected]     = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [formError, setFormError]   = useState('');
    const [saving, setSaving]         = useState(false);
    const [launching, setLaunching]   = useState(null);
    const [districtSearch, setDistrictSearch] = useState('');

    // ── Mobilisation Sociale ──────────────────────────────────────
    const [relais, setRelais]         = useState([]);
    const [structures, setStructures] = useState([]);
    const [loadingMob, setLoadingMob] = useState(false);

    const [reunions, setReunions]     = useState([]);
    const [loadingReu, setLoadingReu] = useState(false);

    // Modals relais
    const [relaisModal, setRelaisModal]       = useState(false);
    const [editingRelais, setEditingRelais]   = useState(null);
    const [relaisForm, setRelaisForm]         = useState(EMPTY_RELAIS);
    const [savingRelais, setSavingRelais]     = useState(false);
    const [confirmRelais, setConfirmRelais]   = useState(null);
    const [relaisErr, setRelaisErr]           = useState('');

    // Modals réunion
    const [reunionModal, setReunionModal]     = useState(false);
    const [editingReunion, setEditingReunion] = useState(null);
    const [reunionForm, setReunionForm]       = useState(EMPTY_REUNION);
    const [savingReunion, setSavingReunion]   = useState(false);
    const [confirmReunion, setConfirmReunion] = useState(null);
    const [reunionErr, setReunionErr]         = useState('');

    // ── Mobilisation Relais par District ──────────────────────────
    const [mobRelais, setMobRelais]                 = useState([]);
    const [loadingMobRelais, setLoadingMobRelais]   = useState(false);
    const [mobRelaisModal, setMobRelaisModal]       = useState(null); // 'view' | 'edit' | null
    const [mobRelaisDistrict, setMobRelaisDistrict] = useState(null); // district courant
    const [mobRelaisRecord, setMobRelaisRecord]     = useState(null); // enregistrement existant
    const [mobRelaisForm, setMobRelaisForm]         = useState({ relaisIds: [], concessionsVisitees: 0, personnesTouchees: 0, messageAudio: { url: '', nom: '', publicId: '' }, templateId: '' });
    const [savingMobRelais, setSavingMobRelais]     = useState(false);
    const [confirmMobRelais, setConfirmMobRelais]   = useState(null);
    const [mobRelaisErr, setMobRelaisErr]           = useState('');
    const [uploadingAudio, setUploadingAudio]       = useState(false);
    const audioInputRef = useRef(null);

    // ── Diffusion WhatsApp ────────────────────────────────────────
    const [diffusing, setDiffusing]     = useState(false);  // "tout diffuser" en cours
    const [diffErrMsg, setDiffErrMsg]   = useState('');
    const [diffSuccMsg, setDiffSuccMsg] = useState('');
    const [diffErrModal, setDiffErrModal] = useState(null); // { titre, message, log }
    const pollingRef = useRef(null);

    // ── Templates WhatsApp ────────────────────────────────────────
    const [templates, setTemplates]           = useState([]);
    const [tplModal, setTplModal]             = useState(null); // 'add' | 'edit'
    const [editingTpl, setEditingTpl]         = useState(null);
    const [tplForm, setTplForm]               = useState({ nom: '', templateName: '', langue: 'fr', description: '', statut: 'actif', typeContenu: 'audio', variablesCorps: 0, variablesEntete: 0 });
    const [savingTpl, setSavingTpl]           = useState(false);
    const [confirmTpl, setConfirmTpl]         = useState(null);
    const [tplErr, setTplErr]                 = useState('');
    const [searchTpl, setSearchTpl]           = useState('');

    // ── Init ─────────────────────────────────────────────────────
    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [c, d] = await Promise.all([getCampagnes(), getDistricts()]);
            setCampagnes(c); setDistricts(d);
            getWhatsappTemplates().then(setTemplates).catch(() => {});
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    // Charge données mobilisation quand campagne active change
    useEffect(() => {
        if (!activeCampagne) return;
        loadMobilisationData();
    }, [activeCampagne?._id]);

    async function loadMobilisationData() {
        setLoadingMob(true); setLoadingReu(true); setLoadingMobRelais(true);
        try {
            const [r, s, rp, mr] = await Promise.all([
                getRelais(), getStructures(), getReunions(activeCampagne._id),
                getMobilisationRelais(activeCampagne._id),
            ]);
            setRelais(r); setStructures(s); setReunions(rp); setMobRelais(mr);
        } catch (e) { setError(e.message); }
        finally { setLoadingMob(false); setLoadingReu(false); setLoadingMobRelais(false); }
    }

    // ── Templates WhatsApp CRUD ───────────────────────────────────
    function openAddTpl()    { setEditingTpl(null); setTplForm({ nom: '', templateName: '', langue: 'fr', description: '', statut: 'actif', typeContenu: 'audio', variablesCorps: 0, variablesEntete: 0 }); setTplErr(''); setTplModal('add'); }
    function openEditTpl(t)  { setEditingTpl(t); setTplForm({ nom: t.nom, templateName: t.templateName, langue: t.langue, description: t.description || '', statut: t.statut, typeContenu: t.typeContenu || 'audio', variablesCorps: t.variablesCorps ?? 0, variablesEntete: t.variablesEntete ?? 0 }); setTplErr(''); setTplModal('edit'); }
    function closeTplModal() { setTplModal(null); setEditingTpl(null); setTplErr(''); }

    async function handleSaveTpl(e) {
        e.preventDefault();
        if (!tplForm.nom.trim())          return setTplErr('Le nom affiché est requis.');
        if (!tplForm.templateName.trim()) return setTplErr('Le nom exact Meta est requis.');
        setSavingTpl(true); setTplErr('');
        try {
            if (editingTpl) {
                const updated = await updateWhatsappTemplate(editingTpl._id, tplForm);
                setTemplates(prev => prev.map(t => t._id === updated._id ? updated : t));
            } else {
                const created = await createWhatsappTemplate(tplForm);
                setTemplates(prev => [...prev, created]);
            }
            closeTplModal();
        } catch (e) { setTplErr(e.message); }
        finally { setSavingTpl(false); }
    }

    async function handleDeleteTpl(tpl) {
        try {
            await deleteWhatsappTemplate(tpl._id);
            setTemplates(prev => prev.filter(t => t._id !== tpl._id));
        } catch (e) { setError(e.message); }
        finally { setConfirmTpl(null); }
    }

    // ── Organisation : CRUD campagnes ─────────────────────────────
    function showMsg(msg) { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
    function closeModal() { setModal(null); setSelected(null); setFormError(''); setDistrictSearch(''); }
    function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })); setFormError(''); }
    function toggleDistrict(id) {
        setForm(f => ({
            ...f,
            districts: f.districts.includes(id)
                ? f.districts.filter(d => d !== id)
                : [...f.districts, id],
        }));
    }
    function toggleAllDistricts() {
        const allIds = districts.map(d => d._id);
        const allSelected = allIds.every(id => form.districts.includes(id));
        setForm(f => ({ ...f, districts: allSelected ? [] : allIds }));
    }

    async function handleCampagneSubmit(e) {
        e.preventDefault();
        if (!form.nom.trim())  { setFormError('Le nom est requis.'); return; }
        if (!form.dateDebut)   { setFormError('La date de début est requise.'); return; }
        if (!form.dateFin)     { setFormError('La date de fin est requise.'); return; }
        setSaving(true);
        try {
            if (modal === 'create') {
                const created = await createCampagne(form);
                setCampagnes(p => [created, ...p]);
                showMsg('Campagne créée.');
            } else {
                const updated = await updateCampagne(selected._id, form);
                setCampagnes(p => p.map(c => c._id === updated._id ? updated : c));
                showMsg('Campagne mise à jour.');
            }
            closeModal();
        } catch (err) { setFormError(err.message); }
        finally { setSaving(false); }
    }

    async function handleCampagneDelete() {
        setSaving(true);
        try {
            await deleteCampagne(selected._id);
            setCampagnes(p => p.filter(c => c._id !== selected._id));
            if (activeCampagne?._id === selected._id) setActiveCampagne(null);
            showMsg('Campagne supprimée.');
            closeModal();
        } catch (err) { setFormError(err.message); }
        finally { setSaving(false); }
    }

    async function handleLancer(campagne) {
        if (!confirm(`Lancer "${campagne.nom}" vers les contacts ?`)) return;
        setLaunching(campagne._id);
        try {
            const res = await lancerCampagne(campagne._id);
            showMsg(res.message);
            await fetchAll();
        } catch (err) {
            setError(err.message); setTimeout(() => setError(''), 5000);
        } finally { setLaunching(null); }
    }

    function openCampagne(campagne) {
        setActiveCampagne(campagne);
        setActiveTab('mobilisation');
    }

    // ── Relais : CRUD ─────────────────────────────────────────────
    function openCreateRelais() {
        setEditingRelais(null); setRelaisForm(EMPTY_RELAIS); setRelaisErr(''); setRelaisModal(true);
    }
    function openEditRelais(r) {
        setEditingRelais(r);
        setRelaisForm({
            nom: r.nom ?? '',
            telephone: r.telephone ?? '',
            districtId: r.district?._id ?? '',
            structureSanitaireId: r.structureSanitaire?._id ?? '',
            nbreAnneesExperience: r.nbreAnneesExperience ?? 0,
            typeRelais: r.typeRelais ?? 'RCom',
        });
        setRelaisErr(''); setRelaisModal(true);
    }
    async function handleRelaisSubmit(e) {
        e.preventDefault();
        setSavingRelais(true); setRelaisErr('');
        try {
            const payload = {
                nom: relaisForm.nom.trim(),
                telephone: relaisForm.telephone.trim(),
                districtId: relaisForm.districtId || undefined,
                structureSanitaireId: relaisForm.structureSanitaireId || undefined,
                nbreAnneesExperience: Number(relaisForm.nbreAnneesExperience),
                typeRelais: relaisForm.typeRelais,
            };
            if (editingRelais) {
                const up = await updateRelais(editingRelais._id, payload);
                setRelais(r => r.map(x => x._id === up._id ? up : x));
            } else {
                const cr = await createRelais(payload);
                setRelais(r => [...r, cr]);
            }
            setRelaisModal(false);
        } catch (e) { setRelaisErr(e.message); }
        finally { setSavingRelais(false); }
    }
    async function handleRelaisDelete(id) {
        try {
            await deleteRelais(id);
            setRelais(r => r.filter(x => x._id !== id));
            setConfirmRelais(null);
        } catch (e) { setError(e.message); }
    }

    // ── Réunions : CRUD ───────────────────────────────────────────
    function openCreateReunion() {
        setEditingReunion(null); setReunionForm(EMPTY_REUNION); setReunionErr(''); setReunionModal(true);
    }
    function openEditReunion(r) {
        setEditingReunion(r);
        setReunionForm({
            nom: r.nom ?? '',
            type: r.type ?? 'Réunion',
            date: r.date?.slice(0, 10) ?? '',
            lieu: r.lieu ?? '',
            districtId: r.district?._id ?? '',
            nbParticipants: r.nbParticipants ?? 0,
            description: r.description ?? '',
        });
        setReunionErr(''); setReunionModal(true);
    }
    async function handleReunionSubmit(e) {
        e.preventDefault();
        if (!reunionForm.nom.trim()) { setReunionErr('Le nom est requis.'); return; }
        setSavingReunion(true); setReunionErr('');
        try {
            const payload = {
                nom: reunionForm.nom.trim(),
                type: reunionForm.type,
                date: reunionForm.date || undefined,
                lieu: reunionForm.lieu,
                districtId: reunionForm.districtId || undefined,
                nbParticipants: Number(reunionForm.nbParticipants),
                description: reunionForm.description,
                campagneId: activeCampagne._id,
            };
            if (editingReunion) {
                const up = await updateReunion(editingReunion._id, payload);
                setReunions(r => r.map(x => x._id === up._id ? up : x));
            } else {
                const cr = await createReunion(payload);
                setReunions(r => [...r, cr]);
            }
            setReunionModal(false);
        } catch (e) { setReunionErr(e.message); }
        finally { setSavingReunion(false); }
    }
    async function handleReunionDelete(id) {
        try {
            await deleteReunion(id);
            setReunions(r => r.filter(x => x._id !== id));
            setConfirmReunion(null);
        } catch (e) { setError(e.message); }
    }

    // ── Mobilisation Relais par District : handlers ───────────────
    function openViewMobRelais(district, record) {
        setMobRelaisDistrict(district);
        setMobRelaisRecord(record ?? null);
        setMobRelaisModal('view');
    }
    function openEditMobRelais(district, record) {
        setMobRelaisDistrict(district);
        setMobRelaisRecord(record ?? null);
        setMobRelaisForm({
            relaisIds:           record?.relais?.map(r => r._id) ?? [],
            concessionsVisitees: record?.concessionsVisitees ?? 0,
            personnesTouchees:   record?.personnesTouchees   ?? 0,
            messageAudio:        record?.messageAudio ?? { url: '', nom: '', publicId: '' },
            templateId:          record?.template?._id ?? '',
        });
        setMobRelaisErr('');
        setMobRelaisModal('edit');
    }
    function toggleMobRelais(id) {
        setMobRelaisForm(f => ({
            ...f,
            relaisIds: f.relaisIds.includes(id)
                ? f.relaisIds.filter(x => x !== id)
                : [...f.relaisIds, id],
        }));
    }
    async function handleAudioUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploadingAudio(true);
        try {
            const res = await uploadMobilisationAudio(file);
            setMobRelaisForm(f => ({ ...f, messageAudio: { url: res.url, nom: res.nom, publicId: res.publicId } }));
        } catch (e) { setMobRelaisErr(e.message); }
        finally { setUploadingAudio(false); }
    }
    async function handleMobRelaisSubmit(e) {
        e.preventDefault();
        setSavingMobRelais(true); setMobRelaisErr('');
        try {
            const payload = {
                campagneId:          activeCampagne._id,
                districtId:          mobRelaisDistrict._id,
                relaisIds:           mobRelaisForm.relaisIds,
                concessionsVisitees: Number(mobRelaisForm.concessionsVisitees),
                personnesTouchees:   Number(mobRelaisForm.personnesTouchees),
                messageAudio:        mobRelaisForm.messageAudio,
                templateId:          mobRelaisForm.templateId || null,
            };
            if (mobRelaisRecord) {
                const up = await updateMobilisationRelais(mobRelaisRecord._id, payload);
                setMobRelais(prev => prev.map(x => x._id === up._id ? up : x));
            } else {
                const cr = await createMobilisationRelais(payload);
                setMobRelais(prev => [...prev, cr]);
            }
            setMobRelaisModal(null);
        } catch (e) { setMobRelaisErr(e.message); }
        finally { setSavingMobRelais(false); }
    }
    async function handleMobRelaisDelete(id) {
        try {
            await deleteMobilisationRelais(id);
            setMobRelais(prev => prev.filter(x => x._id !== id));
            setConfirmMobRelais(null);
        } catch (e) { setError(e.message); }
    }

    // ── Diffusion WhatsApp ────────────────────────────────────────
    // Polling : rafraîchit mobRelais tant qu'un district est en cours d'envoi
    useEffect(() => {
        const hasEnCours = mobRelais.some(m => m.diffusion?.statut === 'en_cours');
        if (!hasEnCours) {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            return;
        }
        if (pollingRef.current) return; // déjà en cours
        pollingRef.current = setInterval(async () => {
            if (!activeCampagne) return;
            try {
                const fresh = await getMobilisationRelais(activeCampagne._id);
                setMobRelais(fresh);
                const stillRunning = fresh.some(m => m.diffusion?.statut === 'en_cours');
                if (!stillRunning) { clearInterval(pollingRef.current); pollingRef.current = null; }
            } catch (_) { /* silencieux */ }
        }, 3000);
        return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    }, [mobRelais, activeCampagne?._id]);

    async function handleDiffuser(record) {
        setDiffErrMsg(''); setDiffSuccMsg('');
        try {
            const res = await diffuserMobilisationRelais(record._id);
            setDiffSuccMsg(res.message + (res.sansNumero?.length ? ` (${res.sansNumero.length} sans numéro ignoré${res.sansNumero.length > 1 ? 's' : ''})` : ''));
            setTimeout(() => setDiffSuccMsg(''), 6000);
            setMobRelais(prev => prev.map(m =>
                m._id === record._id
                    ? { ...m, diffusion: { ...m.diffusion, statut: 'en_cours', total: res.total, envoyes: 0, echecs: 0 } }
                    : m
            ));
        } catch (e) {
            // Récupérer le errorLog si la diffusion a partiellement tourné
            const rec = mobRelais.find(m => m._id === record._id);
            setDiffErrModal({
                titre: `Erreur — District ${record.district?.nom || ''}`,
                message: e.message,
                log: rec?.diffusion?.errorLog || '',
            });
        }
    }

    async function handleDiffuserTout() {
        if (!activeCampagne) return;
        if (!confirm(`Diffuser les messages audio vers tous les relais de la campagne "${activeCampagne.nom}" ?`)) return;
        setDiffusing(true); setDiffErrMsg(''); setDiffSuccMsg('');
        try {
            const res = await diffuserToutCampagne(activeCampagne._id);
            setDiffSuccMsg(res.message);
            setTimeout(() => setDiffSuccMsg(''), 6000);
            const fresh = await getMobilisationRelais(activeCampagne._id);
            setMobRelais(fresh);
        } catch (e) {
            // Récupérer les errorLogs de tous les districts en erreur
            const fresh = await getMobilisationRelais(activeCampagne._id).catch(() => mobRelais);
            setMobRelais(fresh);
            const logsErreur = fresh
                .filter(m => m.diffusion?.statut === 'erreur' && m.diffusion?.errorLog)
                .map(m => `[${m.district?.nom || m.district}]\n${m.diffusion.errorLog}`)
                .join('\n\n');
            setDiffErrModal({
                titre: 'Erreur — Diffusion globale',
                message: e.message,
                log: logsErreur,
            });
        }
        finally { setDiffusing(false); }
    }

    // ── Recherche mobilisation ────────────────────────────────────
    const [searchDistrict, setSearchDistrict] = useState('');
    const [searchRelaisComm, setSearchRelaisComm] = useState('');
    const [searchReunion, setSearchReunion]       = useState('');

    // ── Tri / pagination Organisation ─────────────────────────────
    const filtered = campagnes.filter(c =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.type.toLowerCase().includes(search.toLowerCase()) ||
        (c.produit ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const { sorted: sortedCamp, sortKey: sk, sortDir: sd, toggleSort: ts } = useSort(filtered, 'nom');
    const { paged, page, setPage, totalPages } = usePagination(sortedCamp, 10);

    // ── Pagination mobilisation (hooks appelés inconditionnellement) ─
    const campDistricts = activeCampagne?.districts ?? [];
    const filtDistricts = campDistricts.filter(d =>
        !searchDistrict || d.nom.toLowerCase().includes(searchDistrict.toLowerCase())
    );
    const { paged: pagedDistricts, page: pageDistr, setPage: setPageDistr, totalPages: totalDistr } = usePagination(filtDistricts,  5);

    const filtRelaisComm = relais.filter(r =>
        !searchRelaisComm ||
        r.nom.toLowerCase().includes(searchRelaisComm.toLowerCase()) ||
        (r.telephone ?? '').includes(searchRelaisComm) ||
        (r.district?.nom ?? '').toLowerCase().includes(searchRelaisComm.toLowerCase()) ||
        (r.typeRelais ?? '').toLowerCase().includes(searchRelaisComm.toLowerCase())
    );
    const { paged: pagedRelaisComm, page: pageRelais, setPage: setPageRelais, totalPages: totalRelais } = usePagination(filtRelaisComm, 10);

    const filtReunions = reunions.filter(r =>
        !searchReunion ||
        r.nom.toLowerCase().includes(searchReunion.toLowerCase()) ||
        (r.district?.nom ?? '').toLowerCase().includes(searchReunion.toLowerCase()) ||
        (r.lieu ?? '').toLowerCase().includes(searchReunion.toLowerCase()) ||
        (r.type ?? '').toLowerCase().includes(searchReunion.toLowerCase())
    );
    const { paged: pagedReunions, page: pageReunion, setPage: setPageReunion, totalPages: totalReunion } = usePagination(filtReunions, 10);

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Campagnes</h1>
            <p className="dash-page-sub">Planification et suivi des campagnes de vaccination.</p>

            {error   && <div className="dt-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}
            {success && <div className="dt-success"><i className="bi bi-check-lg"></i> {success}</div>}

            {/* ── Barre d'onglets ── */}
            <div className="camp-tabs">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        className={`camp-tab-btn${activeTab === t.key ? ' active' : ''}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        <i className={`bi ${t.icon}`}></i>
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Bandeau campagne active ── */}
            {activeCampagne && activeTab !== 'organisation' && (
                <div className="campagne-banner">
                    <i className="bi bi-broadcast-pin"></i>
                    <span>Campagne : <strong>{activeCampagne.nom}</strong></span>
                    <span className={`dt-badge ${STATUT_BADGE[activeCampagne.statut] ?? 'dt-badge-inactif'}`} style={{ fontSize: '0.78rem' }}>
                        {STATUT_LABEL[activeCampagne.statut] ?? activeCampagne.statut}
                    </span>
                    <button className="campagne-banner-close" onClick={() => { setActiveCampagne(null); setActiveTab('organisation'); }}>
                        <i className="bi bi-x-lg"></i> Changer
                    </button>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                ONGLET 1 — ORGANISATION
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'organisation' && (
                <>
                    <div className="dt-toolbar">
                        <input className="dt-search" placeholder="Rechercher par nom, type ou produit..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                        <button className="dt-btn dt-btn-primary"
                            onClick={() => { setForm(EMPTY_FORM); setFormError(''); setModal('create'); }}>
                            <i className="bi bi-plus-lg"></i> Nouvelle campagne
                        </button>
                        <button className="dt-btn" onClick={fetchAll}>
                            <i className="bi bi-arrow-clockwise"></i> Actualiser
                        </button>
                    </div>

                    <div className="dt-wrapper">
                        <table className="dt-table">
                            <thead>
                                <tr>
                                    <SortableTh label="Nom"     field="nom"       sortKey={sk} sortDir={sd} onSort={ts} />
                                    <SortableTh label="Type"    field="type"      sortKey={sk} sortDir={sd} onSort={ts} />
                                    <SortableTh label="Produit" field="produit"   sortKey={sk} sortDir={sd} onSort={ts} />
                                    <SortableTh label="Période" field="dateDebut" sortKey={sk} sortDir={sd} onSort={ts} />
                                    <th>Districts</th>
                                    <SortableTh label="Statut"  field="statut"    sortKey={sk} sortDir={sd} onSort={ts} />
                                    <th>Progression</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="dt-center">Chargement...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="8" className="dt-center">Aucune campagne trouvée.</td></tr>
                                ) : paged.map(c => (
                                    <tr key={c._id} className={activeCampagne?._id === c._id ? 'row-active' : ''}>
                                        <td><strong>{c.nom}</strong></td>
                                        <td><span className="dt-badge dt-badge-lang">{TYPES_CAMPAGNE.find(t => t.value === c.type)?.label ?? c.type}</span></td>
                                        <td>{c.produit || <span className="dt-muted">—</span>}</td>
                                        <td style={{ fontSize: '0.82rem' }}>
                                            {new Date(c.dateDebut).toLocaleDateString('fr-FR')}
                                            <i className="bi bi-arrow-right" style={{ margin: '0 4px' }}></i>
                                            {new Date(c.dateFin).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{c.districts?.length ?? 0}</td>
                                        <td>
                                            <span className={`dt-badge ${STATUT_BADGE[c.statut] ?? 'dt-badge-inactif'}`}>
                                                {STATUT_LABEL[c.statut] ?? c.statut}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.82rem' }}>
                                            {c.statut === 'brouillon' ? <span className="dt-muted">—</span>
                                                : `${c.nbEnvoyes}/${c.nbCibles}`}
                                            {c.nbEchecs > 0 && <span style={{ color: '#dc2626' }}> ({c.nbEchecs} échecs)</span>}
                                        </td>
                                        <td className="dt-actions">
                                            <button className="dt-btn dt-btn-primary" onClick={() => openCampagne(c)}
                                                title="Ouvrir cette campagne">
                                                <i className="bi bi-folder2-open"></i> Ouvrir
                                            </button>
                                            <button className="dt-btn dt-btn-edit"
                                                onClick={() => { setSelected(c); setForm({ nom: c.nom, type: c.type, produit: c.produit ?? '', dateDebut: c.dateDebut?.slice(0,10) ?? '', dateFin: c.dateFin?.slice(0,10) ?? '', districts: c.districts?.map(d => d._id) ?? [] }); setFormError(''); setModal('edit'); }}
                                                disabled={c.statut === 'en_cours'}>
                                                <i className="bi bi-pencil-fill"></i>
                                            </button>
                                            {(c.statut === 'brouillon' || c.statut === 'annulee') && (
                                                <button className="dt-btn dt-btn-primary"
                                                    onClick={() => handleLancer(c)}
                                                    disabled={launching === c._id}>
                                                    {launching === c._id ? '⏳' : '▶'}
                                                </button>
                                            )}
                                            <button className="dt-btn dt-btn-danger"
                                                onClick={() => { setSelected(c); setFormError(''); setModal('delete'); }}
                                                disabled={c.statut === 'en_cours'}>
                                                <i className="bi bi-trash-fill"></i>
                                            </button>
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
                </>
            )}

            {/* ══════════════════════════════════════════════════════
                ONGLET 2 — MOBILISATION SOCIALE
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'mobilisation' && (
                !activeCampagne ? (
                    <div className="camp-no-selection">
                        <i className="bi bi-folder2-open camp-no-selection-icon"></i>
                        <p>Sélectionnez une campagne dans l'onglet <strong>Organisation</strong></p>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                            Cliquez sur <strong>Ouvrir</strong> sur une campagne pour configurer sa mobilisation sociale.
                        </p>
                        <button className="dt-btn dt-btn-primary" onClick={() => setActiveTab('organisation')}>
                            <i className="bi bi-arrow-left"></i> Aller à Organisation
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ══ Section Relais par District ══ */}
                        {(() => {
                            const mobMap = Object.fromEntries(mobRelais.map(m => [m.district._id, m]));
                            const relaisParDistrict = relais.reduce((acc, r) => {
                                const did = r.district?._id;
                                if (did) acc[did] = (acc[did] ?? 0) + 1;
                                return acc;
                            }, {});
                            // Helpers badge diffusion
                            const DIFF_BADGE = { inactif: 'dt-badge-inactif', en_cours: 'dt-badge-warning', termine: 'dt-badge-actif', erreur: 'dt-badge-danger' };
                            const DIFF_LABEL = { inactif: '—', en_cours: 'En cours…', termine: 'Envoyé', erreur: 'Erreur' };
                            const canDiffuse = rec => rec && rec.messageAudio?.url && rec.relais?.length > 0 && rec.diffusion?.statut !== 'en_cours';
                            const nbDistrictsOk = campDistricts.filter(d => { const r = mobMap[d._id]; return r && r.messageAudio?.url && r.relais?.length > 0; }).length;
                            return (
                                <div className="mob-section">
                                    {/* Messages flash diffusion */}
                                    {diffErrMsg  && <div className="dt-error"  style={{ marginBottom: 8 }}><i className="bi bi-exclamation-triangle-fill"></i> {diffErrMsg}</div>}
                                    {diffSuccMsg && <div className="dt-success" style={{ marginBottom: 8 }}><i className="bi bi-check-lg"></i> {diffSuccMsg}</div>}

                                    {/* Modal erreur diffusion */}
                                    {diffErrModal && (
                                        <div className="modal-overlay" onClick={() => setDiffErrModal(null)}>
                                            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                                                <div className="modal-header" style={{ background: '#fee2e2', borderBottom: '1px solid #fca5a5' }}>
                                                    <h3 style={{ margin: 0, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <i className="bi bi-exclamation-triangle-fill"></i> {diffErrModal.titre}
                                                    </h3>
                                                    <button className="modal-close" onClick={() => setDiffErrModal(null)}>&times;</button>
                                                </div>
                                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    <div style={{ background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', color: '#b91c1c', fontWeight: 500 }}>
                                                        <i className="bi bi-x-circle-fill" style={{ marginRight: 6 }}></i>
                                                        {diffErrModal.message}
                                                    </div>
                                                    {diffErrModal.log && (
                                                        <div>
                                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                <i className="bi bi-terminal-fill" style={{ marginRight: 4 }}></i>Journal d'erreurs
                                                            </div>
                                                            <pre style={{ margin: 0, background: '#1e1e2e', color: '#f8f8f2', borderRadius: 6, padding: '10px 14px', fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260 }}>
                                                                {diffErrModal.log}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="modal-footer">
                                                    <button className="dt-btn dt-btn-secondary" onClick={() => setDiffErrModal(null)}>Fermer</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mob-section-header">
                                        <h3 className="mob-section-title">
                                            <i className="bi bi-geo-alt-fill"></i> Relais par District
                                        </h3>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="dt-btn dt-btn-primary"
                                                onClick={handleDiffuserTout}
                                                disabled={diffusing || nbDistrictsOk === 0}
                                                title={nbDistrictsOk === 0 ? 'Configurez au moins un district avec audio + relais' : `Diffuser vers ${nbDistrictsOk} district(s)`}>
                                                <i className={`bi ${diffusing ? 'bi-hourglass-split' : 'bi-broadcast'}`}></i>
                                                {diffusing ? 'Envoi…' : 'Tout diffuser'}
                                            </button>
                                            <button className="dt-btn" onClick={loadMobilisationData}>
                                                <i className="bi bi-arrow-clockwise"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="dt-toolbar" style={{ marginBottom: 8 }}>
                                        <input className="dt-search" placeholder="Rechercher un district..."
                                            value={searchDistrict} onChange={e => setSearchDistrict(e.target.value)} />
                                    </div>
                                    {campDistricts.length === 0 ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>
                                            Aucun district associé à cette campagne.
                                        </p>
                                    ) : (
                                        <div className="dt-wrapper">
                                            <table className="dt-table">
                                                <thead>
                                                    <tr>
                                                        <th>District</th>
                                                        <th style={{ textAlign: 'center' }}>Nb relais <i className="bi bi-calculator" style={{ fontSize: '0.75rem', color: '#94a3b8' }} title="Calculé automatiquement"></i></th>
                                                        <th style={{ textAlign: 'center' }}>Concessions</th>
                                                        <th style={{ textAlign: 'center' }}>Personnes</th>
                                                        <th>Message audio</th>
                                                        <th style={{ textAlign: 'center' }}>Diffusion</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loadingMobRelais ? (
                                                        <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                                                    ) : filtDistricts.length === 0 ? (
                                                        <tr><td colSpan="7" className="dt-center">Aucun district trouvé.</td></tr>
                                                    ) : pagedDistricts.map(d => {
                                                        const rec    = mobMap[d._id];
                                                        const nbRel  = relaisParDistrict[d._id] ?? 0;
                                                        const diff   = rec?.diffusion;
                                                        const statut = diff?.statut ?? 'inactif';
                                                        return (
                                                            <tr key={d._id}>
                                                                <td><strong>{d.nom}</strong></td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span className={`dt-badge ${nbRel > 0 ? 'dt-badge-actif' : 'dt-badge-inactif'}`}>{nbRel}</span>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {rec ? rec.concessionsVisitees : <span className="dt-muted">—</span>}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {rec ? rec.personnesTouchees : <span className="dt-muted">—</span>}
                                                                </td>
                                                                <td style={{ fontSize: '0.82rem' }}>
                                                                    {rec?.messageAudio?.nom
                                                                        ? <><i className="bi bi-file-music-fill" style={{ marginRight: 4, color: '#0a7c4e' }}></i>{rec.messageAudio.nom}</>
                                                                        : <span className="dt-muted">—</span>}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {!rec ? <span className="dt-muted">—</span> : (
                                                                        <div>
                                                                            <span className={`dt-badge ${DIFF_BADGE[statut]}`}>
                                                                                {statut === 'en_cours' && <i className="bi bi-arrow-repeat" style={{ marginRight: 3 }}></i>}
                                                                                {DIFF_LABEL[statut]}
                                                                            </span>
                                                                            {(statut === 'termine' || statut === 'en_cours') && diff.total > 0 && (
                                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                                                                                    {diff.envoyes}/{diff.total}
                                                                                    {diff.echecs > 0 && <span style={{ color: '#dc2626' }}> · {diff.echecs} échec{diff.echecs > 1 ? 's' : ''}</span>}
                                                                                </div>
                                                                            )}
                                                                            {diff.dateEnvoi && (
                                                                                <div style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
                                                                                    {new Date(diff.dateEnvoi).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                                        <button className="dt-btn dt-btn-primary"
                                                                            onClick={() => openViewMobRelais(d, rec)} title="Voir">
                                                                            <i className="bi bi-eye-fill"></i>
                                                                        </button>
                                                                        <button className="dt-btn dt-btn-edit"
                                                                            onClick={() => openEditMobRelais(d, rec)} title="Modifier">
                                                                            <i className="bi bi-pencil-fill"></i>
                                                                        </button>
                                                                        <button
                                                                            className={`dt-btn ${canDiffuse(rec) ? 'dt-btn-primary' : ''}`}
                                                                            onClick={() => canDiffuse(rec) && handleDiffuser(rec)}
                                                                            disabled={!canDiffuse(rec)}
                                                                            title={!rec ? 'Configurez ce district d\'abord' : !rec.messageAudio?.url ? 'Aucun audio' : !rec.relais?.length ? 'Aucun relais assigné' : statut === 'en_cours' ? 'Envoi en cours' : 'Diffuser l\'audio WhatsApp'}>
                                                                            <i className={`bi ${statut === 'en_cours' ? 'bi-hourglass-split' : 'bi-broadcast'}`}></i>
                                                                        </button>
                                                                        {rec && (
                                                                            <button className="dt-btn dt-btn-danger"
                                                                                onClick={() => setConfirmMobRelais(rec._id)} title="Supprimer">
                                                                                <i className="bi bi-trash-fill"></i>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="dt-footer">
                                        <span>{filtDistricts.length} district{filtDistricts.length !== 1 ? 's' : ''}{searchDistrict ? ` sur ${campDistricts.length}` : ''}</span>
                                        <Pagination page={pageDistr} totalPages={totalDistr} onChange={setPageDistr} />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Section Relais Communautaires ── */}
                        <div className="mob-section">
                            <div className="mob-section-header">
                                <h3 className="mob-section-title">
                                    <i className="bi bi-person-walking"></i> Relais Communautaires
                                </h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="dt-btn dt-btn-primary" onClick={openCreateRelais}>
                                        <i className="bi bi-plus-lg"></i> Ajouter
                                    </button>
                                    <button className="dt-btn" onClick={loadMobilisationData}>
                                        <i className="bi bi-arrow-clockwise"></i>
                                    </button>
                                </div>
                            </div>
                            <div className="dt-toolbar" style={{ marginBottom: 8 }}>
                                <input className="dt-search" placeholder="Rechercher par nom, téléphone, type, district..."
                                    value={searchRelaisComm} onChange={e => setSearchRelaisComm(e.target.value)} />
                            </div>
                            <div className="dt-wrapper">
                                <table className="dt-table">
                                    <thead>
                                        <tr>
                                            <th>Nom</th>
                                            <th>Téléphone</th>
                                            <th>Type</th>
                                            <th>District</th>
                                            <th>Structure</th>
                                            <th>Exp.</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingMob ? (
                                            <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                                        ) : filtRelaisComm.length === 0 ? (
                                            <tr><td colSpan="7" className="dt-center">Aucun relais trouvé.</td></tr>
                                        ) : pagedRelaisComm.map(r => (
                                            <tr key={r._id}>
                                                <td><strong>{r.nom}</strong></td>
                                                <td style={{ fontSize: '0.83rem' }}>{r.telephone || <span className="dt-muted">—</span>}</td>
                                                <td><span className={`dt-badge ${TYPE_COLOR_R[r.typeRelais] ?? 'dt-badge-inactif'}`}>{r.typeRelais}</span></td>
                                                <td>{r.district?.nom ?? <span className="dt-muted">—</span>}</td>
                                                <td>{r.structureSanitaire?.nom ?? <span className="dt-muted">—</span>}</td>
                                                <td style={{ textAlign: 'center' }}>{r.nbreAnneesExperience ?? 0}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="dt-btn dt-btn-edit" onClick={() => openEditRelais(r)}><i className="bi bi-pencil-fill"></i></button>
                                                        <button className="dt-btn dt-btn-danger" onClick={() => setConfirmRelais(r._id)}><i className="bi bi-trash-fill"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="dt-footer">
                                <span>{filtRelaisComm.length} relais{searchRelaisComm ? ` sur ${relais.length}` : ''}</span>
                                <Pagination page={pageRelais} totalPages={totalRelais} onChange={setPageRelais} />
                            </div>
                        </div>

                        {/* ── Section Réunions / Plaidoyers ── */}
                        <div className="mob-section">
                            <div className="mob-section-header">
                                <h3 className="mob-section-title">
                                    <i className="bi bi-mic-fill"></i> Réunions &amp; Plaidoyers
                                </h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="dt-btn dt-btn-primary" onClick={openCreateReunion}>
                                        <i className="bi bi-plus-lg"></i> Ajouter
                                    </button>
                                    <button className="dt-btn" onClick={loadMobilisationData}>
                                        <i className="bi bi-arrow-clockwise"></i>
                                    </button>
                                </div>
                            </div>
                            <div className="dt-toolbar" style={{ marginBottom: 8 }}>
                                <input className="dt-search" placeholder="Rechercher par nom, type, district, lieu..."
                                    value={searchReunion} onChange={e => setSearchReunion(e.target.value)} />
                            </div>
                            <div className="dt-wrapper">
                                <table className="dt-table">
                                    <thead>
                                        <tr>
                                            <th>Nom</th>
                                            <th>Type</th>
                                            <th>Date</th>
                                            <th>Lieu</th>
                                            <th>District</th>
                                            <th>Participants</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingReu ? (
                                            <tr><td colSpan="7" className="dt-center">Chargement...</td></tr>
                                        ) : filtReunions.length === 0 ? (
                                            <tr><td colSpan="7" className="dt-center">Aucune réunion / plaidoyer trouvé.</td></tr>
                                        ) : pagedReunions.map(r => (
                                            <tr key={r._id}>
                                                <td><strong>{r.nom}</strong></td>
                                                <td>
                                                    <span className={`dt-badge ${r.type === 'Réunion' ? 'dt-badge-actif' : 'dt-badge-warning'}`}>
                                                        {r.type}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.82rem' }}>
                                                    {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : <span className="dt-muted">—</span>}
                                                </td>
                                                <td>{r.lieu || <span className="dt-muted">—</span>}</td>
                                                <td>{r.district?.nom ?? <span className="dt-muted">—</span>}</td>
                                                <td style={{ textAlign: 'center' }}>{r.nbParticipants ?? 0}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="dt-btn dt-btn-edit" onClick={() => openEditReunion(r)}><i className="bi bi-pencil-fill"></i></button>
                                                        <button className="dt-btn dt-btn-danger" onClick={() => setConfirmReunion(r._id)}><i className="bi bi-trash-fill"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="dt-footer">
                                <span>{filtReunions.length} réunion{filtReunions.length !== 1 ? 's' : ''} / plaidoyer{filtReunions.length !== 1 ? 's' : ''}{searchReunion ? ` sur ${reunions.length}` : ''}</span>
                                <Pagination page={pageReunion} totalPages={totalReunion} onChange={setPageReunion} />
                            </div>
                        </div>

                        {/* ── Section Templates WhatsApp ── */}
                        <div className="mob-section">
                            <div className="mob-section-header">
                                <h3 className="mob-section-title">
                                    <i className="bi bi-whatsapp" style={{ color: '#25d366' }}></i> Templates WhatsApp Meta
                                </h3>
                                <button className="dt-btn dt-btn-primary" onClick={openAddTpl}>
                                    <i className="bi bi-plus-lg"></i> Ajouter
                                </button>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 10 }}>
                                Ces templates sont utilisés lors de la diffusion audio pour ouvrir la fenêtre 24h WhatsApp. Ils doivent exister et être approuvés dans votre <strong>Meta Business Manager</strong>.
                            </p>
                            <div style={{ marginBottom: 8 }}>
                                <input className="dt-search" placeholder="Rechercher un template..."
                                    value={searchTpl} onChange={e => setSearchTpl(e.target.value)} />
                            </div>
                            <div className="dt-wrapper">
                                <table className="dt-table">
                                    <thead>
                                        <tr>
                                            <th>Nom affiché</th>
                                            <th>Nom Meta (exact)</th>
                                            <th>Langue</th>
                                            <th>Header</th>
                                            <th>Variables</th>
                                            <th>Description</th>
                                            <th>Statut</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {templates.filter(t =>
                                            !searchTpl || t.nom.toLowerCase().includes(searchTpl.toLowerCase()) ||
                                            t.templateName.toLowerCase().includes(searchTpl.toLowerCase())
                                        ).map(t => (
                                            <tr key={t._id}>
                                                <td><strong>{t.nom}</strong></td>
                                                <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>{t.templateName}</code></td>
                                                <td><span className="dt-badge dt-badge-lang">{t.langue}</span></td>
                                                <td><TplTypeBadge type={t.typeContenu} /></td>
                                                <td style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                                                    {(t.variablesCorps ?? 0) > 0
                                                        ? <span className="dt-badge dt-badge-code">{t.variablesCorps} corps</span>
                                                        : '—'}
                                                    {(t.variablesEntete ?? 0) > 0 && (
                                                        <span className="dt-badge dt-badge-code" style={{ marginLeft: 4 }}>{t.variablesEntete} entête</span>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{t.description || '—'}</td>
                                                <td>
                                                    <span className={`dt-badge ${t.statut === 'actif' ? 'dt-badge-actif' : 'dt-badge-inactif'}`}>
                                                        {t.statut === 'actif' ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="dt-btn dt-btn-edit" onClick={() => openEditTpl(t)} title="Modifier">
                                                            <i className="bi bi-pencil-fill"></i>
                                                        </button>
                                                        <button className="dt-btn dt-btn-danger" onClick={() => setConfirmTpl(t)} title="Supprimer">
                                                            <i className="bi bi-trash-fill"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {templates.length === 0 && (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>
                                                Aucun template configuré. Ajoutez-en un pour personnaliser la diffusion.
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )
            )}

            {/* ══════════════════════════════════════════════════════
                ONGLET 3 — SPOTS
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'spots' && (
                !activeCampagne ? (
                    <div className="camp-no-selection">
                        <i className="bi bi-megaphone-fill camp-no-selection-icon"></i>
                        <p>Sélectionnez une campagne pour gérer ses spots.</p>
                        <button className="dt-btn dt-btn-primary" onClick={() => setActiveTab('organisation')}>
                            <i className="bi bi-arrow-left"></i> Aller à Organisation
                        </button>
                    </div>
                ) : (
                    <div className="camp-placeholder">
                        <i className="bi bi-megaphone-fill camp-placeholder-icon"></i>
                        <h3>Spots — <span style={{ color: '#0a7c4e' }}>{activeCampagne.nom}</span></h3>
                        <p>Fonctionnalité à venir — gestion des spots radio et audiovisuels.</p>
                    </div>
                )
            )}

            {/* ══════════════════════════════════════════════════════
                ONGLET 4 — VALIDATION CAMPAGNE
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'validation' && (
                !activeCampagne ? (
                    <div className="camp-no-selection">
                        <i className="bi bi-patch-check-fill camp-no-selection-icon"></i>
                        <p>Sélectionnez une campagne pour accéder à sa validation.</p>
                        <button className="dt-btn dt-btn-primary" onClick={() => setActiveTab('organisation')}>
                            <i className="bi bi-arrow-left"></i> Aller à Organisation
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Résumé de la campagne */}
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: 14 }}>
                                <i className="bi bi-info-circle-fill" style={{ marginRight: 8, color: '#0a7c4e' }}></i>
                                Résumé — {activeCampagne.nom}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                {[
                                    { label: 'Type', value: activeCampagne.type },
                                    { label: 'Produit', value: activeCampagne.produit || '—' },
                                    { label: 'Début', value: new Date(activeCampagne.dateDebut).toLocaleDateString('fr-FR') },
                                    { label: 'Fin',   value: new Date(activeCampagne.dateFin).toLocaleDateString('fr-FR') },
                                    { label: 'Districts', value: activeCampagne.districts?.length ?? 0 },
                                    { label: 'Statut', value: activeCampagne.statut },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>{label}</div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Checklist de validation */}
                        {(() => {
                            const mobMap = Object.fromEntries(mobRelais.map(m => [m.district._id, m]));
                            const campDist = activeCampagne.districts ?? [];
                            const distConfigures  = campDist.filter(d => mobMap[d._id]).length;
                            const distAvecAudio   = campDist.filter(d => mobMap[d._id]?.messageAudio?.url).length;
                            const totalRelaisAss  = relais.length;
                            const totalConcessions = mobRelais.reduce((s, m) => s + (m.concessionsVisitees ?? 0), 0);
                            const totalTouches     = mobRelais.reduce((s, m) => s + (m.personnesTouchees   ?? 0), 0);

                            const checks = [
                                { label: 'Districts configurés',             ok: distConfigures === campDist.length && campDist.length > 0, detail: `${distConfigures} / ${campDist.length}` },
                                { label: 'Messages audio enregistrés',       ok: distAvecAudio  === campDist.length && campDist.length > 0, detail: `${distAvecAudio} / ${campDist.length}` },
                                { label: 'Relais assignés',                  ok: totalRelaisAss > 0,     detail: `${totalRelaisAss} relais` },
                                { label: 'Concessions visitées renseignées', ok: totalConcessions > 0,  detail: totalConcessions },
                                { label: 'Personnes touchées renseignées',   ok: totalTouches > 0,      detail: totalTouches },
                                { label: 'Réunions / plaidoyers planifiés',  ok: reunions.length > 0,   detail: `${reunions.length} réunion${reunions.length !== 1 ? 's' : ''}` },
                            ];
                            const score = checks.filter(c => c.ok).length;

                            return (
                                <>
                                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', margin: 0 }}>
                                                <i className="bi bi-clipboard2-check-fill" style={{ marginRight: 8, color: '#0a7c4e' }}></i>
                                                Checklist de validation
                                            </h3>
                                            <span style={{
                                                background: score === checks.length ? '#dcfce7' : score >= checks.length / 2 ? '#fef9c3' : '#fee2e2',
                                                color:      score === checks.length ? '#15803d' : score >= checks.length / 2 ? '#92400e' : '#b91c1c',
                                                fontWeight: 700, fontSize: '0.88rem', padding: '4px 12px', borderRadius: 20,
                                            }}>
                                                {score} / {checks.length}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {checks.map(c => (
                                                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#fff', border: `1px solid ${c.ok ? '#bbf7d0' : '#fecaca'}` }}>
                                                    <i className={`bi ${c.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}
                                                        style={{ color: c.ok ? '#16a34a' : '#dc2626', fontSize: '1.1rem', flexShrink: 0 }}></i>
                                                    <span style={{ flex: 1, fontSize: '0.88rem', color: '#334155' }}>{c.label}</span>
                                                    <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>{c.detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Totaux mobilisation */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                                        {[
                                            { label: 'Total relais assignés',     value: totalRelaisAss,  icon: 'bi-person-walking',  color: '#0a7c4e' },
                                            { label: 'Concessions visitées',      value: totalConcessions, icon: 'bi-house-fill',      color: '#0369a1' },
                                            { label: 'Personnes touchées',        value: totalTouches,     icon: 'bi-people-fill',     color: '#7c3aed' },
                                            { label: 'Réunions / plaidoyers',     value: reunions.length,  icon: 'bi-mic-fill',        color: '#b45309' },
                                        ].map(({ label, value, icon, color }) => (
                                            <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                <i className={`bi ${icon}`} style={{ fontSize: '1.4rem', color, marginBottom: 6, display: 'block' }}></i>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{value}</div>
                                                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )
            )}

            {/* ══════════════════════════════════════════════════════
                ONGLET 5 — RAPPORTS
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'rapports' && (
                <div className="camp-placeholder">
                    <i className="bi bi-bar-chart-fill camp-placeholder-icon"></i>
                    <h3>Rapports</h3>
                    <p>Fonctionnalité à venir — synthèse et export des rapports de campagnes.</p>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODALS — CAMPAGNES
            ══════════════════════════════════════════════════════ */}
            {(modal === 'create' || modal === 'edit') && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 680 }}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Nouvelle campagne' : 'Modifier la campagne'}</h2>
                            <button className="modal-close" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleCampagneSubmit} className="modal-form">
                            {formError && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formError}</div>}

                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 12, color: '#475569' }}>Informations générales</p>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nom <span className="req">*</span></label>
                                        <input value={form.nom} onChange={e => setField('nom', e.target.value)} placeholder="Ex : JNV Avril 2025" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Type <span className="req">*</span></label>
                                        <select value={form.type} onChange={e => setField('type', e.target.value)}>
                                            {TYPES_CAMPAGNE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Produit</label>
                                        <input value={form.produit} onChange={e => setField('produit', e.target.value)} placeholder="Ex : VPO, Pentavalent..." />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Date de début <span className="req">*</span></label>
                                        <input type="date" value={form.dateDebut} onChange={e => setField('dateDebut', e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Date de fin <span className="req">*</span></label>
                                        <input type="date" value={form.dateFin} onChange={e => setField('dateFin', e.target.value)} required />
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0, color: '#475569' }}>
                                        Districts <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.districts.length} sélectionné{form.districts.length !== 1 ? 's' : ''})</span>
                                    </p>
                                    <button type="button" className="dt-btn" style={{ fontSize: '0.78rem', padding: '3px 10px' }}
                                        onClick={toggleAllDistricts}>
                                        {districts.every(d => form.districts.includes(d._id)) ? 'Aucun' : 'Tout'}
                                    </button>
                                </div>
                                <input
                                    className="dt-search"
                                    placeholder="Rechercher un district..."
                                    value={districtSearch}
                                    onChange={e => setDistrictSearch(e.target.value)}
                                    style={{ marginBottom: 8, width: '100%', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px', maxHeight: 180, overflowY: 'auto' }}>
                                    {districts
                                        .filter(d => d.nom.toLowerCase().includes(districtSearch.toLowerCase()))
                                        .map(d => (
                                            <label key={d._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={form.districts.includes(d._id)} onChange={() => toggleDistrict(d._id)} />
                                                {d.nom}
                                            </label>
                                        ))}
                                </div>
                                {form.districts.length === 0 && (
                                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 6 }}>Aucun district = tous les contacts</p>
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

            {modal === 'delete' && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer la campagne</h2>
                            <button className="modal-close" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            {formError && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {formError}</div>}
                            <p>Supprimer <strong>{selected?.nom}</strong> ?</p>
                            <p style={{ color: '#dc2626', fontSize: '0.88rem', marginTop: 8 }}>Cette action est irréversible.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={closeModal}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={handleCampagneDelete} disabled={saving}>
                                {saving ? 'Suppression...' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODALS — RELAIS
            ══════════════════════════════════════════════════════ */}
            {relaisModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>{editingRelais ? 'Modifier le relais' : 'Nouveau relais communautaire'}</h2>
                            <button className="modal-close" onClick={() => setRelaisModal(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleRelaisSubmit} className="modal-form">
                            {relaisErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {relaisErr}</div>}
                            <div className="form-group">
                                <label>Nom complet <span className="req">*</span></label>
                                <input placeholder="Ex: Aminatou Moussa" value={relaisForm.nom}
                                    onChange={e => setRelaisForm(f => ({ ...f, nom: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label>Téléphone</label>
                                <input placeholder="Ex: 22790000000" value={relaisForm.telephone}
                                    onChange={e => setRelaisForm(f => ({ ...f, telephone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select value={relaisForm.typeRelais} onChange={e => setRelaisForm(f => ({ ...f, typeRelais: e.target.value }))}>
                                    {TYPES_RELAIS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>District</label>
                                <select value={relaisForm.districtId} onChange={e => setRelaisForm(f => ({ ...f, districtId: e.target.value }))}>
                                    <option value="">-- Aucun --</option>
                                    {districts.map(d => <option key={d._id} value={d._id}>{d.nom}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Structure sanitaire</label>
                                <select value={relaisForm.structureSanitaireId} onChange={e => setRelaisForm(f => ({ ...f, structureSanitaireId: e.target.value }))}>
                                    <option value="">-- Aucune --</option>
                                    {structures.map(s => <option key={s._id} value={s._id}>{s.nom}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Années d'expérience</label>
                                <input type="number" min="0" max="50" value={relaisForm.nbreAnneesExperience}
                                    onChange={e => setRelaisForm(f => ({ ...f, nbreAnneesExperience: e.target.value }))} />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setRelaisModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={savingRelais}>
                                    {savingRelais ? 'Enregistrement...' : editingRelais ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmRelais && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer le relais</h2>
                            <button className="modal-close" onClick={() => setConfirmRelais(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Confirmer la suppression de ce relais ?</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmRelais(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleRelaisDelete(confirmRelais)}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODALS — RÉUNIONS / PLAIDOYERS
            ══════════════════════════════════════════════════════ */}
         {/*    {reunionModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2>{editingReunion ? 'Modifier' : 'Nouvelle réunion / plaidoyer'}</h2>
                            <button className="modal-close" onClick={() => setReunionModal(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleReunionSubmit} className="modal-form">
                            {reunionErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {reunionErr}</div>}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Intitulé <span className="req">*</span></label>
                                    <input placeholder="Ex: Réunion communautaire Dosso" value={reunionForm.nom}
                                        onChange={e => setReunionForm(f => ({ ...f, nom: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label>Type</label>
                                    <select value={reunionForm.type} onChange={e => setReunionForm(f => ({ ...f, type: e.target.value }))}>
                                        {TYPES_REUNION.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input type="date" value={reunionForm.date}
                                        onChange={e => setReunionForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Lieu</label>
                                    <input placeholder="Ex: Salle de mairie de Dosso" value={reunionForm.lieu}
                                        onChange={e => setReunionForm(f => ({ ...f, lieu: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>District</label>
                                    <select value={reunionForm.districtId} onChange={e => setReunionForm(f => ({ ...f, districtId: e.target.value }))}>
                                        <option value="">-- Aucun --</option>
                                        {districts.map(d => <option key={d._id} value={d._id}>{d.nom}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Nb participants</label>
                                    <input type="number" min="0" value={reunionForm.nbParticipants}
                                        onChange={e => setReunionForm(f => ({ ...f, nbParticipants: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea rows="2" placeholder="Objectifs, ordre du jour..." value={reunionForm.description}
                                    onChange={e => setReunionForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ resize: 'vertical', padding: '10px 13px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.9rem', width: '100%' }} />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setReunionModal(false)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={savingReunion}>
                                    {savingReunion ? 'Enregistrement...' : editingReunion ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
 */}
            {confirmReunion && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer</h2>
                            <button className="modal-close" onClick={() => setConfirmReunion(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Confirmer la suppression de cette réunion / plaidoyer ?</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmReunion(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleReunionDelete(confirmReunion)}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODALS — MOBILISATION RELAIS PAR DISTRICT
            ══════════════════════════════════════════════════════ */}

            {/* ── Modal Voir ── */}
            {mobRelaisModal === 'view' && mobRelaisDistrict && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h2><i className="bi bi-geo-alt-fill"></i> {mobRelaisDistrict.nom}</h2>
                            <button className="modal-close" onClick={() => setMobRelaisModal(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px' }}>
                            {!mobRelaisRecord ? (
                                <p style={{ color: '#94a3b8' }}>Aucune donnée enregistrée pour ce district.</p>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a7c4e' }}>{mobRelaisRecord.relais?.length ?? 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Relais assignés</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a7c4e' }}>{mobRelaisRecord.concessionsVisitees}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Concessions visitées</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a7c4e' }}>{mobRelaisRecord.personnesTouchees}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Personnes touchées</div>
                                        </div>
                                        <div style={{ background: '#fefce8', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                                            {mobRelaisRecord.messageAudio?.url ? (
                                                <>
                                                    <audio controls src={mobRelaisRecord.messageAudio.url}
                                                        style={{ width: '100%', height: 36 }} />
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                                        {mobRelaisRecord.messageAudio.nom}
                                                    </div>
                                                </>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucun message audio</span>
                                            )}
                                        </div>
                                    </div>
                                    {mobRelaisRecord.relais?.length > 0 && (
                                        <>
                                            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#475569', marginBottom: 8 }}>
                                                Relais assignés
                                            </p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {mobRelaisRecord.relais.map(r => (
                                                    <span key={r._id} className="dt-badge dt-badge-lang" style={{ fontSize: '0.8rem' }}>
                                                        {r.nom}{r.telephone ? ` · ${r.telephone}` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setMobRelaisModal(null)}>Fermer</button>
                            <button className="dt-btn dt-btn-edit"
                                onClick={() => openEditMobRelais(mobRelaisDistrict, mobRelaisRecord)}>
                                <i className="bi bi-pencil-fill"></i> Modifier
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Modifier / Créer ── */}
            {mobRelaisModal === 'edit' && mobRelaisDistrict && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h2>{mobRelaisRecord ? 'Modifier' : 'Configurer'} — {mobRelaisDistrict.nom}</h2>
                            <button className="modal-close" onClick={() => setMobRelaisModal(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleMobRelaisSubmit} className="modal-form">
                            {mobRelaisErr && <div className="modal-error"><i className="bi bi-exclamation-triangle-fill"></i> {mobRelaisErr}</div>}

                            {/* Sélection des relais du district */}
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: '#475569' }}>
                                    Relais <span style={{ color: '#94a3b8', fontWeight: 400 }}>({mobRelaisForm.relaisIds.length} sélectionné{mobRelaisForm.relaisIds.length !== 1 ? 's' : ''})</span>
                                </p>
                                {(() => {
                                    const distRelais = relais.filter(r => r.district?._id === mobRelaisDistrict._id);
                                    return distRelais.length === 0 ? (
                                        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Aucun relais enregistré pour ce district.</p>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', maxHeight: 160, overflowY: 'auto' }}>
                                            {distRelais.map(r => (
                                                <label key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', cursor: 'pointer' }}>
                                                    <input type="checkbox"
                                                        checked={mobRelaisForm.relaisIds.includes(r._id)}
                                                        onChange={() => toggleMobRelais(r._id)} />
                                                    {r.nom}{r.telephone ? ` (${r.telephone})` : ''}
                                                </label>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Concessions visitées</label>
                                    <input type="number" min="0"
                                        value={mobRelaisForm.concessionsVisitees}
                                        onChange={e => setMobRelaisForm(f => ({ ...f, concessionsVisitees: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Personnes touchées</label>
                                    <input type="number" min="0"
                                        value={mobRelaisForm.personnesTouchees}
                                        onChange={e => setMobRelaisForm(f => ({ ...f, personnesTouchees: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Message audio</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <button type="button" className="dt-btn"
                                        onClick={() => audioInputRef.current?.click()}
                                        disabled={uploadingAudio}>
                                        <i className="bi bi-upload"></i> {uploadingAudio ? 'Envoi...' : 'Choisir fichier'}
                                    </button>
                                    <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
                                        onChange={handleAudioUpload} />
                                    {mobRelaisForm.messageAudio?.nom && (
                                        <span style={{ fontSize: '0.83rem', color: '#0a7c4e' }}>
                                            <i className="bi bi-file-music-fill"></i> {mobRelaisForm.messageAudio.nom}
                                        </span>
                                    )}
                                </div>
                                {mobRelaisForm.messageAudio?.url && (
                                    <audio controls src={mobRelaisForm.messageAudio.url}
                                        style={{ width: '100%', marginTop: 8, height: 36 }} />
                                )}
                            </div>

                            {/* Sélecteur de template WhatsApp */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <i className="bi bi-whatsapp" style={{ color: '#25d366' }}></i> Template WhatsApp
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>(optionnel — fallback sur .env si vide)</span>
                                </label>
                                <select className="form-control"
                                    value={mobRelaisForm.templateId}
                                    onChange={e => setMobRelaisForm(f => ({ ...f, templateId: e.target.value }))}>
                                    <option value="">— Utiliser le template par défaut ({import.meta.env.VITE_DEFAULT_TEMPLATE || 'hello_world'}) —</option>
                                    {templates.filter(t => t.statut === 'actif').map(t => (
                                        <option key={t._id} value={t._id}>
                                            {t.nom} — {t.templateName} [{t.langue}]
                                        </option>
                                    ))}
                                </select>
                                {mobRelaisForm.templateId && (() => {
                                    const tpl = templates.find(t => t._id === mobRelaisForm.templateId);
                                    return tpl ? (
                                        <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#0369a1', background: '#e0f2fe', borderRadius: 5, padding: '5px 10px' }}>
                                            <i className="bi bi-info-circle-fill"></i> <strong>{tpl.templateName}</strong> · langue : <strong>{tpl.langue}</strong>
                                            {tpl.description && <span> · {tpl.description}</span>}
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={() => setMobRelaisModal(null)}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={savingMobRelais}>
                                    {savingMobRelais ? 'Enregistrement...' : mobRelaisRecord ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Template WhatsApp Ajouter / Modifier ── */}
            {tplModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 540 }}>
                        <div className="modal-header">
                            <h2><i className="bi bi-whatsapp" style={{ color: '#25d366', marginRight: 6 }}></i>{tplModal === 'add' ? 'Ajouter un template' : 'Modifier le template'}</h2>
                            <button className="modal-close" onClick={closeTplModal}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSaveTpl}>
                            <div className="modal-body">
                                {tplErr && <div className="dt-error" style={{ marginBottom: 12 }}><i className="bi bi-exclamation-triangle-fill"></i> {tplErr}</div>}

                                {/* Identification */}
                                <div className="form-group">
                                    <label>Nom affiché <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input className="form-control" placeholder="Ex : Template audio relais"
                                        value={tplForm.nom} onChange={e => setTplForm(f => ({ ...f, nom: e.target.value }))} />
                                    <small className="form-hint">Label visible dans le dashboard uniquement</small>
                                </div>

                                <div className="form-group">
                                    <label>Nom exact Meta <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input className="form-control" placeholder="Ex : hello_world"
                                        value={tplForm.templateName} onChange={e => setTplForm(f => ({ ...f, templateName: e.target.value }))} />
                                    <small className="form-hint">Nom tel qu'il apparaît dans Meta Business Manager → Templates</small>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>Code langue</label>
                                        <input className="form-control" placeholder="fr, en_US, ha"
                                            value={tplForm.langue} onChange={e => setTplForm(f => ({ ...f, langue: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>Statut</label>
                                        <select className="form-control" value={tplForm.statut} onChange={e => setTplForm(f => ({ ...f, statut: e.target.value }))}>
                                            <option value="actif">Actif</option>
                                            <option value="inactif">Inactif</option>
                                        </select>
                                    </div>
                                </div>

                                {/* ── Section : contenu du template Meta ── */}
                                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 14 }}>
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <i className="bi bi-layout-text-sidebar-reverse" style={{ color: '#6366f1' }}></i>
                                        Composants du template Meta
                                    </p>

                                    {/* Type de contenu : sélecteur visuel */}
                                    <div className="form-group" style={{ marginBottom: 10 }}>
                                        <label>Type de header</label>
                                        <div className="tpl-type-grid">
                                            {[
                                                { value: 'aucun',    icon: 'bi-slash-circle',       label: 'Aucun',     color: '#6b7280', bg: '#f9fafb' },
                                                { value: 'texte',    icon: 'bi-fonts',               label: 'Texte',     color: '#7c3aed', bg: '#ede9fe' },
                                                { value: 'image',    icon: 'bi-image-fill',          label: 'Image',     color: '#0369a1', bg: '#e0f2fe' },
                                                { value: 'document', icon: 'bi-file-earmark-pdf-fill', label: 'Document', color: '#b45309', bg: '#fef3c7' },
                                                { value: 'audio',    icon: 'bi-mic-fill',            label: 'Audio',     color: '#15803d', bg: '#dcfce7' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`tpl-type-btn${tplForm.typeContenu === opt.value ? ' tpl-type-btn-active' : ''}`}
                                                    style={tplForm.typeContenu === opt.value ? { background: opt.bg, borderColor: opt.color, color: opt.color } : {}}
                                                    onClick={() => setTplForm(f => ({ ...f, typeContenu: opt.value }))}
                                                >
                                                    <i className={`bi ${opt.icon}`}></i>
                                                    <span>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Hint contextuel selon le type */}
                                    {tplForm.typeContenu === 'audio' && (
                                        <div className="tpl-hint tpl-hint-green">
                                            <i className="bi bi-info-circle-fill"></i>
                                            <span>Le template ouvre la fenêtre de conversation, puis l'audio est envoyé en message séparé.</span>
                                        </div>
                                    )}
                                    {tplForm.typeContenu === 'image' && (
                                        <div className="tpl-hint tpl-hint-blue">
                                            <i className="bi bi-info-circle-fill"></i>
                                            <span>Le header du template est une <strong>IMAGE</strong>. Une URL d'image sera requise comme paramètre <code>header</code> lors de la diffusion.</span>
                                        </div>
                                    )}
                                    {tplForm.typeContenu === 'document' && (
                                        <div className="tpl-hint tpl-hint-orange">
                                            <i className="bi bi-info-circle-fill"></i>
                                            <span>Le header du template est un <strong>DOCUMENT</strong> (PDF). Une URL de document sera requise comme paramètre <code>header</code> lors de la diffusion.</span>
                                        </div>
                                    )}
                                    {tplForm.typeContenu === 'texte' && (
                                        <div className="tpl-hint tpl-hint-purple">
                                            <i className="bi bi-info-circle-fill"></i>
                                            <span>Le header est du <strong>TEXTE</strong>. Si le header contient une variable <code>{'{{1}}'}</code>, indiquez ci-dessous le nombre de variables.</span>
                                        </div>
                                    )}
                                    {tplForm.typeContenu === 'aucun' && (
                                        <div className="tpl-hint tpl-hint-gray">
                                            <i className="bi bi-info-circle-fill"></i>
                                            <span>Pas de header. Le template contient uniquement un corps texte.</span>
                                        </div>
                                    )}

                                    {/* Variables header (texte seulement) + corps */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                                        {tplForm.typeContenu === 'texte' && (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.82rem' }}>Variables header <code style={{ fontSize: '0.75rem' }}>{'{{n}}'}</code></label>
                                                <input type="number" min="0" max="1" className="form-control"
                                                    value={tplForm.variablesEntete}
                                                    onChange={e => setTplForm(f => ({ ...f, variablesEntete: Math.max(0, Math.min(1, +e.target.value)) }))} />
                                                <small className="form-hint">0 ou 1 variable dans le header</small>
                                            </div>
                                        )}
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.82rem' }}>Variables corps <code style={{ fontSize: '0.75rem' }}>{'{{1}}'}</code>, <code style={{ fontSize: '0.75rem' }}>{'{{2}}'}</code>…</label>
                                            <input type="number" min="0" max="10" className="form-control"
                                                value={tplForm.variablesCorps}
                                                onChange={e => setTplForm(f => ({ ...f, variablesCorps: Math.max(0, Math.min(10, +e.target.value)) }))} />
                                            <small className="form-hint">Nb de variables dans le corps du message</small>
                                        </div>
                                    </div>

                                    {/* Aperçu du payload API */}
                                    <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 8, padding: '10px 14px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#94a3b8', overflowX: 'auto' }}>
                                        <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>// Aperçu composants Meta API</span>
                                        <TplPayloadPreview form={tplForm} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: 14 }}>
                                    <label>Description</label>
                                    <input className="form-control" placeholder="Usage, contexte..."
                                        value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="dt-btn" onClick={closeTplModal}>Annuler</button>
                                <button type="submit" className="dt-btn dt-btn-primary" disabled={savingTpl}>
                                    {savingTpl ? 'Enregistrement...' : tplModal === 'add' ? 'Ajouter' : 'Mettre à jour'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Confirmation suppression template ── */}
            {confirmTpl && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer le template</h2>
                            <button className="modal-close" onClick={() => setConfirmTpl(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Supprimer le template <strong>{confirmTpl.nom}</strong> ?</p>
                            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 6 }}>Les districts qui l'utilisent reviendront au template par défaut.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmTpl(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleDeleteTpl(confirmTpl)}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirmation suppression ── */}
            {confirmMobRelais && (
                <div className="modal-overlay">
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <h2>Supprimer la mobilisation</h2>
                            <button className="modal-close" onClick={() => setConfirmMobRelais(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <p>Supprimer toutes les données de mobilisation pour ce district ?</p>
                            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 6 }}>Cette action est irréversible.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="dt-btn" onClick={() => setConfirmMobRelais(null)}>Annuler</button>
                            <button className="dt-btn dt-btn-danger" onClick={() => handleMobRelaisDelete(confirmMobRelais)}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Badge visuel pour le type de contenu du template ── */
const TPL_TYPE_META = {
    aucun:    { icon: 'bi-slash-circle',          label: 'Aucun',    color: '#6b7280', bg: '#f3f4f6'  },
    texte:    { icon: 'bi-fonts',                  label: 'Texte',    color: '#7c3aed', bg: '#ede9fe'  },
    image:    { icon: 'bi-image-fill',             label: 'Image',    color: '#0369a1', bg: '#e0f2fe'  },
    document: { icon: 'bi-file-earmark-pdf-fill',  label: 'Document', color: '#b45309', bg: '#fef3c7'  },
    audio:    { icon: 'bi-mic-fill',               label: 'Audio',    color: '#15803d', bg: '#dcfce7'  },
};
function TplTypeBadge({ type }) {
    const meta = TPL_TYPE_META[type] ?? TPL_TYPE_META.audio;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 600,
            background: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: 10 }}>
            <i className={`bi ${meta.icon}`}></i> {meta.label}
        </span>
    );
}

/* ── Aperçu du payload API Meta pour le template ── */
function TplPayloadPreview({ form }) {
    const components = [];

    if (form.typeContenu === 'image') {
        components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: '<URL_IMAGE>' } }],
        });
    } else if (form.typeContenu === 'document') {
        components.push({
            type: 'header',
            parameters: [{ type: 'document', document: { link: '<URL_DOCUMENT>', filename: 'document.pdf' } }],
        });
    } else if (form.typeContenu === 'texte' && form.variablesEntete > 0) {
        components.push({
            type: 'header',
            parameters: [{ type: 'text', text: '<TEXTE_HEADER>' }],
        });
    }

    if (form.variablesCorps > 0) {
        components.push({
            type: 'body',
            parameters: Array.from({ length: form.variablesCorps }, (_, i) => ({
                type: 'text',
                text: `<VAR_${i + 1}>`,
            })),
        });
    }

    const payload = {
        type: 'template',
        template: {
            name: form.templateName || 'nom_template',
            language: { code: form.langue || 'fr' },
            ...(components.length ? { components } : {}),
        },
    };

    return (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(payload, null, 2)
                .split('\n')
                .map((line, i) => {
                    const isKey   = line.includes('":');
                    const isStr   = line.includes('"<');
                    return (
                        <span key={i} style={{ color: isStr ? '#fbbf24' : isKey ? '#7dd3fc' : '#e2e8f0' }}>
                            {line}{'\n'}
                        </span>
                    );
                })
            }
        </pre>
    );
}
