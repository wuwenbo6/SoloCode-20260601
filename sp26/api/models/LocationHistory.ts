import mongoose from 'mongoose';
import type { LocationTrack } from '../../shared/types.js';

const beaconSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  rssi: { type: Number, required: true },
  uuid: { type: String, default: '' },
  major: { type: Number, default: 0 },
  minor: { type: Number, default: 0 }
}, { _id: false });

const locationHistorySchema = new mongoose.Schema({
  assetUid: {
    type: String,
    required: true,
    index: true
  },
  gps: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: 0 }
  },
  beacons: {
    type: [beaconSchema],
    default: []
  },
  trackedAt: {
    type: String,
    required: true,
    index: true
  },
  trackedBy: {
    type: String,
    required: true,
    index: true
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

locationHistorySchema.index({ assetUid: 1, trackedAt: -1 });
locationHistorySchema.index({ trackedAt: -1 });

locationHistorySchema.virtual('asset', {
  ref: 'Asset',
  localField: 'assetUid',
  foreignField: 'uid',
  justOne: true
});

locationHistorySchema.set('toObject', { virtuals: true });
locationHistorySchema.set('toJSON', { virtuals: true });

export const LocationHistoryModel = mongoose.model<LocationTrack & mongoose.Document>('LocationHistory', locationHistorySchema);
export default LocationHistoryModel;
