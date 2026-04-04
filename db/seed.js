import 'dotenv/config';
import mongoose from 'mongoose';
import User, { genererLogin } from './models/User.js';

const users = [
    {
        nom: 'Administrateur',
        email: 'admin@sante.gouv.ne',
        password: '2026MSHP!ne',
        role: 'admin'
    }
];

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connecté à MongoDB :', mongoose.connection.name);

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

    await mongoose.disconnect();
    console.log('[SEED] Terminé.');
}

seed().catch(err => {
    console.error('[SEED] Erreur :', err.message);
    process.exit(1);
});
