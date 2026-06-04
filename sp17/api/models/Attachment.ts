import mongoose from 'mongoose'

const attachmentSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    fileName: { type: String },
    fileSize: { type: Number },
    encryptedFileSize: { type: Number },
    chunkCount: { type: Number },
    chunkSize: { type: Number },
    iv: { type: String },
    minioKey: { type: String },
    uploadId: { type: String, index: true },
    uploadedParts: [
      {
        partNumber: { type: Number, required: true },
        etag: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'uploading', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    uploadProgress: { type: Number, default: 0, min: 0, max: 100 },
    checksum: { type: String },
  },
  { timestamps: true },
)

export default mongoose.model('Attachment', attachmentSchema)
