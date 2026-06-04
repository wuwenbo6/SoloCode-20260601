import mongoose, { Document, Schema } from 'mongoose';
import type { LifecycleAction, LocationData } from '../../shared/types.js';

export interface IAssetLifecycleLog extends Document {
  assetUid: string;
  action: LifecycleAction;
  performedBy: string;
  performedAt: Date;
  location?: LocationData;
  note?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

const LocationDataSchema: Schema = new Schema({
  gps: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number },
  },
  beacons: [{
    id: { type: String, required: true },
    name: { type: String },
    rssi: { type: Number, required: true },
    uuid: { type: String },
    major: { type: Number },
    minor: { type: Number },
  }],
});

const AssetLifecycleLogSchema: Schema<IAssetLifecycleLog> = new Schema({
  assetUid: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['scan', 'inventory', 'status_change', 'location_update', 
           'write_tag', 'lock_tag', 'create', 'update', 'delete', 'import', 'export'],
    index: true,
  },
  performedBy: {
    type: String,
    required: true,
    index: true,
  },
  performedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  location: {
    type: LocationDataSchema,
  },
  note: {
    type: String,
  },
  oldValue: {
    type: String,
  },
  newValue: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
});

AssetLifecycleLogSchema.index({ assetUid: 1, performedAt: -1 });
AssetLifecycleLogSchema.index({ performedBy: 1, performedAt: -1 });
AssetLifecycleLogSchema.index({ action: 1, performedAt: -1 });

export default mongoose.model<IAssetLifecycleLog>('AssetLifecycleLog', AssetLifecycleLogSchema);
