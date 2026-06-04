import { H264Encoder } from './H264Encoder'

type EventCallback = (data?: any) => void

export class WebTransportSender {
  private url: string
  private transport: WebTransport | null = null
  private encoder: H264Encoder | null = null
  private eventHandlers: Map<string, EventCallback[]> = new Map()
  private connected: boolean = false
  private videoStream: WebTransportBidirectionalStream | null = null
  private eventStream: WebTransportBidirectionalStream | null = null
  private reader: ReadableStreamDefaultReader | null = null

  constructor(url: string) {
    this.url = url
  }

  on(event: string, callback: EventCallback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(callback)
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(cb => cb(data))
    }
  }

  async connect() {
    try {
      this.transport = new WebTransport(this.url, {
        serverCertificateHashes: [
          {
            algorithm: 'sha-256',
            value: new Uint8Array(32)
          }
        ]
      } as any)
      
      await this.transport.ready
      this.connected = true
      this.emit('connected')
      
      await this.setupStreams()
      this.startListening()
      
    } catch (error) {
      console.error('WebTransport connection failed:', error)
      throw error
    }
  }

  private async setupStreams() {
    if (!this.transport) return

    try {
      this.videoStream = await this.transport.createBidirectionalStream()
      this.eventStream = await this.transport.createBidirectionalStream()
    } catch (error) {
      console.error('Failed to create streams:', error)
      throw error
    }
  }

  private async startListening() {
    if (!this.eventStream) return

    try {
      this.reader = this.eventStream.readable.getReader()
      
      while (true) {
        const { value, done } = await this.reader.read()
        if (done) break
        
        if (value) {
          const textDecoder = new TextDecoder()
          const message = textDecoder.decode(value)
          try {
            const data = JSON.parse(message)

            if (data.type === 'clipboard') {
              this.emit('clipboard', data.payload)
            } else if (data.type === 'whiteboard') {
              this.emit('whiteboard', data.payload)
            } else {
              this.emit('event', data)
            }
          } catch (e) {
            console.error('Failed to parse event:', e)
          }
        }
      }
    } catch (error) {
      console.error('Listening error:', error)
    }
  }

  isConnected() {
    return this.connected
  }

  async startEncoding(stream: MediaStream) {
    if (!this.videoStream) return

    const videoTrack = stream.getVideoTracks()[0]
    const settings = videoTrack.getSettings()
    
    this.encoder = new H264Encoder({
      width: settings.width || 1920,
      height: settings.height || 1080,
      bitrate: 5_000_000,
      framerate: 30,
    })

    this.encoder.onChunk(async (chunk, _meta) => {
      if (!this.videoStream) return
      
      try {
        const writer = this.videoStream.writable.getWriter()
        
        const chunkData = new Uint8Array(chunk.byteLength)
        chunk.copyTo(chunkData)
        
        const metaData = new TextEncoder().encode(JSON.stringify({
          type: 'video',
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          keyframe: chunk.type === 'key',
          chunkSize: chunkData.byteLength
        }))
        
        const header = new Uint8Array(8)
        new DataView(header.buffer).setUint32(0, metaData.length, false)
        new DataView(header.buffer).setUint32(4, chunkData.byteLength, false)
        
        const packet = new Uint8Array(8 + metaData.length + chunkData.byteLength)
        packet.set(header, 0)
        packet.set(metaData, 8)
        packet.set(chunkData, 8 + metaData.length)
        
        await writer.write(packet)
        writer.releaseLock()
      } catch (error) {
        console.error('Failed to send video chunk:', error)
      }
    })

    await this.encoder.start(stream)
  }

  stopEncoding() {
    if (this.encoder) {
      this.encoder.stop()
      this.encoder = null
    }
  }

  async sendControl(data: any) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'control',
        payload: data
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send control:', error)
    }
  }

  async sendCursor(data: { x: number; y: number; visible: boolean }) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'cursor',
        payload: data
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send cursor:', error)
    }
  }

  async sendClipboard(text: string) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'clipboard',
        payload: { text }
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send clipboard:', error)
    }
  }

  async sendWhiteboard(action: any) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'whiteboard',
        payload: action
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send whiteboard:', error)
    }
  }

  getEncoderStats() {
    if (this.encoder && typeof (this.encoder as any).getCurrentStats === 'function') {
      return (this.encoder as any).getCurrentStats()
    }
    return null
  }

  disconnect() {
    this.stopEncoding()
    
    if (this.reader) {
      this.reader.releaseLock()
      this.reader = null
    }

    if (this.videoStream) {
      this.videoStream.writable.close().catch(() => {})
      this.videoStream = null
    }
    
    if (this.eventStream) {
      this.eventStream.writable.close().catch(() => {})
      this.eventStream = null
    }
    
    if (this.transport) {
      this.transport.close()
      this.transport = null
    }
    
    this.connected = false
    this.emit('disconnected')
  }
}
