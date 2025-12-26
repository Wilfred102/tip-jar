import { Router } from 'express';
import Creator from '../models/Creator.js';

const router = Router();

// Create creator
router.post('/', async (req, res) => {
  try {
    const { name, bio, walletAddress, avatarUrl } = req.body;
    if (!name || !walletAddress) return res.status(400).json({ error: 'name and walletAddress required' });
    const doc = await Creator.create({ name, bio, walletAddress, avatarUrl });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List creators
router.get('/', async (_req, res) => {
  const list = await Creator.find().sort({ createdAt: -1 }).limit(100);
  res.json(list);
});

// Get one creator
router.get('/:id', async (req, res) => {
  const doc = await Creator.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json(doc);
});

export default router;