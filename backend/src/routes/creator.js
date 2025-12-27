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

// Update a creator
router.put('/:id', async (req, res) => {
  try {
    const { name, bio, walletAddress, avatarUrl } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name;
    if (typeof bio === 'string') update.bio = bio;
    if (typeof walletAddress === 'string') update.walletAddress = walletAddress;
    if (typeof avatarUrl === 'string') update.avatarUrl = avatarUrl;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }

    const doc = await Creator.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;