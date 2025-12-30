import mongoose from 'mongoose';

const TipSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Creator', index: true },
    work: { type: mongoose.Schema.Types.ObjectId, ref: 'Work', index: true },
    amountMicro: { type: String, required: true },        // string for bigints
    senderAddress: { type: String, required: true },
    txId: { type: String, required: true, unique: true }, // from Stacks tx
    chain: { type: String, default: 'mainnet' },
    message: { type: String },
    sentiment: { type: Object }
  },
  { timestamps: true }
);

export default mongoose.model('Tip', TipSchema);