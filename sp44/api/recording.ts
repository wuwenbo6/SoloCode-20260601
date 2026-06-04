import { spawn } from 'child_process'
import { mkdirSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { types } from 'mediasoup'
import { roomManager } from './room-manager.js'

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')

try {
  mkdirSync(RECORDINGS_DIR, { recursive: true })
} catch {}

export async function startRecording(roomId: string): Promise<string> {
  const room = roomManager.getRoom(roomId)
  if (!room) throw new Error(`Room ${roomId} not found`)

  const existing = roomManager.getRecordingProcess(roomId)
  if (existing) throw new Error(`Room ${roomId} is already recording`)

  const plainTransport = await roomManager.createPlainTransport(roomId)

  const audioProducers: { producerId: string }[] = []
  for (const peer of room.peers.values()) {
    for (const producer of peer.producers.values()) {
      if (producer.kind === 'audio') {
        audioProducers.push({ producerId: producer.id })
      }
    }
  }

  if (audioProducers.length === 0) {
    throw new Error('No audio producers in room to record')
  }

  const plainConsumers: types.Consumer[] = []
  for (const { producerId } of audioProducers) {
    const consumer = await plainTransport.consume({
      producerId,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: false,
    })
    plainConsumers.push(consumer)
  }

  const fileId = uuidv4()
  const filePath = path.join(RECORDINGS_DIR, `${fileId}.webm`)

  const rtpPort = plainTransport.tuple.localPort
  const rtcpPort = (plainTransport.rtcpTuple as any)?.localPort ?? rtpPort + 1

  const ffmpegArgs = [
    '-y',
    '-protocol_whitelist', 'pipe,udp,rtp',
    '-i', `rtp://127.0.0.1:${rtpPort}?rtcpport=${rtcpPort}`,
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-f', 'webm',
    filePath,
  ]

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[FFmpeg:${roomId}] ${data.toString().trim()}`)
  })

  ffmpegProcess.on('error', (err) => {
    console.error(`[FFmpeg:${roomId}] process error:`, err.message)
    for (const consumer of plainConsumers) {
      consumer.close()
    }
    roomManager.clearRecording(roomId)
  })

  ffmpegProcess.on('close', (code) => {
    console.log(`[FFmpeg:${roomId}] exited with code ${code}`)
    for (const consumer of plainConsumers) {
      consumer.close()
    }
    roomManager.clearRecording(roomId)
  })

  roomManager.setRecordingProcess(roomId, ffmpegProcess, filePath)

  return filePath
}

export function stopRecording(roomId: string): string {
  const recording = roomManager.getRecordingProcess(roomId)
  if (!recording) throw new Error(`No active recording for room ${roomId}`)
  const filePath = recording.filePath
  recording.process.kill('SIGTERM')
  roomManager.clearRecording(roomId)
  return filePath
}

export function getRecordingFilePath(fileId: string): string | null {
  const filePath = path.join(RECORDINGS_DIR, `${fileId}.webm`)
  return filePath
}
