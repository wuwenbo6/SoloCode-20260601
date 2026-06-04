import type { WebSocket } from 'ws'
import type { types } from 'mediasoup'
import { roomManager } from './room-manager.js'
import { startRecording, stopRecording } from './recording.js'

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
        send(ws, 'recording-stopped', { roomId: conn.roomId, filePath }, msgId)
        broadcastToRoom(conn.roomId, 'recording-stopped', { roomId: conn.roomId })
      } catch (err) {
        send(ws, 'error', { message: err instanceof Error ? err.message : 'Stop recording failed' })
      }
      break
    }

    default:
      send(ws, 'error', { message: `Unknown message type: ${type}` })
  }
}
