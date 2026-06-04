import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings')
const METADATA_DIR = path.join(RECORDINGS_DIR, 'metadata')

type PlaybackEventType =
  | 'chat'
  | 'caption'
  | 'poll-start'
  | 'poll-end'
  | 'poll-vote'
  | 'hand-raise'
  | 'hand-lower'
  | 'join'
  | 'leave'

export interface PlaybackEvent {
  type: PlaybackEventType
  timestamp: number
  data: Record<string, unknown>
}

export interface RecordingMetadata {
  id: string
  roomId: string
  roomName: string
  startTime: number
  endTime: number
  duration: number
  videoFilePath: string
  events: PlaybackEvent[]
  participants: { id: string; name: string }[]
  captions: {
    id: string
    speakerId: string
    speakerName: string
    text: string
    timestamp: number
  }[]
  chatMessages: {
    id: string
    senderId: string
    senderName: string
    text: string
    timestamp: number
  }[]
}

class PlaybackManager {
  private recordingMetadata: Map<string, RecordingMetadata> = new Map()
  private activeRecordings: Map<
    string,
    {
      events: PlaybackEvent[]
      captions: RecordingMetadata['captions']
      chatMessages: RecordingMetadata['chatMessages']
      participants: Map<string, string>
      startTime: number
    }
  > = new Map()

  constructor() {
    this.ensureDirectories()
    this.loadExistingMetadata()
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
    }
    if (!fs.existsSync(METADATA_DIR)) {
      fs.mkdirSync(METADATA_DIR, { recursive: true })
    }
  }

  private loadExistingMetadata(): void {
    try {
      const files = fs.readdirSync(METADATA_DIR)
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = fs.readFileSync(path.join(METADATA_DIR, file), 'utf-8')
            const metadata = JSON.parse(data) as RecordingMetadata
            this.recordingMetadata.set(metadata.id, metadata)
          } catch {}
        }
      }
    } catch {}
  }

  startRecording(
    roomId: string,
    roomName: string,
    videoFilePath: string,
    initialParticipants: { id: string; name: string }[]
  ): void {
    this.activeRecordings.set(roomId, {
      events: [],
      captions: [],
      chatMessages: [],
      participants: new Map(initialParticipants.map((p) => [p.id, p.name])),
      startTime: Date.now(),
    })
  }

  stopRecording(
    roomId: string,
    roomName: string,
    videoFilePath: string
  ): RecordingMetadata | null {
    const active = this.activeRecordings.get(roomId)
    if (!active) return null

    const endTime = Date.now()
    const metadata: RecordingMetadata = {
      id: `${roomId}-${active.startTime}`,
      roomId,
      roomName,
      startTime: active.startTime,
      endTime,
      duration: endTime - active.startTime,
      videoFilePath,
      events: active.events,
      participants: Array.from(active.participants.entries()).map(([id, name]) => ({ id, name })),
      captions: active.captions,
      chatMessages: active.chatMessages,
    }

    this.recordingMetadata.set(metadata.id, metadata)
    this.saveMetadata(metadata)
    this.activeRecordings.delete(roomId)

    return metadata
  }

  private saveMetadata(metadata: RecordingMetadata): void {
    const filePath = path.join(METADATA_DIR, `${metadata.id}.json`)
    try {
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2))
    } catch {}
  }

  addEvent(roomId: string, type: PlaybackEventType, data: Record<string, unknown>): void {
    const active = this.activeRecordings.get(roomId)
    if (!active) return

    active.events.push({
      type,
      timestamp: Date.now(),
      data,
    })
  }

  addCaption(
    roomId: string,
    captionId: string,
    speakerId: string,
    speakerName: string,
    text: string
  ): void {
    const active = this.activeRecordings.get(roomId)
    if (!active) return

    active.captions.push({
      id: captionId,
      speakerId,
      speakerName,
      text,
      timestamp: Date.now(),
    })
  }

  addChatMessage(
    roomId: string,
    messageId: string,
    senderId: string,
    senderName: string,
    text: string
  ): void {
    const active = this.activeRecordings.get(roomId)
    if (!active) return

    active.chatMessages.push({
      id: messageId,
      senderId,
      senderName,
      text,
      timestamp: Date.now(),
    })

    this.addEvent(roomId, 'chat', {
      messageId,
      senderId,
      senderName,
      text,
    })
  }

  addParticipant(roomId: string, peerId: string, displayName: string): void {
    const active = this.activeRecordings.get(roomId)
    if (!active) return

    active.participants.set(peerId, displayName)
    this.addEvent(roomId, 'join', { peerId, displayName })
  }

  removeParticipant(roomId: string, peerId: string): void {
    const active = this.activeRecordings.get(roomId)
    if (!active) return

    const displayName = active.participants.get(peerId)
    active.participants.delete(peerId)
    this.addEvent(roomId, 'leave', { peerId, displayName })
  }

  isRecording(roomId: string): boolean {
    return this.activeRecordings.has(roomId)
  }

  getRecordingMetadata(recordingId: string): RecordingMetadata | undefined {
    return this.recordingMetadata.get(recordingId)
  }

  getAllRecordings(): RecordingMetadata[] {
    return Array.from(this.recordingMetadata.values()).sort(
      (a, b) => b.startTime - a.startTime
    )
  }

  deleteRecording(recordingId: string): boolean {
    const metadata = this.recordingMetadata.get(recordingId)
    if (!metadata) return false

    try {
      const metaPath = path.join(METADATA_DIR, `${recordingId}.json`)
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath)
      }
      if (fs.existsSync(metadata.videoFilePath)) {
        fs.unlinkSync(metadata.videoFilePath)
      }
    } catch {}

    this.recordingMetadata.delete(recordingId)
    return true
  }

  getRecordingVideoPath(recordingId: string): string | undefined {
    const metadata = this.recordingMetadata.get(recordingId)
    return metadata?.videoFilePath
  }
}

export const playbackManager = new PlaybackManager()
