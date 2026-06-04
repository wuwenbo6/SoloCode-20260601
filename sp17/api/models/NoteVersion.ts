import mongoose from 'mongoose'

const noteVersionSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    version: { type: Number, required: true },
    titleCiphertext: { type: String },
    titleIv: { type: String },
    contentCiphertext: { type: String },
    contentIv: { type: String },
    tagsCiphertext: { type: String },
    tagsIv: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

noteVersionSchema.index({ noteId: 1, version: -1 })

export default mongoose.model('NoteVersion', noteVersionSchema)
