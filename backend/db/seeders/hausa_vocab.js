/**
 * Seeder : importe le vocabulaire Hausa depuis les deux fichiers Excel.
 *
 * Fusionne hausa_vocabulaire_niger.xlsx (95 mots / 74 phrases)
 *       et vocabulaire_ia_niger.xlsx   (98 mots / 74 phrases)
 * en dédupliquant sur (type + valeur).
 *
 * Usage :
 *   node db/seeders/hausa_vocab.js              (utilise .env)
 *   node --env-file=.env.prod db/seeders/hausa_vocab.js
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import HausaVocabulaire from '../models/HausaVocabulaire.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, '..', '..', '..', 'files');

// ─── Lecture des deux fichiers Excel ────────────────────────────────────────

function loadExcel(filename) {
    const wb = XLSX.readFile(path.join(FILES_DIR, filename));
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}

function mergeRows(files) {
    const seen = new Set();
    const merged = [];

    for (const rows of files) {
        for (const row of rows) {
            const type    = String(row.type    ?? '').trim().toLowerCase();
            const valeur  = String(row.valeur  ?? '').trim().toLowerCase();
            const trad    = String(row.traduction_fr ?? '').trim();
            const cat     = String(row.categorie     ?? '').trim();

            if (!type || !valeur) continue;
            if (!['mot', 'phrase'].includes(type)) continue;

            const key = `${type}|${valeur}`;
            if (seen.has(key)) continue;
            seen.add(key);

            merged.push({ type, valeur, traduction_fr: trad, categorie: cat });
        }
    }

    return merged;
}

// ─── Main ────────────────────────────────────────────────────────────────────

await connectDB();

const rows = mergeRows([
    loadExcel('hausa_vocabulaire_niger.xlsx'),
    loadExcel('vocabulaire_ia_niger.xlsx'),
]);

console.log(`[SEED] ${rows.length} entrées fusionnées (${rows.filter(r => r.type === 'mot').length} mots, ${rows.filter(r => r.type === 'phrase').length} phrases)`);

let created = 0, skipped = 0;

for (const row of rows) {
    const existe = await HausaVocabulaire.findOne({ type: row.type, valeur: row.valeur });
    if (existe) { skipped++; continue; }
    await HausaVocabulaire.create(row);
    created++;
}

console.log(`[SEED] Terminé — ${created} entrées créées, ${skipped} déjà présentes.`);
await mongoose.disconnect();
