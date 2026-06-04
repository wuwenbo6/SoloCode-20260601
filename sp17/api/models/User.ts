import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    totpSecret: { type: String },
    totpEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
