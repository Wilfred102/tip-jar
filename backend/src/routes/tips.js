import { Router } from 'express';
import Sentiment from 'sentiment';
import Tip from '../models/Tip.js';
import Creator from '../models/Creator.js';
import Work from '../models/Work.js';

const router = Router();
const sentiment = new Sentiment();

// Record a tip event (called by frontend after tx broadcast/confirm)
router.post('/', async (req, res) => {
  try {
    const { creatorId, workId, amountMicro, senderAddress, txId, chain = 'mainnet', message } = req.body;
    if (!creatorId || !amountMicro || !senderAddress || !txId) {
      return res.status(400).json({ error: 'creatorId, amountMicro, senderAddress, txId required' });
    }
    const creator = await Creator.findById(creatorId);
    if (!creator) return res.status(404).json({ error: 'creator not found' });

    let workDoc = null;
    if (workId) {
      workDoc = await Work.findById(workId);
      if (!workDoc) return res.status(404).json({ error: 'work not found' });
    }

    let sentimentResult = null;
    if (message) {
      sentimentResult = sentiment.analyze(message);
    }

    const tip = await Tip.create({
      creator: creator._id,
      work: workDoc?._id,
      amountMicro: String(amountMicro),
      senderAddress,
      txId,
      chain,
      message,
      sentiment: sentimentResult
    });

    res.status(201).json(tip);
  } catch (e) {
    // unique txId guard or others
    res.status(500).json({ error: e.message });
  }
});

// List tips by creator or work
router.get('/', async (req, res) => {
  const { creatorId, workId } = req.query;
  const filter = {
    ...(creatorId ? { creator: creatorId } : {}),
    ...(workId ? { work: workId } : {})
  };
  const list = await Tip.find(filter)
    .populate('creator')
    .populate('work')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(list);
});

export default router;