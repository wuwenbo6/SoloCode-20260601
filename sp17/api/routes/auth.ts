import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authenticator } from 'otplib'
import qrcode from 'qrcode'
import User from '../models/User.js'

import auth from '../middleware/auth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TEMP_TOKEN_SECRET = process.env.TEMP_TOKEN_SECRET || 'temp-secret-change-me'
const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || 'totp-encryption-key-change-me'

function encryptSecret(secret: string): string {
  return Buffer.from(secret).toString('base64')
}

function decryptSecret(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString()
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, passwordHash, salt } = req.body

    if (!email || !passwordHash || !salt) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const existing = await User.findOne({ email })
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already exists' })
      return
    }

    const hashed = await bcrypt.hash(passwordHash, 10)
    const user = await User.create({ email, passwordHash: hashed, salt })

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, salt: user.salt },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, passwordHash } = req.body

    if (!email || !passwordHash) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const user = await User.findOne({ email })
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    const valid = await bcrypt.compare(passwordHash, user.passwordHash)
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    if (user.totpEnabled) {
      const tempToken = jwt.sign({ userId: user._id }, TEMP_TOKEN_SECRET, { expiresIn: '5m' })
      res.json({
        success: true,
        data: {
          requiresTwoFactor: true,
          tempToken,
        },
      })
      return
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, salt: user.salt },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/totp/generate', auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    if (user.totpEnabled) {
      res.status(400).json({ success: false, error: 'TOTP already enabled' })
      return
    }

    const secret = authenticator.generateSecret()
    const otpauth = authenticator.keyuri(user.email, 'CryptNote', secret)
    const qrCodeUrl = await qrcode.toDataURL(otpauth)

    res.json({
      success: true,
      data: {
        secret,
        otpauth,
        qrCodeUrl,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/totp/enable', auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { code, secret } = req.body

    if (!code || !secret) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    if (user.totpEnabled) {
      res.status(400).json({ success: false, error: 'TOTP already enabled' })
      return
    }

    const valid = authenticator.verify({ token: code, secret })
    if (!valid) {
      res.status(400).json({ success: false, error: 'Invalid verification code' })
      return
    }

    user.totpSecret = encryptSecret(secret)
    user.totpEnabled = true
    await user.save()

    res.json({ success: true, data: { message: 'TOTP enabled successfully' } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/totp/disable', auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { passwordHash } = req.body

    if (!passwordHash) {
      res.status(400).json({ success: false, error: 'Password is required' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    const valid = await bcrypt.compare(passwordHash, user.passwordHash)
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid password' })
      return
    }

    user.totpSecret = undefined
    user.totpEnabled = false
    await user.save()

    res.json({ success: true, data: { message: 'TOTP disabled successfully' } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/totp/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body

    if (!tempToken || !code) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const decoded = jwt.verify(tempToken, TEMP_TOKEN_SECRET) as { userId: string }
    const user = await User.findById(decoded.userId)
    if (!user || !user.totpEnabled || !user.totpSecret) {
      res.status(400).json({ success: false, error: 'Invalid request' })
      return
    }

    const secret = decryptSecret(user.totpSecret)
    const valid = authenticator.verify({ token: code, secret })
    if (!valid) {
      res.status(400).json({ success: false, error: 'Invalid verification code' })
      return
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, salt: user.salt },
      },
    })
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Temporary token expired' })
    } else {
      res.status(500).json({ success: false, error: 'Server internal error' })
    }
  }
})

router.get('/me', auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }
    res.json({
      success: true,
      data: { id: user._id, email: user.email, salt: user.salt, totpEnabled: user.totpEnabled },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
