import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../models/Region.js';
import District from '../models/District.js';

const DATA = [
    {
        region: 'Agadez',
        districts: [
            'Agadez', 'Arlit', 'Bilma', 'Tchirozérine', 'Iférouane', 'Aderbissinat'
        ]
    },
    {
        region: 'Diffa',
        districts: [
            'Diffa', 'Bosso', 'Goudoumaria', 'Maïné-Soroa', 'N\'Guigmi'
        ]
    },
    {
        region: 'Dosso',
        districts: [
            'Dosso', 'Boboye', 'Doutchi', 'Falmey', 'Gaya', 'Loga', 'Tibiri'
        ]
    },
    {
        region: 'Maradi',
        districts: [
            'Maradi', 'Aguié', 'Bermo', 'Dakoro', 'Gazaoua', 'Guidan Roumdji',
            'Madarounfa', 'Mayahi', 'Tessaoua'
        ]
    },
    {
        region: 'Niamey',
        districts: [
            'Niamey 1', 'Niamey 2', 'Niamey 3', 'Niamey 4', 'Niamey 5'
        ]
    },
    {
        region: 'Tahoua',
        districts: [
            'Tahoua', 'Abalak', 'Birni N\'Konni', 'Bouza', 'Illéla', 'Keïta',
            'Madaoua', 'Malbaza', 'Tassara', 'Tchintabaraden'
        ]
    },
    {
        region: 'Tillabéri',
        districts: [
            'Tillabéri', 'Ayorou', 'Balleyara', 'Bankilaré', 'Filingué', 'Gothèye',
            'Kollo', 'Ouallam', 'Say', 'Tera', 'Torodi'
        ]
    },
    {
        region: 'Zinder',
        districts: [
            'Zinder', 'Dungass', 'Gouré', 'Magaria', 'Mirriah', 'Matameye',
            'Takeita', 'Tanout', 'Tesker'
        ]
    }
];

async function seedRegionsDistricts() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connecté à MongoDB :', mongoose.connection.name);

    let totalRegions  = 0;
    let totalDistricts = 0;

    for (const entry of DATA) {
        let region = await Region.findOne({ nom: entry.region });
        if (!region) {
            region = await Region.create({ nom: entry.region });
            totalRegions++;
            console.log(`[SEED] Région créée : ${region.nom}`);
        } else {
            console.log(`[SEED] Région existante : ${region.nom}`);
        }

        for (const nomDistrict of entry.districts) {
            const existe = await District.findOne({ nom: nomDistrict, regionId: region._id });
            if (!existe) {
                await District.create({ nom: nomDistrict, regionId: region._id });
                totalDistricts++;
                console.log(`  [SEED] District créé : ${nomDistrict}`);
            }
        }
    }

    console.log(`\n[SEED] Terminé — ${totalRegions} régions, ${totalDistricts} districts créés.`);
    await mongoose.disconnect();
}

seedRegionsDistricts().catch(err => {
    console.error('[SEED] Erreur :', err.message);
    process.exit(1);
});
