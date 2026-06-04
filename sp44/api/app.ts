import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import { roomManager } from './room-manager.js'
import { getRecordingFilePath } from './recording.js'
import { playbackApiRouter } from './playback-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api', playbackApiRouter)

app.post('/api/rooms', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body
    const room = await roomManager.createRoom(name || 'Unnamed Room')
    res.status(201).json({ success: true, data: { id: room.id, name: room.name } })
  } catch (err) {
    next(err)
  }
})

app.get('/api/rooms/:roomId', (req: Request, res: Response): void => {
  const room = roomManager.getRoom(req.params.roomId)
  if (!room) {
    res.status(404).json({ success: false, error: 'Room not found' })
    return
  }
  const peers = roomManager.getRoomPeers(room.id)
  res.status(200).json({
    success: true,
    data: {
      id: room.id,
      name: room.name,
      peers,
      peerCount: peers.length,
    },
  })
})

app.delete('/api/rooms/:roomId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await roomManager.deleteRoom(req.params.roomId)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Room not found' })
      return
    }
    res.status(200).json({ success: true, message: 'Room deleted' })
  } catch (err) {
    next(err)
  }
})

app.get('/api/recordings/:fileId', (req: Request, res: Response): void => {
  const filePath = getRecordingFilePath(req.params.fileId)
  if (!filePath) {
    res.status(404).json({ success: false, error: 'Recording not found' })
    return
  }
  res.download(filePath, `${req.params.fileId}.webm`, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: 'Recording file not found' })
    }
  })
})

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
