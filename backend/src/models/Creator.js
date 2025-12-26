import mongoose from 'mongoose';

const CreatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    bio: { type: String, default: '' },
    walletAddress: { type: String, required: true, index: true }, // STX address to tip
    avatarUrl: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Creator', CreatorSchema);