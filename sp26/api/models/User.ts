import mongoose from 'mongoose';
import type { User } from '../../shared/types.js';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'inventory'],
    default: 'inventory',
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown> & { _id?: { toString(): string }; __v?: unknown; password?: unknown }) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

userSchema.index({ email: 1 });

export const UserModel = mongoose.model<User & mongoose.Document>('User', userSchema);
export default UserModel;
