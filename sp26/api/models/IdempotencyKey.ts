import mongoose, { Document, Schema } from 'mongoose';

export interface IIdempotencyKey extends Document {
  key: string;
  response: unknown;
  statusCode: number;
  createdAt: Date;
  expiresAt: Date;
}

const IdempotencyKeySchema: Schema<IIdempotencyKey> = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  response: {
    type: Schema.Types.Mixed,
    required: true,
  },
  statusCode: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema);
