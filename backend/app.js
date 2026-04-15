import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { connectDB } from './db/config/database.js';
import webhookRouter from './routes/webhook.js';
import authRouter from './routes/auth.js';
import usersRouter from './db/routes/users.js';
import contactsRouter from './db/routes/contacts.js';
import conversationsRouter from './db/routes/conversations.js';
import broadcastsRouter from './db/routes/broadcasts.js';
import campagnesRouter from './db/routes/campagnes.js';
import mobilisationSocialeRouter from './db/routes/MobilisationSociale.js';
import metadataRouter from './db/routes/metadata.js';
import { reloadHausaVocab } from './lib/hausaVocab.js';
import { preloadErrorAudios } from './lib/errorAudio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Routes API et webhook
app.use('/api', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/broadcasts', broadcastsRouter);
app.use('/api/campagnes', campagnesRouter);
app.use('/api/mobilisationsociales', mobilisationSocialeRouter);
app.use('/api/metadata', metadataRouter);
app.use('/webhook', webhookRouter);

// Sert le frontend React (build) et gère le rechargement SPA
app.use(express.static(clientDist));
app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 50000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
connectDB().then(async () => {
    await reloadHausaVocab().catch(e => console.error('[INIT] reloadHausaVocab échoué:', e.message));
    await preloadErrorAudios().catch(e => console.error('[INIT] preloadErrorAudios échoué:', e.message));
});
