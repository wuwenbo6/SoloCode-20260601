import { H264Decoder } from './H264Decoder'

type EventCallback = (data?: any) => void

interface VideoChunkInfo {
  type: 'video'
  timestamp: number
  duration: number | undefined
  keyframe: boolean
  chunkSize: number
  meta?: any
}

interface ReceiverStats {
  framesReceived: number
  framesDropped: number
  bytesReceived: number
  avgLatencyMs: number
  currentResolution: { width: number; height: number }
}

export class WebTransportReceiver {
  private url: string
  private transport: WebTransport | null = null
  private videoStream: WebTransportBidirectionalStream | null = null
  private eventStream: WebTransportBidirectionalStream | null = null
  private decoder: H264Decoder | null = null
  private eventHandlers: Map<string, EventCallback[]> = new Map()
  private connected: boolean = false
  private receiving: boolean = false
  private videoReader: ReadableStreamDefaultReader | null = null
  private eventReader: ReadableStreamDefaultReader | null = null
  private currentWidth: number = 0
  private currentHeight: number = 0
  private stats: ReceiverStats = {
    framesReceived: 0,
    framesDropped: 0,
    bytesReceived: 0,
    avgLatencyMs: 0,
    currentResolution: { width: 0, height: 0 },
  }

  constructor(url: string) {
    this.url = url
  }

  on(event: string, callback: EventCallback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(callback)
  }

  off(event: string, callback: EventCallback) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(callback)
      if (idx >= 0) handlers.splice(idx, 1)
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(cb => cb(data))
    }
  }

  async connect() {
    try {
      this.transport = new WebTransport(this.url)

      this.transport.closed.then(() => {
        this.connected = false
        this.emit('disconnected')
      }).catch((error) => {
        this.connected = false
        this.emit('error', error?.message || 'Connection closed with error')
      })

      await this.transport.ready
      this.connected = true
      this.emit('connected')

      await this.setupStreams()
      this.startReceivingVideo()
      this.startReceivingEvents()
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

  private async startReceivingVideo() {
    if (!this.videoStream) return

    this.receiving = true
    this.videoReader = this.videoStream.readable.getReader()

    try {
      let buffer = new Uint8Array(0)

      while (this.receiving) {
        const { value, done } = await this.videoReader.read()
        if (done) break
        if (!value) continue

        const newBuffer = new Uint8Array(buffer.length + value.length)
        newBuffer.set(buffer)
        newBuffer.set(value, buffer.length)
        buffer = newBuffer

        while (buffer.length >= 8) {
          const metaLength = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0, false)
          const chunkLength = new DataView(buffer.buffer, buffer.byteOffset + 4, 4).getUint32(0, false)
          
          const totalRequired = 8 + metaLength + chunkLength
          if (buffer.length < totalRequired) break
          
          const metaData = buffer.slice(8, 8 + metaLength)
          const chunkInfo: VideoChunkInfo = JSON.parse(new TextDecoder().decode(metaData))
          
          const chunkData = buffer.slice(8 + metaLength, 8 + metaLength + chunkLength)

          if (chunkInfo.type === 'video' && this.decoder && this.decoder.isInitialized()) {
            this.decoder.decode(
              chunkData,
              chunkInfo.timestamp,
              chunkInfo.duration,
              chunkInfo.keyframe
            )
          }

          buffer = buffer.slice(totalRequired)
        }
      }
    } catch (error) {
      console.error('Video receiving error:', error)
    }
  }

  private async startReceivingEvents() {
    if (!this.eventStream) return

    this.eventReader = this.eventStream.readable.getReader()

    try {
      while (this.receiving) {
        const { value, done } = await this.eventReader.read()
        if (done) break
        if (!value) continue

        const message = new TextDecoder().decode(value)
        try {
          const data = JSON.parse(message)
          
          if (data.type === 'cursor') {
            this.emit('cursor', data.payload)
          } else if (data.type === 'control') {
            this.emit('control', data.payload)
          } else if (data.type === 'clipboard') {
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
    } catch (error) {
      console.error('Event receiving error:', error)
    }
  }

  setDecoder(decoder: H264Decoder) {
    this.decoder = decoder
  }

  updateResolution(width: number, height: number) {
    if (this.currentWidth === width && this.currentHeight === height) return

    this.currentWidth = width
    this.currentHeight = height
    this.stats.currentResolution = { width, height }

    if (this.decoder) {
      this.decoder.updateConfig(width, height)
    }
  }

  getStats(): ReceiverStats {
    return { ...this.stats }
  }

  async sendMouseEvent(event: {
    x: number
    y: number
    button: number
    buttons: number
    movementX: number
    movementY: number
    deltaX: number
    deltaY: number
    event: string
  }) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'mouse',
        payload: event
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send mouse event:', error)
    }
  }

  async sendKeyboardEvent(event: {
    key: string
    code: string
    shiftKey: boolean
    ctrlKey: boolean
    altKey: boolean
    metaKey: boolean
    repeat: boolean
    event: string
  }) {
    if (!this.eventStream) return

    try {
      const writer = this.eventStream.writable.getWriter()
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'keyboard',
        payload: event
      }))
      await writer.write(message)
      writer.releaseLock()
    } catch (error) {
      console.error('Failed to send keyboard event:', error)
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

  isConnected() {
    return this.connected
  }

  disconnect() {
    this.receiving = false

    if (this.videoReader) {
      this.videoReader.releaseLock()
      this.videoReader = null
    }

    if (this.eventReader) {
      this.eventReader.releaseLock()
      this.eventReader = null
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
