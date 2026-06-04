import mongoose from 'mongoose'

const shareSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    titleCiphertext: { type: String },
    titleIv: { type: String },
    contentCiphertext: { type: String },
    contentIv: { type: String },
    salt: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)

shareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('Share', shareSchema)
