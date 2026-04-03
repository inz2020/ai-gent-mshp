import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { connectDB } from './db/config/database.js';
import webhookRouter from './routes/webhook.js';
import authRouter from './routes/auth.js';
import usersRouter from './db/routes/users.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    const date = new Date();
    res.send(`<h1>La date et l'heure actuelles sont : ${date.toLocaleString()}</h1>`);
});

app.use('/api', authRouter);
app.use('/api/users', usersRouter);
app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 50000;
connectDB().then(() =>
    app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`))
);
