import 'dotenv/config';
import mongoose from 'mongoose';
import District from '../models/District.js';
import Structure from '../models/Structure.js';

// Structures sanitaires par district (coordonnées approximatives réelles du Niger)
const DATA = [
    // ── NIAMEY ──────────────────────────────────────────────────────────────
    { district: 'Niamey I',  nom: 'CSI Dar Es Salam',          type: 'CSI',              lat: 13.5230, lng: 2.1130, contact: '+22790000001' },
    { district: 'Niamey I',  nom: 'CSI Lazaret',               type: 'CSI',              lat: 13.5160, lng: 2.1200, contact: '+22790000002' },
    { district: 'Niamey II', nom: 'CSI Koira Tegui',           type: 'CSI',              lat: 13.5100, lng: 2.0990, contact: '+22790000003' },
    { district: 'Niamey III',nom: 'CSI Aéroport',              type: 'CSI',              lat: 13.4820, lng: 2.1840, contact: '+22790000004' },
    { district: 'Niamey IV', nom: 'CSI Talladjé',              type: 'CSI',              lat: 13.4950, lng: 2.1050, contact: '+22790000005' },
    { district: 'Niamey V',  nom: 'CSI Kirkissoye',            type: 'CSI',              lat: 13.5450, lng: 2.0700, contact: '+22790000006' },
    { district: 'Niamey I',  nom: 'Hôpital National de Niamey',type: 'Hôpital District', lat: 13.5137, lng: 2.1098, contact: '+22720722460' },

    // ── DOSSO ────────────────────────────────────────────────────────────────
    { district: 'Dosso',    nom: 'CSI Dosso Centre',       type: 'CSI', lat: 13.0477, lng: 3.1965, contact: '+22720660001' },
    { district: 'Gaya',     nom: 'CSI Gaya',               type: 'CSI', lat: 11.8874, lng: 3.4483, contact: '+22720660002' },
    { district: 'Dogondoutchi', nom: 'CSI Doutchi',         type: 'CSI', lat: 13.9307, lng: 4.0233, contact: '+22720660003' },
    { district: 'Boboye',   nom: 'CSI Birni Gaouré',       type: 'CSI', lat: 13.0810, lng: 3.4800, contact: '+22720660004' },

    // ── MARADI ───────────────────────────────────────────────────────────────
    { district: 'Maradi Ville', nom: 'CSI Maradi Centre',      type: 'CSI',              lat: 13.5004, lng: 7.1018, contact: '+22720610001' },
    { district: 'Maradi Ville', nom: 'Hôpital District Maradi',type: 'Hôpital District', lat: 13.4934, lng: 7.0982, contact: '+22720610010' },
    { district: 'Aguié',    nom: 'CSI Aguié',              type: 'CSI', lat: 13.5176, lng: 7.7784, contact: '+22720610002' },
    { district: 'Tessaoua', nom: 'CSI Tessaoua',           type: 'CSI', lat: 13.7543, lng: 7.9883, contact: '+22720610003' },
    { district: 'Dakoro',   nom: 'CSI Dakoro',             type: 'CSI', lat: 14.5121, lng: 6.7687, contact: '+22720610004' },
    { district: 'Madarounfa', nom: 'CSI Madarounfa',       type: 'CSI', lat: 13.0657, lng: 7.1523, contact: '+22720610005' },
    { district: 'Mayahi',   nom: 'CSI Mayahi',             type: 'CSI', lat: 13.9595, lng: 7.6678, contact: '+22720610006' },
    { district: 'Guidan Roumdji', nom: 'CSI Guidan Roumdji', type: 'CSI', lat: 13.6578, lng: 6.6942, contact: '+22720610007' },

    // ── TAHOUA ───────────────────────────────────────────────────────────────
    { district: 'Tahoua',   nom: 'CSI Tahoua Centre',      type: 'CSI', lat: 14.8889, lng: 5.2675, contact: '+22720640001' },
    { district: 'Tahoua',   nom: 'Hôpital District Tahoua',type: 'Hôpital District', lat: 14.8934, lng: 5.2700, contact: '+22720640010' },
    { district: 'Birni N\'Konni', nom: 'CSI Birni N\'Konni', type: 'CSI', lat: 13.7898, lng: 5.2507, contact: '+22720640002' },
    { district: 'Madaoua',  nom: 'CSI Madaoua',            type: 'CSI', lat: 14.0737, lng: 5.9579, contact: '+22720640003' },
    { district: 'Bouza',    nom: 'CSI Bouza',              type: 'CSI', lat: 14.4218, lng: 5.6986, contact: '+22720640004' },
    { district: 'Illela',   nom: 'CSI Illéla',             type: 'CSI', lat: 14.4696, lng: 4.9987, contact: '+22720640005' },
    { district: 'Keita',    nom: 'CSI Keïta',              type: 'CSI', lat: 14.7603, lng: 5.7701, contact: '+22720640006' },

    // ── TAHOUA Département ───────────────────────────────────────────────────────────────
    
  { district: 'Tahoua Dept', nom: "CSI Takanamat", type: "CSI", lat: 4.77715, lng: 15.137066666666666, contact: "+22790000001" },
  { district: "Tahoua Dept", nom: "CSI Bilingué", type: "CSI", lat: 4.163866666666667, lng: 14.904583333333333, contact: "+22790000002" },
  { district: "Tahoua Dept", nom: "CSI Guidan Méli", type: "CSI", lat: 4.5734, lng: 14.9966, contact: "+22790000003" },
  { district: "Tahoua Dept", nom: "CSI Tébaram", type: "CSI", lat: 4.453983333333333, lng: 14.835833333333333, contact: "+22790000004" },
  { district: "Tahoua Dept", nom: "CSI Toudoun Taramna", type: "CSI", lat: null, lng: null, contact: "+22790000005" },
  { district: "Tahoua Dept", nom: "CSI Amaloul Guidiss", type: "CSI", lat: 4.645383333333333, lng: 15.253633333333333, contact: "+22790000006" },
  { district: "Tahoua Dept", nom: "CS Adoua", type: "CS", lat: 4.565333333333333, lng: 14.939633333333333, contact: "+22790000007" },
  { district: "Tahoua Dept", nom: "CS Kouka Kammé", type: "CS", lat: 4.365766666666667, lng: 14.749783333333333, contact: "+22790000008" },
  { district: "Tahoua Dept", nom: "CS Maissoungoumi", type: "CS", lat: 4.243566666666667, lng: 14.7801, contact: "+22790000009" },
  { district: "Tahoua Dept", nom: "CS Innélou", type: "CS", lat: 4.3418, lng: 15.057266666666667, contact: "+22790000010" },



    // ── ZINDER ───────────────────────────────────────────────────────────────
    { district: 'Zinder Ville', nom: 'CSI Zinder Centre',      type: 'CSI',              lat: 13.8069, lng: 8.9881, contact: '+22720510001' },
    { district: 'Zinder Ville', nom: 'Hôpital District Zinder',type: 'Hôpital District', lat: 13.8006, lng: 8.9900, contact: '+22720510010' },
    { district: 'Mirriah',  nom: 'CSI Mirriah',            type: 'CSI', lat: 13.7156, lng: 9.1678, contact: '+22720510002' },
    { district: 'Goure',    nom: 'CSI Gouré',              type: 'CSI', lat: 13.9868, lng: 10.2702, contact: '+22720510003' },
    { district: 'Magaria',  nom: 'CSI Magaria',            type: 'CSI', lat: 12.9958, lng: 8.9092, contact: '+22720510004' },
    { district: 'Tanout',   nom: 'CSI Tanout',             type: 'CSI', lat: 14.9701, lng: 8.8876, contact: '+22720510005' },
    { district: 'Dungass',  nom: 'CSI Dungass',            type: 'CSI', lat: 12.9250, lng: 9.8280, contact: '+22720510006' },

    // ── TILLABÉRI ─────────────────────────────────────────────────────────────
    { district: 'Tillabéri', nom: 'CSI Tillabéri',         type: 'CSI', lat: 14.2136, lng: 1.4528, contact: '+22720680001' },
    { district: 'Filingue',  nom: 'CSI Filingué',          type: 'CSI', lat: 14.3584, lng: 3.3246, contact: '+22720680002' },
    { district: 'Kollo',     nom: 'CSI Kollo',             type: 'CSI', lat: 13.3089, lng: 2.3133, contact: '+22720680003' },
    { district: 'Say',       nom: 'CSI Say',               type: 'CSI', lat: 13.1076, lng: 2.3670, contact: '+22720680004' },
    { district: 'Ouallam',   nom: 'CSI Ouallam',           type: 'CSI', lat: 14.3250, lng: 2.0820, contact: '+22720680005' },
    { district: 'Tera',      nom: 'CSI Téra',              type: 'CSI', lat: 14.0167, lng: 0.7500, contact: '+22720680006' },

    // ── AGADEZ ───────────────────────────────────────────────────────────────
    { district: 'Agadez',   nom: 'CSI Agadez Centre',      type: 'CSI', lat: 16.9742, lng: 7.9920, contact: '+22720440001' },
    { district: 'Agadez',   nom: 'Hôpital District Agadez',type: 'Hôpital District', lat: 16.9700, lng: 7.9950, contact: '+22720440010' },
    { district: 'Arlit',    nom: 'CSI Arlit',              type: 'CSI', lat: 18.7369, lng: 7.3856, contact: '+22720440002' },
    { district: 'Tchirozérine', nom: 'CSI Tchirozérine',   type: 'CSI', lat: 17.9167, lng: 8.0000, contact: '+22720440003' },

    // ── DIFFA ─────────────────────────────────────────────────────────────────
    { district: 'Diffa',    nom: 'CSI Diffa Centre',       type: 'CSI', lat: 13.3186, lng: 12.6148, contact: '+22720540001' },
    { district: 'Diffa',    nom: 'Hôpital District Diffa', type: 'Hôpital District', lat: 13.3200, lng: 12.6200, contact: '+22720540010' },
    { district: 'Maïné-Soroa', nom: 'CSI Maïné-Soroa',    type: 'CSI', lat: 13.2197, lng: 12.0223, contact: '+22720540002' },
    { district: 'N\'Guigmi', nom: 'CSI N\'Guigmi',        type: 'CSI', lat: 14.2534, lng: 13.1114, contact: '+22720540003' },
    { district: 'Bosso',    nom: 'CSI Bosso',             type: 'CSI', lat: 13.6951, lng: 13.3186, contact: '+22720540004' },
];

async function seedStructures() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connecté à MongoDB :', mongoose.connection.name);

    let created = 0;
    let skipped = 0;

    for (const s of DATA) {
        const district = await District.findOne({ nom: s.district });
        if (!district) {
            console.warn(`  [WARN] District introuvable : "${s.district}" — ignoré`);
            skipped++;
            continue;
        }

        const existe = await Structure.findOne({ nom: s.nom, districtId: district._id });
        if (!existe) {
            await Structure.create({
                nom: s.nom,
                type: s.type,
                districtId: district._id,
                coordonnees: {
                    latitude:  s.lat ?? null,
                    longitude: s.lng ?? null,
                },
                contactUrgence: s.contact,
                statutVaccination: true
            });
            const coords = (s.lat != null) ? `${s.lat}, ${s.lng}` : 'sans coordonnées';
            console.log(`  [SEED] Créé : ${s.nom} (${s.district}) — ${coords}`);
            created++;
        } else {
            skipped++;
        }
    }

    console.log(`\n[SEED] Terminé — ${created} structures créées, ${skipped} ignorées.`);
    await mongoose.disconnect();
}

seedStructures().catch(err => {
    console.error('[SEED] Erreur :', err.message);
    process.exit(1);
});
