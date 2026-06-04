import { ref, readonly } from 'vue'
import type { ConnectionState, ClientMessage, ServerMessage } from '@/types'

const API_BASE = `${window.location.hostname}:4433`
const HEARTBEAT_INTERVAL = 5000
const HEARTBEAT_TIMEOUT = 15000
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const MAX_CONSECUTIVE_FAILURES = 5

export function useWebTransport() {
  const connectionState = ref<ConnectionState>('disconnected')
  const transport = ref<WebTransport | null>(null)
  let readStream: ReadableStreamDefaultReader | null = null
  let writeStream: WritableStreamDefaultWriter | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = INITIAL_RECONNECT_DELAY
  let messageCallback: ((msg: ServerMessage) => void) | null = null
  let shouldReconnect = false
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let lastHeartbeatTime = 0
  let consecutiveFailures = 0
  let heartbeatResponseTimer: ReturnType<typeof setTimeout> | null = null

  function onMessage(cb: (msg: ServerMessage) => void) {
    messageCallback = cb
  }

  function clearHeartbeatTimers() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (heartbeatResponseTimer) {
      clearTimeout(heartbeatResponseTimer)
      heartbeatResponseTimer = null
    }
  }

  function handleHeartbeat(msg: ServerMessage) {
    if (msg.type === 'heartbeat') {
      const payload = msg.payload as { ts: number }
      lastHeartbeatTime = Date.now()
      consecutiveFailures = 0
      reconnectDelay = INITIAL_RECONNECT_DELAY

      if (heartbeatResponseTimer) {
        clearTimeout(heartbeatResponseTimer)
      }

      send({
        type: 'heartbeat_ack',
        payload: { ts: payload.ts, rtt: Date.now() - payload.ts },
      })
    }
  }

  function startHeartbeatMonitoring() {
    clearHeartbeatTimers()
    lastHeartbeatTime = Date.now()

    heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastHeartbeatTime > HEARTBEAT_TIMEOUT) {
        consecutiveFailures++
        console.warn(`Heartbeat timeout (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`)
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error('Too many heartbeat failures, closing connection')
          forceReconnect()
        }
      }
    }, HEARTBEAT_INTERVAL)
  }

  function forceReconnect() {
    clearHeartbeatTimers()
    if (transport.value) {
      try { transport.value.close() } catch { /* ignore */ }
      transport.value = null
    }
    connectionState.value = 'disconnected'
    if (shouldReconnect) {
      scheduleReconnect(`wts://${API_BASE}/sensor-stream`)
    }
  }

  async function connect(url?: string) {
    const transportUrl = url || `wts://${API_BASE}/sensor-stream`
    shouldReconnect = true

    try {
      connectionState.value = 'connecting'
      
      const transportOptions: WebTransportOptions = {
        serverCertificateHashes: [
          {
            algorithm: 'sha-256',
            value: new Uint8Array(32),
          },
        ],
      }

      transport.value = new WebTransport(transportUrl, {
        ...transportOptions,
      })

      await transport.value.ready

      connectionState.value = 'connected'
      reconnectDelay = INITIAL_RECONNECT_DELAY
      consecutiveFailures = 0
      console.log('WebTransport connected successfully')

      transport.value.closed
        .then(() => {
          console.log('WebTransport closed gracefully')
          handleDisconnect(transportUrl)
        })
        .catch((err) => {
          console.warn('WebTransport closed with error:', err)
          handleDisconnect(transportUrl)
        })

      startHeartbeatMonitoring()
      await setupStreams()
    } catch (err) {
      console.error('WebTransport connection failed:', err)
      connectionState.value = 'disconnected'
      if (shouldReconnect) {
        scheduleReconnect(transportUrl)
      }
    }
  }

  async function setupStreams() {
    if (!transport.value) return

    try {
      const stream = await transport.value.createBidirectionalStream()
      readStream = stream.readable.getReader()
      writeStream = stream.writable.getWriter()

      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!readStream) break

        const { value, done } = await readStream.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg: ServerMessage = JSON.parse(line)
            handleHeartbeat(msg)
            messageCallback?.(msg)
          } catch (e) {
            console.warn('Failed to parse message:', e)
          }
        }
      }
    } catch (err) {
      console.warn('Stream error:', err)
    }
  }

  function handleDisconnect(url: string) {
    clearHeartbeatTimers()
    connectionState.value = 'disconnected'
    readStream = null
    writeStream = null
    
    if (shouldReconnect) {
      scheduleReconnect(url)
    }
  }

  function scheduleReconnect(url: string) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    connectionState.value = 'reconnecting'
    
    const delay = Math.min(reconnectDelay * Math.pow(1.5, consecutiveFailures), MAX_RECONNECT_DELAY)
    console.log(`Scheduling reconnect in ${delay}ms (attempt ${consecutiveFailures + 1})`)

    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
      connect(url)
    }, delay)
  }

  async function send(message: ClientMessage) {
    if (!writeStream || connectionState.value !== 'connected') return
    try {
      const encoder = new TextEncoder()
      await writeStream.write(encoder.encode(JSON.stringify(message) + '\n'))
    } catch (err) {
      console.warn('Failed to send message:', err)
    }
  }

  function disconnect() {
    shouldReconnect = false
    clearHeartbeatTimers()
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    readStream?.cancel().catch(() => {})
    writeStream?.close().catch(() => {})
    readStream = null
    writeStream = null

    if (transport.value) {
      try { transport.value.close() } catch { /* ignore */ }
    }
    transport.value = null
    connectionState.value = 'disconnected'
    reconnectDelay = INITIAL_RECONNECT_DELAY
    consecutiveFailures = 0
  }

  function resetReconnectDelay() {
    reconnectDelay = INITIAL_RECONNECT_DELAY
    consecutiveFailures = 0
  }

  return {
    connectionState: readonly(connectionState),
    connect,
    disconnect,
    send,
    onMessage,
    resetReconnectDelay,
    consecutiveFailures: () => consecutiveFailures,
  }
}
