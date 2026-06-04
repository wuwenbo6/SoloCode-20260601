import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import Attachment from '../models/Attachment.js'
import { minioClient, BUCKET } from '../config/minio.js'
import auth from '../middleware/auth.js'

const router = Router()

router.use(auth)

router.post('/init', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { noteId, fileName, fileSize, encryptedFileSize, chunkCount, chunkSize, iv } = req.body

    if (!noteId || !fileName || !chunkCount || !chunkSize || !iv) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const uploadId = uuidv4()
    const objectKey = `attachments/${userId}/${uploadId}/${fileName}`

    const attachment = await Attachment.create({
      noteId,
      fileName,
      fileSize,
      encryptedFileSize,
      chunkCount,
      chunkSize,
      iv,
      minioKey: objectKey,
      uploadId,
      status: 'uploading',
      uploadProgress: 0,
      uploadedParts: [],
    })

    res.json({
      success: true,
      data: {
        attachmentId: attachment._id,
        uploadId,
        chunkSize,
        chunkCount,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/part-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { attachmentId, partNumber } = req.body

    if (!attachmentId || !partNumber) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const attachment = await Attachment.findById(attachmentId)
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' })
      return
    }

    const partKey = `${attachment.minioKey}/part-${partNumber}`
    const url = await minioClient.presignedPutObject(BUCKET, partKey, 60 * 60)

    res.json({ success: true, data: { url, partNumber } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/part-complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { attachmentId, partNumber, etag, size } = req.body

    if (!attachmentId || !partNumber || !etag) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const attachment = await Attachment.findById(attachmentId)
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' })
      return
    }

    const existingPartIndex = attachment.uploadedParts.findIndex(
      (p: { partNumber: number }) => p.partNumber === partNumber
    )

    if (existingPartIndex >= 0) {
      (attachment.uploadedParts as any)[existingPartIndex] = { partNumber, etag, size: size || 0 }
    } else {
      (attachment.uploadedParts as any).push({ partNumber, etag, size: size || 0 })
    }

    attachment.uploadProgress = Math.round(
      (attachment.uploadedParts.length / attachment.chunkCount) * 100
    )

    await attachment.save()

    res.json({ success: true, data: { uploadProgress: attachment.uploadProgress } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const { attachmentId } = req.body

    if (!attachmentId) {
      res.status(400).json({ success: false, error: 'Missing attachmentId' })
      return
    }

    const attachment = await Attachment.findById(attachmentId)
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' })
      return
    }

    const uploadedPartNumbers = attachment.uploadedParts.map(
      (p: { partNumber: number }) => p.partNumber
    )

    const existingParts: Array<{ partNumber: number; etag: string; size: number }> = []
    for (const partNumber of uploadedPartNumbers) {
      const partKey = `${attachment.minioKey}/part-${partNumber}`
      try {
        const stat = await minioClient.statObject(BUCKET, partKey)
        existingParts.push({
          partNumber,
          etag: stat.etag.replace(/"/g, ''),
          size: stat.size,
        })
      } catch {
        // Part doesn't exist, will need to re-upload
      }
    }

    attachment.uploadedParts = existingParts as any
    attachment.uploadProgress = Math.round((existingParts.length / attachment.chunkCount) * 100)
    attachment.status = 'uploading'
    await attachment.save()

    res.json({
      success: true,
      data: {
        attachmentId: attachment._id,
        uploadId: attachment.uploadId,
        uploadedParts: existingParts,
        uploadProgress: attachment.uploadProgress,
        chunkCount: attachment.chunkCount,
        chunkSize: attachment.chunkSize,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        iv: attachment.iv,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { attachmentId } = req.body

    if (!attachmentId) {
      res.status(400).json({ success: false, error: 'Missing attachmentId' })
      return
    }

    const attachment = await Attachment.findById(attachmentId)
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' })
      return
    }

    attachment.status = 'completed'
    attachment.uploadProgress = 100
    await attachment.save()

    res.json({ success: true, data: { attachmentId: attachment._id } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/:id/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const attachment = await Attachment.findById(req.params.id)

    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' })
      return
    }

    const urls: string[] = []
    for (let i = 1; i <= attachment.chunkCount; i++) {
      const partKey = `${attachment.minioKey}/part-${i}`
      const url = await minioClient.presignedGetObject(BUCKET, partKey, 60 * 60)
      urls.push(url)
    }

    res.json({
      success: true,
      data: {
        urls,
        chunkSize: attachment.chunkSize,
        iv: attachment.iv,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        chunkCount: attachment.chunkCount,
        encryptedFileSize: attachment.encryptedFileSize,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
