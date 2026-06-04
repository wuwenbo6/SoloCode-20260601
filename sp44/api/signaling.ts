import type { WebSocket } from 'ws'
import type { types } from 'mediasoup'
import { v4 as uuidv4 } from 'uuid'
import { roomManager } from './room-manager.js'
import { startRecording, stopRecording } from './recording.js'
import { playbackManager } from './playback-manager.js'

interface Poll {
  id: string
  question: string
  options: string[]
  isAnonymous: boolean
  allowMultiple: boolean
  creatorId: string
  creatorName: string
  votes: Map<string, number[]>
  isActive: boolean
  createdAt: number
}

const roomPolls = new Map<string, Poll[]>()
const roomHands = new Map<string, Set<string>>()

interface ClientMessage {
  type: string
  payload: Record<string, unknown>
  msgId?: string
}

interface PeerConnection {
  ws: WebSocket
  peerId: string
  roomId: string | null
  displayName: string
}

const connections = new Map<WebSocket, PeerConnection>()

function send(ws: WebSocket, type: string, payload: Record<string, unknown>, msgId?: string): void {
  if (ws.readyState === ws.OPEN) {
    const msg: Record<string, unknown> = { type, payload }
    if (msgId) msg.msgId = msgId
    ws.send(JSON.stringify(msg))
  }
}

function broadcastToRoom(roomId: string, type: string, payload: Record<string, unknown>, excludeWs?: WebSocket): void {
  for (const [ws, conn] of connections) {
    if (conn.roomId === roomId && ws !== excludeWs) {
      send(ws, type, payload)
    }
  }
}

export async function handleConnection(ws: WebSocket): Promise<void> {
  const conn: PeerConnection = {
    ws,
    peerId: '',
    roomId: null,
    displayName: '',
  }
  connections.set(ws, conn)

  ws.on('message', async (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString())
      await handleMessage(ws, conn, msg)
    } catch (err) {
      send(ws, 'error', { message: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  ws.on('close', () => {
    if (conn.roomId && conn.peerId) {
      const roomId = conn.roomId
      const peerId = conn.peerId
      roomManager.leaveRoom(roomId, peerId)
      broadcastToRoom(roomId, 'peer-left', { peerId })
    }
    connections.delete(ws)
  })
}

async function handleMessage(ws: WebSocket, conn: PeerConnection, msg: ClientMessage): Promise<void> {
  const { type, payload, msgId } = msg

  switch (type) {
    case 'create-room': {
      const name = (payload.name as string) || 'Unnamed Room'
      const room = await roomManager.createRoom(name)
      send(ws, 'room-created', { roomId: room.id, name: room.name }, msgId)
      break
    }

    case 'join-room': {
      const roomId = payload.roomId as string
      const peerId = payload.peerId as string
      const displayName = (payload.displayName as string) || 'Anonymous'

      const rtpCapabilities = roomManager.getRouterRtpCapabilities(roomId)
      if (!rtpCapabilities) {
        send(ws, 'error', { message: `Room ${roomId} not found` })
        return
      }

      await roomManager.joinRoom(roomId, peerId, displayName)
      conn.peerId = peerId
      conn.roomId = roomId
      conn.displayName = displayName

      const peers = roomManager.getRoomPeers(roomId)
      const existingProducers = roomManager.getPeerProducers(roomId, peerId)

      send(ws, 'joined-room', {
        roomId,
        peerId,
        rtpCapabilities,
        peers,
        producers: existingProducers,
      }, msgId)
      broadcastToRoom(roomId, 'peer-joined', { peerId, displayName }, ws)
      break
    }

    case 'get-router-rtp-capabilities': {
      const roomId = payload.roomId as string
      const rtpCapabilities = roomManager.getRouterRtpCapabilities(roomId)
      if (!rtpCapabilities) {
        send(ws, 'error', { message: `Room ${roomId} not found` })
        return
      }
      send(ws, 'router-rtp-capabilities', { rtpCapabilities }, msgId)
      break
    }

    case 'create-webrtc-transport': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const direction = payload.direction as 'send' | 'recv'
      const transportInfo = await roomManager.createWebRtcTransport(
        conn.roomId,
        conn.peerId,
        direction
      )
      send(ws, 'webrtc-transport-created', { ...transportInfo, direction }, msgId)
      break
    }

    case 'connect-transport': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const transportId = payload.transportId as string
      const dtlsParameters = payload.dtlsParameters as Record<string, unknown>
      await roomManager.connectTransport(
        conn.roomId,
        conn.peerId,
        transportId,
        dtlsParameters as any
      )
      send(ws, 'transport-connected', { transportId }, msgId)
      break
    }

    case 'produce': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const kind = payload.kind as types.MediaKind
      const rtpParameters = payload.rtpParameters as Record<string, unknown>
      const appData = payload.appData as Record<string, unknown> | undefined
      const producer = await roomManager.produce(
        conn.roomId,
        conn.peerId,
        kind,
        rtpParameters as any,
        appData
      )
      send(ws, 'produced', { producerId: producer.id, kind }, msgId)
      broadcastToRoom(conn.roomId, 'new-producer', {
        peerId: conn.peerId,
        producerId: producer.id,
        kind,
      })
      break
    }

    case 'consume': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const producerId = payload.producerId as string
      const rtpCapabilities = payload.rtpCapabilities as Record<string, unknown>
      const consumer = await roomManager.consume(
        conn.roomId,
        conn.peerId,
        producerId,
        rtpCapabilities as any
      )
      await roomManager.resumeConsumer(conn.roomId, consumer.id)
      send(ws, 'consumed', {
        consumerId: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      }, msgId)
      break
    }

    case 'exchange-key': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const key = payload.key as string
      roomManager.setPeerEncryptionKey(conn.roomId, conn.peerId, key)
      broadcastToRoom(conn.roomId, 'key-exchanged', { peerId: conn.peerId, key }, ws)
      break
    }

    case 'chat-message': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const message = payload.message as string
      broadcastToRoom(conn.roomId, 'chat-message', {
        peerId: conn.peerId,
        displayName: conn.displayName,
        message,
        timestamp: Date.now(),
      })
      break
    }

    case 'start-recording': {
      if (!conn.roomId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      try {
        const filePath = await startRecording(conn.roomId)
        send(ws, 'recording-started', { roomId: conn.roomId, filePath }, msgId)
        broadcastToRoom(conn.roomId, 'recording-started', { roomId: conn.roomId })
      } catch (err) {
        send(ws, 'error', { message: err instanceof Error ? err.message : 'Recording failed' })
      }
      break
    }

    case 'stop-recording': {
      if (!conn.roomId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      try {
        const filePath = stopRecording(conn.roomId)
        const room = roomManager.getRoom(conn.roomId)
        playbackManager.stopRecording(conn.roomId, room?.name || 'Unknown Meeting', filePath)
        send(ws, 'recording-stopped', { roomId: conn.roomId, filePath }, msgId)
        broadcastToRoom(conn.roomId, 'recording-stopped', { roomId: conn.roomId })
      } catch (err) {
        send(ws, 'error', { message: err instanceof Error ? err.message : 'Stop recording failed' })
      }
      break
    }

    case 'raise-hand': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const isRaised = payload.raised as boolean
      let hands = roomHands.get(conn.roomId)
      if (!hands) {
        hands = new Set()
        roomHands.set(conn.roomId, hands)
      }
      if (isRaised) {
        hands.add(conn.peerId)
        playbackManager.addEvent(conn.roomId, 'hand-raise', {
          peerId: conn.peerId,
          displayName: conn.displayName,
        })
      } else {
        hands.delete(conn.peerId)
        playbackManager.addEvent(conn.roomId, 'hand-lower', {
          peerId: conn.peerId,
          displayName: conn.displayName,
        })
      }
      broadcastToRoom(conn.roomId, 'hand-raised', {
        peerId: conn.peerId,
        displayName: conn.displayName,
        raised: isRaised,
      })
      break
    }

    case 'poll-start': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const question = payload.question as string
      const options = payload.options as string[]
      const isAnonymous = payload.isAnonymous as boolean
      const allowMultiple = payload.allowMultiple as boolean

      const poll: Poll = {
        id: uuidv4(),
        question,
        options,
        isAnonymous,
        allowMultiple,
        creatorId: conn.peerId,
        creatorName: conn.displayName,
        votes: new Map(),
        isActive: true,
        createdAt: Date.now(),
      }

      let polls = roomPolls.get(conn.roomId)
      if (!polls) {
        polls = []
        roomPolls.set(conn.roomId, polls)
      }
      polls.push(poll)

      playbackManager.addEvent(conn.roomId, 'poll-start', {
        pollId: poll.id,
        question,
        options,
        creatorId: conn.peerId,
        creatorName: conn.displayName,
      })

      broadcastToRoom(conn.roomId, 'poll-started', {
        pollId: poll.id,
        question,
        options,
        isAnonymous,
        allowMultiple,
        creatorId: conn.peerId,
        creatorName: conn.displayName,
      })
      break
    }

    case 'poll-vote': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const pollId = payload.pollId as string
      const optionIndices = payload.optionIndices as number[]

      const polls = roomPolls.get(conn.roomId)
      if (polls) {
        const poll = polls.find((p) => p.id === pollId && p.isActive)
        if (poll) {
          poll.votes.set(conn.peerId, optionIndices)

          const results = poll.options.map((_, idx) => {
            let count = 0
            for (const votes of poll.votes.values()) {
              if (votes.includes(idx)) count++
            }
            return count
          })

          playbackManager.addEvent(conn.roomId, 'poll-vote', {
            pollId,
            voterId: conn.peerId,
          })

          broadcastToRoom(conn.roomId, 'poll-updated', {
            pollId,
            results,
          })
        }
      }
      break
    }

    case 'poll-end': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const pollId = payload.pollId as string

      const polls = roomPolls.get(conn.roomId)
      if (polls) {
        const poll = polls.find((p) => p.id === pollId && p.isActive)
        if (poll) {
          poll.isActive = false

          const results = poll.options.map((_, idx) => {
            let count = 0
            for (const votes of poll.votes.values()) {
              if (votes.includes(idx)) count++
            }
            return count
          })
          const totalVotes = poll.votes.size

          playbackManager.addEvent(conn.roomId, 'poll-end', {
            pollId,
            results,
          })

          broadcastToRoom(conn.roomId, 'poll-ended', {
            pollId,
            results,
            totalVotes,
          })
        }
      }
      break
    }

    case 'caption': {
      if (!conn.roomId || !conn.peerId) {
        send(ws, 'error', { message: 'Not in a room' })
        return
      }
      const text = payload.text as string
      const captionId = uuidv4()

      playbackManager.addCaption(
        conn.roomId,
        captionId,
        conn.peerId,
        conn.displayName,
        text
      )

      broadcastToRoom(conn.roomId, 'caption', {
        id: captionId,
        peerId: conn.peerId,
        displayName: conn.displayName,
        text,
        timestamp: Date.now(),
      })
      break
    }

    default:
      send(ws, 'error', { message: `Unknown message type: ${type}` })
  }
}
