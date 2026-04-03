import mongoose from 'mongoose';

export async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('[DB] MONGODB_URI manquant dans .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('[DB] Connecté à MongoDB :', mongoose.connection.name);
    } catch (err) {
        console.error('[DB] Échec de connexion MongoDB :', err.message);
        process.exit(1);
    }

    mongoose.connection.on('disconnected', () =>
        console.warn('[DB] MongoDB déconnecté')
    );
    mongoose.connection.on('error', (err) =>
        console.error('[DB] Erreur MongoDB :', err.message)
    );
}
