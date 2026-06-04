import mongoose from 'mongoose';
import type { InventoryRecord, AssetStatus } from '../../shared/types.js';

const beaconSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  rssi: { type: Number, required: true },
  uuid: { type: String, default: '' },
  major: { type: Number, default: 0 },
  minor: { type: Number, default: 0 }
}, { _id: false });

const locationDataSchema = new mongoose.Schema({
  gps: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: 0 }
  },
  beacons: {
    type: [beaconSchema],
    default: []
  }
}, { _id: false });

const inventoryRecordSchema = new mongoose.Schema({
  assetUid: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['in_use', 'idle', 'maintenance', 'scrapped'],
    required: true
  },
  location: {
    type: locationDataSchema,
    default: null
  },
  scannedBy: {
    type: String,
    required: true,
    index: true
  },
  scannedAt: {
    type: String,
    required: true,
    index: true
  },
  note: {
    type: String,
    default: ''
  },
  isOffline: {
    type: Boolean,
    default: false
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

inventoryRecordSchema.index({ assetUid: 1, scannedAt: -1 });
inventoryRecordSchema.index({ scannedBy: 1, scannedAt: -1 });
inventoryRecordSchema.index({ scannedAt: -1 });

inventoryRecordSchema.virtual('asset', {
  ref: 'Asset',
  localField: 'assetUid',
  foreignField: 'uid',
  justOne: true
});

inventoryRecordSchema.set('toObject', { virtuals: true });
inventoryRecordSchema.set('toJSON', { virtuals: true });

export const InventoryRecordModel = mongoose.model<InventoryRecord & mongoose.Document>('InventoryRecord', inventoryRecordSchema);
export default InventoryRecordModel;
