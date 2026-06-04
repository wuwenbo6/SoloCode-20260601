import mongoose from 'mongoose';
import type { Asset, AssetStatus } from '../../shared/types.js';

const assetSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  location: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['in_use', 'idle', 'maintenance', 'scrapped'],
    default: 'idle',
    required: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  purchaseDate: {
    type: String,
    default: ''
  },
  purchasePrice: {
    type: Number,
    default: 0
  },
  lastInventoryAt: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown> & { _id?: { toString(): string }; __v?: unknown }) => {
      ret._id = ret._id?.toString();
      delete ret.__v;
      return ret;
    }
  }
});

assetSchema.index({ name: 'text', description: 'text', category: 'text' });
assetSchema.index({ status: 1, category: 1 });
assetSchema.index({ createdAt: -1 });

export const AssetModel = mongoose.model<Asset & mongoose.Document>('Asset', assetSchema);
export default AssetModel;
