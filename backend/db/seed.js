import 'dotenv/config';
import mongoose from 'mongoose';
import User, { genererLogin } from './models/User.js';
import Vaccin from './models/Vaccin.js';
import CalendrierVaccinal from './models/CalendrierVaccinal.js';

// ─── Utilisateurs ────────────────────────────────────────────
const users = [
    {
        nom: 'Administrateur',
        email: 'admin@sante.gouv.ne',
        password: '2026MSHP!ne',
        role: 'admin'
    }
];

// ─── Vaccins PEV Niger ────────────────────────────────────────
// Source : Programme Élargi de Vaccination du Niger (PEV / DSME)
const vaccins = [
    // ── Naissance ──
    {
        code: 'BCG',
        nom: 'BCG (Bacille de Calmette et Guérin)',
        maladiesProtegees: 'Tuberculose, méningite tuberculeuse',
        nbDoses: 1,
        voieAdministration: 'intradermique',
    },
    {
        code: 'VPO0',
        nom: 'VPO — Dose 0 (Vaccin Polio Oral)',
        maladiesProtegees: 'Poliomyélite',
        nbDoses: 1,
        voieAdministration: 'oral',
    },
    {
        code: 'HEPB',
        nom: 'Hépatite B (naissance)',
        maladiesProtegees: 'Hépatite B',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },

    // ── 6 semaines ──
    {
        code: 'PENTA1',
        nom: 'Pentavalent — Dose 1 (DTC-HepB-Hib)',
        maladiesProtegees: 'Diphtérie, Tétanos, Coqueluche, Hépatite B, Haemophilus influenzae b',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'VPO1',
        nom: 'VPO — Dose 1',
        maladiesProtegees: 'Poliomyélite',
        nbDoses: 3,
        voieAdministration: 'oral',
    },
    {
        code: 'PCV1',
        nom: 'Pneumocoque (PCV13) — Dose 1',
        maladiesProtegees: 'Pneumonie, méningite à pneumocoque',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'ROTA1',
        nom: 'Rotavirus — Dose 1',
        maladiesProtegees: 'Gastro-entérite à rotavirus',
        nbDoses: 2,
        voieAdministration: 'oral',
    },

    // ── 10 semaines ──
    {
        code: 'PENTA2',
        nom: 'Pentavalent — Dose 2',
        maladiesProtegees: 'Diphtérie, Tétanos, Coqueluche, Hépatite B, Haemophilus influenzae b',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'VPO2',
        nom: 'VPO — Dose 2',
        maladiesProtegees: 'Poliomyélite',
        nbDoses: 3,
        voieAdministration: 'oral',
    },
    {
        code: 'PCV2',
        nom: 'Pneumocoque (PCV13) — Dose 2',
        maladiesProtegees: 'Pneumonie, méningite à pneumocoque',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'ROTA2',
        nom: 'Rotavirus — Dose 2',
        maladiesProtegees: 'Gastro-entérite à rotavirus',
        nbDoses: 2,
        voieAdministration: 'oral',
    },

    // ── 14 semaines ──
    {
        code: 'PENTA3',
        nom: 'Pentavalent — Dose 3',
        maladiesProtegees: 'Diphtérie, Tétanos, Coqueluche, Hépatite B, Haemophilus influenzae b',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'VPO3',
        nom: 'VPO — Dose 3',
        maladiesProtegees: 'Poliomyélite',
        nbDoses: 3,
        voieAdministration: 'oral',
    },
    {
        code: 'PCV3',
        nom: 'Pneumocoque (PCV13) — Dose 3',
        maladiesProtegees: 'Pneumonie, méningite à pneumocoque',
        nbDoses: 3,
        voieAdministration: 'injectable',
    },
    {
        code: 'VPI',
        nom: 'VPI (Vaccin Polio Injectable)',
        maladiesProtegees: 'Poliomyélite',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },

    // ── 6 mois ──
    {
        code: 'VAA',
        nom: 'Vaccin Anti-Amaril (Fièvre jaune)',
        maladiesProtegees: 'Fièvre jaune',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },
    {
        code: 'VAR',
        nom: 'Vaccin Anti-Rougeoleux',
        maladiesProtegees: 'Rougeole',
        nbDoses: 2,
        voieAdministration: 'injectable',
    },
    {
        code: 'MENA',
        nom: 'MenAfriVac (Méningite A)',
        maladiesProtegees: 'Méningite à méningocoque A',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },

    // ── 9 mois ──
    {
        code: 'RR',
        nom: 'Vaccin Rougeole-Rubéole',
        maladiesProtegees: 'Rougeole, Rubéole',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },

    // ── Femme enceinte / femme en âge de procréer ──
    {
        code: 'VAT1',
        nom: 'VAT — Dose 1 (Vaccin Antitétanique)',
        maladiesProtegees: 'Tétanos néonatal et maternel',
        nbDoses: 5,
        voieAdministration: 'injectable',
    },
    {
        code: 'VAT2',
        nom: 'VAT — Dose 2',
        maladiesProtegees: 'Tétanos néonatal et maternel',
        nbDoses: 5,
        voieAdministration: 'injectable',
    },
    {
        code: 'VAT3',
        nom: 'VAT — Dose 3',
        maladiesProtegees: 'Tétanos néonatal et maternel',
        nbDoses: 5,
        voieAdministration: 'injectable',
    },
    {
        code: 'VAT4',
        nom: 'VAT — Dose 4',
        maladiesProtegees: 'Tétanos néonatal et maternel',
        nbDoses: 5,
        voieAdministration: 'injectable',
    },
    {
        code: 'VAT5',
        nom: 'VAT — Dose 5',
        maladiesProtegees: 'Tétanos néonatal et maternel',
        nbDoses: 5,
        voieAdministration: 'injectable',
    },

    // ── Campagnes supplémentaires ──
    {
        code: 'HPV',
        nom: 'HPV (Papillomavirus humain)',
        maladiesProtegees: 'Cancer du col de l\'utérus',
        nbDoses: 2,
        voieAdministration: 'injectable',
    },
    {
        code: 'TYPHOID',
        nom: 'Vaccin anti-typhoïde conjugué (TCV)',
        maladiesProtegees: 'Fièvre typhoïde',
        nbDoses: 1,
        voieAdministration: 'injectable',
    },
];

// ─── Calendrier vaccinal PEV Niger ───────────────────────────
// Chaque entrée référence un code vaccin (doit exister dans la collection Vaccin)
const calendrier = [
    // ── À la naissance (0 semaine) ──
    { code: 'BCG',    ageLabel: 'À la naissance', ageEnSemaines: 0,  cible: 'nourrisson',     notes: 'Dose unique, bras gauche' },
    { code: 'VPO0',   ageLabel: 'À la naissance', ageEnSemaines: 0,  cible: 'nourrisson',     notes: 'Dose 0, avant sortie maternité' },
    { code: 'HEPB',   ageLabel: 'À la naissance', ageEnSemaines: 0,  cible: 'nourrisson',     notes: 'Dans les 24h suivant la naissance' },

    // ── 6 semaines ──
    { code: 'PENTA1', ageLabel: '6 semaines',     ageEnSemaines: 6,  cible: 'nourrisson',     notes: 'Dose 1' },
    { code: 'VPO1',   ageLabel: '6 semaines',     ageEnSemaines: 6,  cible: 'nourrisson',     notes: 'Dose 1' },
    { code: 'PCV1',   ageLabel: '6 semaines',     ageEnSemaines: 6,  cible: 'nourrisson',     notes: 'Dose 1' },
    { code: 'ROTA1',  ageLabel: '6 semaines',     ageEnSemaines: 6,  cible: 'nourrisson',     notes: 'Dose 1' },

    // ── 10 semaines ──
    { code: 'PENTA2', ageLabel: '10 semaines',    ageEnSemaines: 10, cible: 'nourrisson',     notes: 'Dose 2' },
    { code: 'VPO2',   ageLabel: '10 semaines',    ageEnSemaines: 10, cible: 'nourrisson',     notes: 'Dose 2' },
    { code: 'PCV2',   ageLabel: '10 semaines',    ageEnSemaines: 10, cible: 'nourrisson',     notes: 'Dose 2' },
    { code: 'ROTA2',  ageLabel: '10 semaines',    ageEnSemaines: 10, cible: 'nourrisson',     notes: 'Dose 2 — dernière dose rotavirus' },

    // ── 14 semaines ──
    { code: 'PENTA3', ageLabel: '14 semaines',    ageEnSemaines: 14, cible: 'nourrisson',     notes: 'Dose 3 — dernière dose pentavalent' },
    { code: 'VPO3',   ageLabel: '14 semaines',    ageEnSemaines: 14, cible: 'nourrisson',     notes: 'Dose 3 — dernière dose VPO' },
    { code: 'PCV3',   ageLabel: '14 semaines',    ageEnSemaines: 14, cible: 'nourrisson',     notes: 'Dose 3 — dernière dose pneumocoque' },
    { code: 'VPI',    ageLabel: '14 semaines',    ageEnSemaines: 14, cible: 'nourrisson',     notes: 'Dose unique injectable' },

    // ── 6 mois (26 semaines) ──
    { code: 'VAA',    ageLabel: '6 mois',         ageEnSemaines: 26, cible: 'nourrisson',     notes: 'Fièvre jaune — dose unique à vie' },
    { code: 'VAR',    ageLabel: '6 mois',         ageEnSemaines: 26, cible: 'nourrisson',     notes: 'Dose 1 rougeole' },
    { code: 'MENA',   ageLabel: '6 mois',         ageEnSemaines: 26, cible: 'nourrisson',     notes: 'Méningite A — dose unique à vie' },

    // ── 9 mois (39 semaines) ──
    { code: 'RR',     ageLabel: '9 mois',         ageEnSemaines: 39, cible: 'nourrisson',     notes: 'Rougeole-Rubéole' },

    // ── Femme enceinte / femme en âge de procréer ──
    { code: 'VAT1',   ageLabel: 'Premier contact (FAP)',         ageEnSemaines: 0,   cible: 'femme_enceinte', notes: 'Femme en âge de procréer — dès la 1ère consultation' },
    { code: 'VAT2',   ageLabel: '4 semaines après VAT1',        ageEnSemaines: 4,   cible: 'femme_enceinte', notes: 'Protection 3 ans' },
    { code: 'VAT3',   ageLabel: '6 mois après VAT2',            ageEnSemaines: 30,  cible: 'femme_enceinte', notes: 'Protection 5 ans' },
    { code: 'VAT4',   ageLabel: '1 an après VAT3',              ageEnSemaines: 82,  cible: 'femme_enceinte', notes: 'Protection 10 ans' },
    { code: 'VAT5',   ageLabel: '1 an après VAT4',              ageEnSemaines: 134, cible: 'femme_enceinte', notes: 'Protection à vie' },
];

// ─── Seed principal ───────────────────────────────────────────
async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connecté à MongoDB :', mongoose.connection.name);

    // Utilisateurs
    for (const data of users) {
        const existe = await User.findOne({ email: data.email });
        if (existe) {
            console.log(`[SEED] Utilisateur déjà existant : ${data.email}`);
            continue;
        }
        const login = genererLogin(data.nom);
        const user = await User.create({ ...data, login });
        console.log(`[SEED] Utilisateur créé : ${user.email} | login: ${user.login} (${user.role})`);
    }

    // Vaccins
    let crees = 0;
    let ignores = 0;
    for (const data of vaccins) {
        const existe = await Vaccin.findOne({ code: data.code });
        if (existe) {
            ignores++;
            continue;
        }
        await Vaccin.create(data);
        console.log(`[SEED] Vaccin créé : ${data.code} — ${data.nom}`);
        crees++;
    }
    console.log(`[SEED] Vaccins : ${crees} créé(s), ${ignores} déjà existant(s).`);

    // Calendrier vaccinal
    let calCrees = 0;
    let calIgnores = 0;
    for (const data of calendrier) {
        const vaccin = await Vaccin.findOne({ code: data.code });
        if (!vaccin) {
            console.warn(`[SEED] Vaccin introuvable pour le calendrier : ${data.code}`);
            calIgnores++;
            continue;
        }
        const existe = await CalendrierVaccinal.findOne({ vaccinId: vaccin._id, ageLabel: data.ageLabel });
        if (existe) {
            calIgnores++;
            continue;
        }
        await CalendrierVaccinal.create({
            vaccinId: vaccin._id,
            ageLabel: data.ageLabel,
            ageEnSemaines: data.ageEnSemaines,
            cible: data.cible,
            notes: data.notes,
        });
        console.log(`[SEED] Calendrier : ${data.code} @ ${data.ageLabel}`);
        calCrees++;
    }
    console.log(`[SEED] Calendrier : ${calCrees} créé(s), ${calIgnores} déjà existant(s).`);

    await mongoose.disconnect();
    console.log('[SEED] Terminé.');
}

seed().catch(err => {
    console.error('[SEED] Erreur :', err.message);
    process.exit(1);
});
