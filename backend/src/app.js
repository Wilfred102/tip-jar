import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';

import creatorsRoute from './routes/creator.js';
import worksRoute from './routes/works.js';
import tipsRoute from './routes/tips.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// middlewares
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));

// static for uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// routes
app.use('/api/creators', creatorsRoute);
app.use('/api/works', worksRoute);
app.use('/api/tips', tipsRoute);

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// start
connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error('Failed to start:', e);
    process.exit(1);
  });