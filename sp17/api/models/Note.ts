import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    titleCiphertext: { type: String },
    titleIv: { type: String },
    contentCiphertext: { type: String },
    contentIv: { type: String },
    tagsCiphertext: { type: String },
    tagsIv: { type: String },
    searchIndex: { type: [String], default: [], index: true },
    currentVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
)

noteSchema.index({ userId: 1, updatedAt: -1 })
noteSchema.index({ userId: 1, searchIndex: 1 })

export default mongoose.model('Note', noteSchema)
