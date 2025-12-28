```javascript
import mongoose from 'mongoose';

const WorkSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Creator', required: true, index: true },
    txId: { type: String, required: true, unique: true }, // from Stacks tx
    chain: { type: String, default: 'mainnet' },
    workUrl: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    fileUrl: { type: String, required: true },      // served from /uploads
    fileType: { type: String, default: '' },        // image/jpeg, audio/mpeg, video/mp4, etc.
    coverUrl: { type: String, default: '' }         // optional thumbnail
  },
  { timestamps: true }
);

export default mongoose.model('Work', WorkSchema);