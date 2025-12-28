import { Router } from 'express';
import Work from '../models/Work.js';
import Creator from '../models/Creator.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Create a work (file upload)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { creatorId, title, description, coverUrl, workUrl } = req.body;
    if (!creatorId || !title) return res.status(400).json({ error: 'creatorId and title required' });
    const creator = await Creator.findById(creatorId);
    if (!creator) return res.status(404).json({ error: 'creator not found' });

    if (!req.file) return res.status(400).json({ error: 'file required' });

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;

    const doc = await Work.create({
      creator: creator._id,
      title,
      description,
      fileUrl,
      fileType,
      coverUrl,
      workUrl
    });

    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List works (optionally by creator)
router.get('/', async (req, res) => {
  const { creatorId } = req.query;
  const filter = creatorId ? { creator: creatorId } : {};
  const list = await Work.find(filter).populate('creator').sort({ createdAt: -1 }).limit(100);
  res.json(list);
});

// Get one work
router.get('/:id', async (req, res) => {
  const doc = await Work.findById(req.params.id).populate('creator');
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json(doc);
});

// Delete a work
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Work.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });

    // Delete the file from disk
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', path.basename(doc.fileUrl));

    try {
      await fs.unlink(filePath);
    } catch (fileErr) {
      console.warn('Failed to delete file:', fileErr);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await Work.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Work deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;