import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../models/Region.js';
import District from '../models/District.js';

// Source : niger_districts (centroïdes des districts sanitaires du Niger)
const DATA = [
    {
        region: 'Agadez',
        districts: [
            { nom: 'Agadez',        lat: 16.9733, lng: 7.9911 },
            { nom: 'Arlit',         lat: 18.7369, lng: 7.3853 },
            { nom: 'Bilma',         lat: 18.6853, lng: 12.9164 },
            { nom: 'Tchirozérine',  lat: 17.2458, lng: 7.3270 },
        ]
    },
    {
        region: 'Diffa',
        districts: [
            { nom: 'Bosso',         lat: 13.7333, lng: 13.9333 },
            { nom: 'Diffa',         lat: 13.3154, lng: 12.6113 },
            { nom: 'Goudoumaria',   lat: 13.7081, lng: 12.7286 },
            { nom: 'Maïné-Soroa',   lat: 13.2114, lng: 12.0241 },
            { nom: "N'Guigmi",      lat: 14.2490, lng: 13.1092 },
        ]
    },
    {
        region: 'Dosso',
        districts: [
            { nom: 'Boboye',        lat: 13.0890, lng: 3.4490 },
            { nom: 'Dioundiou',     lat: 13.1833, lng: 3.3500 },
            { nom: 'Dogondoutchi',  lat: 13.6403, lng: 4.0265 },
            { nom: 'Dosso',         lat: 13.0490, lng: 3.1942 },
            { nom: 'Falmey',        lat: 12.9900, lng: 2.8900 },
            { nom: 'Gaya',          lat: 11.8844, lng: 3.4494 },
            { nom: 'Loga',          lat: 13.5178, lng: 2.7838 },
        ]
    },
    {
        region: 'Maradi',
        districts: [
            { nom: 'Aguié',         lat: 13.5050, lng: 7.7780 },
            { nom: 'Dakoro',        lat: 14.5106, lng: 6.7650 },
            { nom: 'Gazaoua',       lat: 13.6333, lng: 7.9333 },
            { nom: 'Guidan Roumdji',lat: 13.6853, lng: 6.6953 },
            { nom: 'Madarounfa',    lat: 13.3050, lng: 7.1570 },
            { nom: 'Maradi Ville',  lat: 13.5000, lng: 7.1017 },
            { nom: 'Mayahi',        lat: 13.9570, lng: 7.6710 },
            { nom: 'Tessaoua',      lat: 13.7565, lng: 7.9870 },
        ]
    },
    {
        region: 'Tahoua',
        districts: [
            { nom: 'Abalak',            lat: 15.4500, lng: 6.2833 },
            { nom: 'Tillia',            lat: 16.116667, lng: 4.783333 },
            { nom: 'Bagaroua',          lat: 14.3833, lng: 5.5000 },
            { nom: "Birni N'Konni",     lat: 13.7955, lng: 5.2503 },
            { nom: 'Bouza',             lat: 14.4167, lng: 6.0500 },
            { nom: 'Illela',            lat: 13.7290, lng: 5.2970 },
            { nom: 'Keita',             lat: 14.7556, lng: 5.7747 },
            { nom: 'Madaoua',           lat: 14.0730, lng: 5.9600 },
            { nom: 'Malbaza',           lat: 14.2900, lng: 5.2000 },
            { nom: 'Tahoua',            lat: 14.8900, lng: 5.2600 },
            { nom: 'Tassara',           lat: 16.8833, lng: 5.7833 },
            { nom: 'Tchintabaraden',    lat: 15.8969, lng: 5.7985 },
            {nom: 'Tahoua Dept', lat: 14.8927466,lng: 5.2592551}
        ]
    },
    
    {
        region: 'Tillabéri',
        districts: [
            { nom: 'Ayorou',    lat: 14.7300, lng: 0.9170 },
            { nom: 'Bankilare', lat: 14.9200, lng: 0.8200 },
            { nom: 'Filingue',  lat: 14.3500, lng: 3.3167 },
            { nom: 'Gotheye',   lat: 13.8000, lng: 1.3500 },
            { nom: 'Kollo',     lat: 13.3000, lng: 2.3400 },
            { nom: 'Ouallam',   lat: 14.3167, lng: 2.0833 },
            { nom: 'Say',       lat: 13.1000, lng: 2.3667 },
            { nom: 'Tera',      lat: 14.0000, lng: 0.7500 },
            { nom: 'Tillabéri', lat: 14.2100, lng: 1.4500 },
        ]
    },
    {
        region: 'Zinder',
        districts: [
            { nom: 'Damagaram Takaya', lat: 14.0000, lng: 8.0000 },
            { nom: 'Dungass',          lat: 13.8667, lng: 8.2833 },
            { nom: 'Goure',            lat: 13.9833, lng: 10.2667 },
            { nom: 'Kantche',          lat: 13.5333, lng: 8.4667 },
            { nom: 'Matameye',         lat: 13.4233, lng: 8.4744 },
            { nom: 'Magaria',          lat: 12.9983, lng: 8.9078 },
            { nom: 'Mirriah',          lat: 13.7073, lng: 9.1500 },
            { nom: 'Tanout',           lat: 14.9700, lng: 8.8800 },
            { nom: 'Zinder Ville',     lat: 13.8072, lng: 8.9881 },
            {nom:'Tesker', lat:null, lng:null},
            {nom:'Takiéta', lat:null, lng:null},
            {nom:'Belbédji ', lat:null, lng:null},
        ]
    },
    {
        region: 'Niamey',
        districts: [
            { nom: 'Niamey I',   lat: 13.5215, lng: 2.1254 },
            { nom: 'Niamey II',  lat: 13.5120, lng: 2.1100 },
            { nom: 'Niamey III', lat: 13.5300, lng: 2.1400 },
            { nom: 'Niamey IV',  lat: 13.5400, lng: 2.1300 },
            { nom: 'Niamey V',   lat: 13.5000, lng: 2.1000 },
        ]
    },
];

async function seedRegionsDistricts() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connecté à MongoDB :', mongoose.connection.name);

    let totalRegions  = 0;
    let totalDistricts = 0;
    let updatedDistricts = 0;

    for (const entry of DATA) {
        let region = await Region.findOne({ nom: entry.region });
        if (!region) {
            region = await Region.create({ nom: entry.region });
            totalRegions++;
            console.log(`[SEED] Région créée : ${region.nom}`);
        } else {
            console.log(`[SEED] Région existante : ${region.nom}`);
        }

        for (const d of entry.districts) {
            const coordonnees = { latitude: d.lat, longitude: d.lng };
            const existant = await District.findOne({ nom: d.nom, regionId: region._id });
            if (!existant) {
                await District.create({ nom: d.nom, regionId: region._id, coordonnees });
                totalDistricts++;
                console.log(`  [SEED] District créé : ${d.nom}`);
            } else if (!existant.coordonnees?.latitude) {
                await District.updateOne({ _id: existant._id }, { $set: { coordonnees } });
                updatedDistricts++;
                console.log(`  [SEED] Coordonnées ajoutées : ${d.nom}`);
            }
        }
    }

    console.log(`\n[SEED] Terminé — ${totalRegions} régions, ${totalDistricts} districts créés, ${updatedDistricts} mis à jour.`);
    await mongoose.disconnect();
}

seedRegionsDistricts().catch(err => {
    console.error('[SEED] Erreur :', err.message);
    process.exit(1);
});
