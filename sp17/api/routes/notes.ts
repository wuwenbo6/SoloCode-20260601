import { Router, type Request, type Response } from 'express'
import Note from '../models/Note.js'
import NoteVersion from '../models/NoteVersion.js'
import Attachment from '../models/Attachment.js'
import { minioClient, BUCKET } from '../config/minio.js'
import auth from '../middleware/auth.js'

const router = Router()

router.use(auth)

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { titleCiphertext, titleIv, contentCiphertext, contentIv, tagsCiphertext, tagsIv, searchIndex } = req.body

    const note = await Note.create({
      userId,
      titleCiphertext,
      titleIv,
      contentCiphertext,
      contentIv,
      tagsCiphertext,
      tagsIv,
      searchIndex: searchIndex || [],
      currentVersion: 1,
    })

    await NoteVersion.create({
      noteId: note._id,
      version: 1,
      titleCiphertext,
      titleIv,
      contentCiphertext,
      contentIv,
      tagsCiphertext,
      tagsIv,
    })

    res.status(201).json({ success: true, data: { id: note._id, createdAt: note.createdAt, updatedAt: note.updatedAt, currentVersion: note.currentVersion } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { queryHash } = req.body

    if (!queryHash) {
      res.status(400).json({ success: false, error: 'queryHash is required' })
      return
    }

    const notes = await Note.find({
      userId,
      searchIndex: queryHash,
    })
      .select('_id titleCiphertext titleIv updatedAt')
      .sort({ updatedAt: -1 })

    const noteIds = notes.map((note) => note._id.toString())

    res.json({
      success: true,
      data: {
        noteIds,
        notes: notes.map((n) => ({
          id: n._id,
          titleCiphertext: n.titleCiphertext,
          titleIv: n.titleIv,
          updatedAt: n.updatedAt,
        })),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const notes = await Note.find({ userId })
      .select('titleCiphertext titleIv tagsCiphertext tagsIv createdAt updatedAt')
      .sort({ updatedAt: -1 })

    res.json({ success: true, data: { notes } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const note = await Note.findOne({ _id: req.params.id, userId })

    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    const attachments = await Attachment.find({ noteId: note._id })

    res.json({ success: true, data: { ...note.toObject(), attachments: attachments.map(a => ({ id: a._id, fileName: a.fileName, fileSize: a.fileSize, chunkCount: a.chunkCount })) } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { titleCiphertext, titleIv, contentCiphertext, contentIv, tagsCiphertext, tagsIv, searchIndex } = req.body

    const note = await Note.findOne({ _id: req.params.id, userId })
    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    if (titleCiphertext !== undefined) note.titleCiphertext = titleCiphertext
    if (titleIv !== undefined) note.titleIv = titleIv
    if (contentCiphertext !== undefined) note.contentCiphertext = contentCiphertext
    if (contentIv !== undefined) note.contentIv = contentIv
    if (tagsCiphertext !== undefined) note.tagsCiphertext = tagsCiphertext
    if (tagsIv !== undefined) note.tagsIv = tagsIv
    if (searchIndex !== undefined) note.searchIndex = searchIndex

    note.currentVersion = (note.currentVersion || 1) + 1
    await note.save()

    await NoteVersion.create({
      noteId: note._id,
      version: note.currentVersion,
      titleCiphertext: note.titleCiphertext,
      titleIv: note.titleIv,
      contentCiphertext: note.contentCiphertext,
      contentIv: note.contentIv,
      tagsCiphertext: note.tagsCiphertext,
      tagsIv: note.tagsIv,
    })

    res.json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const note = await Note.findOne({ _id: req.params.id, userId })

    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    const attachments = await Attachment.find({ noteId: note._id })

    for (const att of attachments) {
      if (att.minioKey) {
        try {
          await minioClient.removeObject(BUCKET, att.minioKey)
        } catch {}
      }
    }

    await Attachment.deleteMany({ noteId: note._id })
    await note.deleteOne()

    res.json({ success: true, data: { message: 'Note deleted' } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/:id/versions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const note = await Note.findOne({ _id: req.params.id, userId })

    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    const versions = await NoteVersion.find({ noteId: note._id })
      .select('version createdAt')
      .sort({ version: -1 })

    res.json({ success: true, data: { versions, currentVersion: note.currentVersion } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.get('/:id/versions/:version', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const note = await Note.findOne({ _id: req.params.id, userId })

    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    const version = parseInt(req.params.version)
    const noteVersion = await NoteVersion.findOne({ noteId: note._id, version })

    if (!noteVersion) {
      res.status(404).json({ success: false, error: 'Version not found' })
      return
    }

    res.json({ success: true, data: noteVersion })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/:id/versions/:version/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const note = await Note.findOne({ _id: req.params.id, userId })

    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }

    const targetVersion = parseInt(req.params.version)
    const noteVersion = await NoteVersion.findOne({ noteId: note._id, version: targetVersion })

    if (!noteVersion) {
      res.status(404).json({ success: false, error: 'Version not found' })
      return
    }

    note.currentVersion = (note.currentVersion || 1) + 1
    note.titleCiphertext = noteVersion.titleCiphertext
    note.titleIv = noteVersion.titleIv
    note.contentCiphertext = noteVersion.contentCiphertext
    note.contentIv = noteVersion.contentIv
    note.tagsCiphertext = noteVersion.tagsCiphertext
    note.tagsIv = noteVersion.tagsIv

    await note.save()

    await NoteVersion.create({
      noteId: note._id,
      version: note.currentVersion,
      titleCiphertext: note.titleCiphertext,
      titleIv: note.titleIv,
      contentCiphertext: note.contentCiphertext,
      contentIv: note.contentIv,
      tagsCiphertext: note.tagsCiphertext,
      tagsIv: note.tagsIv,
    })

    res.json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
