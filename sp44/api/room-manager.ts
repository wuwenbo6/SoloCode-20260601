import mediasoup from 'mediasoup'
import { v4 as uuidv4 } from 'uuid'
import {
  createWorker,
  mediasoupRouterOptions,
  webRtcTransportOptions,
  plainTransportOptions,
} from './mediasoup-config.js'

interface Peer {
  id: string
  displayName: string
  sendTransport?: mediasoup.types.WebRtcTransport
  recvTransport?: mediasoup.types.WebRtcTransport
  producers: Map<string, mediasoup.types.Producer>
  consumers: Map<string, mediasoup.types.Consumer>
  encryptionKey?: string
}

interface Room {
  id: string
  name: string
  router: mediasoup.types.Router
  peers: Map<string, Peer>
  plainTransport?: mediasoup.types.PlainTransport
  recordingProcess?: ReturnType<typeof import('child_process').spawn>
  recordingFilePath?: string
}

class RoomManager {
  private worker: mediasoup.types.Worker | null = null
  private rooms: Map<string, Room> = new Map()

  async init(): Promise<void> {
    this.worker = await createWorker()
  }

  getWorker(): mediasoup.types.Worker {
    if (!this.worker) {
      throw new Error('Worker not initialized')
    }
    return this.worker
  }

  async createRoom(name: string): Promise<Room> {
    const worker = this.getWorker()
    const router = await worker.createRouter(mediasoupRouterOptions)
    const room: Room = {
      id: uuidv4(),
      name,
      router,
      peers: new Map(),
    }
    this.rooms.set(room.id, room)
    return room
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId)
    if (!room) return false
    for (const peer of room.peers.values()) {
      for (const producer of peer.producers.values()) {
        producer.close()
      }
      for (const consumer of peer.consumers.values()) {
        consumer.close()
      }
      peer.sendTransport?.close()
      peer.recvTransport?.close()
    }
    if (room.recordingProcess) {
      room.recordingProcess.kill('SIGTERM')
    }
    room.plainTransport?.close()
    room.router.close()
    this.rooms.delete(roomId)
    return true
  }

  async joinRoom(roomId: string, peerId: string, displayName: string): Promise<Peer> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    if (room.peers.has(peerId)) throw new Error(`Peer ${peerId} already in room`)
    const peer: Peer = {
      id: peerId,
      displayName,
      producers: new Map(),
      consumers: new Map(),
    }
    room.peers.set(peerId, peer)
    return peer
  }

  leaveRoom(roomId: string, peerId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    const peer = room.peers.get(peerId)
    if (!peer) return false
    for (const producer of peer.producers.values()) {
      producer.close()
    }
    for (const consumer of peer.consumers.values()) {
      consumer.close()
    }
    peer.sendTransport?.close()
    peer.recvTransport?.close()
    room.peers.delete(peerId)
    if (room.peers.size === 0) {
      if (room.recordingProcess) {
        room.recordingProcess.kill('SIGTERM')
        room.recordingProcess = undefined
        room.recordingFilePath = undefined
      }
      room.plainTransport?.close()
      room.plainTransport = undefined
    }
    return true
  }

  getRouterRtpCapabilities(roomId: string): mediasoup.types.RtpCapabilities | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    return room.router.rtpCapabilities
  }

  async createWebRtcTransport(
    roomId: string,
    peerId: string,
    direction: 'send' | 'recv'
  ): Promise<{
    id: string
    iceParameters: mediasoup.types.IceParameters
    iceCandidates: mediasoup.types.IceCandidate[]
    dtlsParameters: mediasoup.types.DtlsParameters
  }> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    const peer = room.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found in room`)

    const transport = await room.router.createWebRtcTransport(webRtcTransportOptions)

    if (direction === 'send') {
      peer.sendTransport = transport
    } else {
      peer.recvTransport = transport
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    }
  }

  async connectTransport(
    roomId: string,
    peerId: string,
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters
  ): Promise<void> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    const peer = room.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found in room`)

    let transport: mediasoup.types.WebRtcTransport | undefined
    if (peer.sendTransport?.id === transportId) {
      transport = peer.sendTransport
    } else if (peer.recvTransport?.id === transportId) {
      transport = peer.recvTransport
    }
    if (!transport) throw new Error(`Transport ${transportId} not found`)
    await transport.connect({ dtlsParameters })
  }

  async produce(
    roomId: string,
    peerId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: mediasoup.types.RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<mediasoup.types.Producer> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    const peer = room.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found in room`)
    if (!peer.sendTransport) throw new Error(`Peer ${peerId} has no send transport`)

    const producer = await peer.sendTransport.produce({
      kind,
      rtpParameters,
      appData: appData ?? {},
    })
    peer.producers.set(producer.id, producer)

    producer.on('transportclose', () => {
      peer.producers.delete(producer.id)
    })

    return producer
  }

  async consume(
    roomId: string,
    peerId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<mediasoup.types.Consumer> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    const peer = room.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found in room`)
    if (!peer.recvTransport) throw new Error(`Peer ${peerId} has no recv transport`)

    const canConsume = room.router.canConsume({ producerId, rtpCapabilities })
    if (!canConsume) throw new Error(`Cannot consume producer ${producerId}`)

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    })
    peer.consumers.set(consumer.id, consumer)

    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id)
    })
    consumer.on('producerclose', () => {
      peer.consumers.delete(consumer.id)
    })

    return consumer
  }

  async resumeConsumer(roomId: string, consumerId: string): Promise<void> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    for (const peer of room.peers.values()) {
      const consumer = peer.consumers.get(consumerId)
      if (consumer) {
        await consumer.resume()
        return
      }
    }
    throw new Error(`Consumer ${consumerId} not found`)
  }

  getPeerProducers(roomId: string, excludePeerId?: string): { peerId: string; producerId: string; kind: mediasoup.types.MediaKind }[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    const result: { peerId: string; producerId: string; kind: mediasoup.types.MediaKind }[] = []
    for (const [peerId, peer] of room.peers) {
      if (peerId === excludePeerId) continue
      for (const producer of peer.producers.values()) {
        result.push({ peerId, producerId: producer.id, kind: producer.kind })
      }
    }
    return result
  }

  setPeerEncryptionKey(roomId: string, peerId: string, key: string): void {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    const peer = room.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found in room`)
    peer.encryptionKey = key
  }

  getPeer(roomId: string, peerId: string): Peer | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    return room.peers.get(peerId)
  }

  getRoomPeers(roomId: string): { id: string; displayName: string }[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    return Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }))
  }

  async createPlainTransport(roomId: string): Promise<mediasoup.types.PlainTransport> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    if (room.plainTransport) return room.plainTransport

    const plainTransport = await room.router.createPlainTransport(plainTransportOptions)
    room.plainTransport = plainTransport
    return plainTransport
  }

  getRoomPlainTransport(roomId: string): mediasoup.types.PlainTransport | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    return room.plainTransport
  }

  setRecordingProcess(roomId: string, process: ReturnType<typeof import('child_process').spawn>, filePath: string): void {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error(`Room ${roomId} not found`)
    room.recordingProcess = process
    room.recordingFilePath = filePath
  }

  getRecordingProcess(roomId: string): { process: ReturnType<typeof import('child_process').spawn>; filePath: string } | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    if (!room.recordingProcess || !room.recordingFilePath) return undefined
    return { process: room.recordingProcess, filePath: room.recordingFilePath }
  }

  clearRecording(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    if (room.recordingProcess) {
      room.recordingProcess.kill('SIGTERM')
      room.recordingProcess = undefined
    }
    room.recordingFilePath = undefined
  }

  closeProducer(roomId: string, producerId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    for (const peer of room.peers.values()) {
      const producer = peer.producers.get(producerId)
      if (producer) {
        producer.close()
        peer.producers.delete(producerId)
        return true
      }
    }
    return false
  }
}

export const roomManager = new RoomManager()
