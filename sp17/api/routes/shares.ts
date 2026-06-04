import { Router, type Request, type Response } from 'express'
import Share from '../models/Share.js'
import auth from '../middleware/auth.js'

const router = Router()

router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { noteId, titleCiphertext, titleIv, contentCiphertext, contentIv, salt, expiresAt } = req.body

    if (!noteId || !contentCiphertext || !contentIv || !salt || !expiresAt) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const share = await Share.create({
      noteId,
      userId,
      titleCiphertext,
      titleIv,
      contentCiphertext,
      contentIv,
      salt,
      expiresAt,
    })

    res.status(201).json({ success: true, data: { shareId: share._id } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/:shareId', async (req: Request, res: Response): Promise<void> => {
  try {
    const share = await Share.findById(req.params.shareId)

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found' })
      return
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      res.status(410).json({ success: false, error: 'Share has expired' })
      return
    }

    res.json({
      success: true,
      data: {
        titleCiphertext: share.titleCiphertext,
        titleIv: share.titleIv,
        contentCiphertext: share.contentCiphertext,
        contentIv: share.contentIv,
        salt: share.salt,
        expiresAt: share.expiresAt,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
