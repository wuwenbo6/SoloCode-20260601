import express from 'express'
import { playbackManager } from './playback-manager.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const apiRouter = express.Router()

apiRouter.get('/recordings', (_req, res) => {
  const recordings = playbackManager.getAllRecordings()
  res.json({ recordings })
})

apiRouter.get('/recordings/:recordingId', (req, res) => {
  const { recordingId } = req.params
  const metadata = playbackManager.getRecordingMetadata(recordingId)
  if (!metadata) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.json({ metadata })
})

apiRouter.get('/recordings/:recordingId/video', (req, res) => {
  const { recordingId } = req.params
  const videoPath = playbackManager.getRecordingVideoPath(recordingId)
  if (!videoPath) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.sendFile(videoPath)
})

apiRouter.delete('/recordings/:recordingId', (req, res) => {
  const { recordingId } = req.params
  const success = playbackManager.deleteRecording(recordingId)
  if (!success) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.json({ success: true })
})

apiRouter.get('/recordings/:recordingId/captions', (req, res) => {
  const { recordingId } = req.params
  const metadata = playbackManager.getRecordingMetadata(recordingId)
  if (!metadata) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.json({ captions: metadata.captions })
})

apiRouter.get('/recordings/:recordingId/messages', (req, res) => {
  const { recordingId } = req.params
  const metadata = playbackManager.getRecordingMetadata(recordingId)
  if (!metadata) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.json({ messages: metadata.chatMessages })
})

apiRouter.get('/recordings/:recordingId/events', (req, res) => {
  const { recordingId } = req.params
  const metadata = playbackManager.getRecordingMetadata(recordingId)
  if (!metadata) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }
  res.json({ events: metadata.events })
})

export { apiRouter as playbackApiRouter }
