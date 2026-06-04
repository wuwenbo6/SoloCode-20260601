import { useEffect, useRef, useCallback } from 'react'
import { useSimulatorStore, type SIPEvent } from '@/utils/sip'

interface WSMessage {
  type: 'state_change' | 'log' | 'error' | 'reset'
  payload: Record<string, unknown>
}

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const {
    setCurrentState,
    addStateChange,
    addLog,
    setError,
    setConnected,
  } = useSimulatorStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      setError(null)
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
    }

    ws.onmessage = (event) => {
      const lines = event.data.split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const msg: WSMessage = JSON.parse(line)
          handleMessage(msg)
        } catch {
          // ignore parse errors
        }
      }
    }

    wsRef.current = ws
  }, [url, setCurrentState, addStateChange, addLog, setError, setConnected])

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      switch (msg.type) {
        case 'state_change': {
          const payload = msg.payload as {
            from: string
            to: string
            event: string
            timestamp: number
          }
          setCurrentState(payload.to as SIPEvent as never)
          addStateChange({
            from: payload.from as never,
            to: payload.to as never,
            event: payload.event as SIPEvent,
            timestamp: payload.timestamp,
          })
          break
        }
        case 'log': {
          const payload = msg.payload as {
            direction: string
            messageType: string
            content: string
            timestamp: number
          }
          addLog({
            direction: payload.direction as never,
            messageType: payload.messageType,
            content: payload.content,
            timestamp: payload.timestamp,
            id: `${payload.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          })
          break
        }
        case 'error': {
          const payload = msg.payload as { message: string }
          setError(payload.message)
          setTimeout(() => setError(null), 4000)
          break
        }
        case 'reset': {
          const payload = msg.payload as { state: string }
          setCurrentState(payload.state as never)
          break
        }
      }
    },
    [setCurrentState, addStateChange, addLog, setError]
  )

  const sendEvent = useCallback((event: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({
        type: 'event',
        payload: { event },
      })
      wsRef.current.send(msg)
    }
  }, [])

  const reset = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({
        type: 'event',
        payload: { event: 'reset' },
      })
      wsRef.current.send(msg)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { sendEvent, reset }
}
