import mongoose, { Schema, Document, Types } from 'mongoose';
import type { PrintHistory } from '../../shared/types';

export interface IHistory extends Omit<PrintHistory, '_id' | 'templateId' | 'printedAt' | 'data'>, Document {
  _id: Types.ObjectId;
  templateId: Types.ObjectId;
  data: any;
  printedAt: Date;
}

const historySchema = new Schema({
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'Template',
    required: true
  },
  templateName: {
    type: String,
    required: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    required: true,
    default: 'pending'
  },
  errorMessage: {
    type: String,
    default: ''
  },
  printerName: {
    type: String,
    required: true
  },
  printedAt: {
    type: Date,
    default: Date.now
  }
});

historySchema.index({ printedAt: -1 });
historySchema.index({ templateId: 1 });
historySchema.index({ status: 1 });

export const History = mongoose.model<IHistory>('History', historySchema);
