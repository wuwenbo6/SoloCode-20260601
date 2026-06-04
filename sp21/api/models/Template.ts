import mongoose, { Schema, Document } from 'mongoose';
import type { PrintTemplate, TemplateVariable } from '../../shared/types';

export interface ITemplate extends Document, Omit<PrintTemplate, '_id'> {
  _id: mongoose.Types.ObjectId;
}

const variableSchema = new Schema<TemplateVariable>({
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['string', 'number', 'date', 'boolean'],
    required: true,
    default: 'string'
  },
  required: { type: Boolean, default: true },
  defaultValue: { type: String, default: '' }
});

const templateSchema = new Schema<ITemplate>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  content: {
    type: String,
    required: true
  },
  variables: {
    type: [variableSchema],
    default: []
  },
  width: {
    type: Number,
    default: 58,
    enum: [58, 80]
  }
}, {
  timestamps: true
});

templateSchema.index({ name: 1 });
templateSchema.index({ createdAt: -1 });

export const Template = mongoose.model<ITemplate>('Template', templateSchema);
