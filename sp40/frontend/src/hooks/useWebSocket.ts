import { useCallback, useEffect, useRef } from 'react'
import { useRobotStore } from '@/store/robotStore'
import type { PathPoint } from '@/types'

const WS_URL = 'ws://localhost:8080/ws'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latencyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pingsRef = useRef<Map<number, number>>(new Map())
  const bytesReceivedRef = useRef(0)
  const lastThroughputCheckRef = useRef(Date.now())

  const setConnection = useRobotStore((s) => s.setConnection)
  const setWS = useRobotStore((s) => s.setWS)
  const updateFromSensorData = useRobotStore((s) => s.updateFromSensorData)
  const updateFromVideoFrame = useRobotStore((s) => s.updateFromVideoFrame)
  const setRobots = useRobotStore((s) => s.setRobots)
  const setSelectedRobot = useRobotStore((s) => s.setSelectedRobot)
  const setObstacles = useRobotStore((s) => s.setObstacles)
  const setWaypoints = useRobotStore((s) => s.setWaypoints)
  const setRecordings = useRobotStore((s) => s.setRecordings)
  const setPlaybackState = useRobotStore((s) => s.setPlaybackState)
  const isPlaying = useRobotStore((s) => s.isPlaying)

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const getRobots = useCallback(() => {
    sendMessage({ type: 'getRobots' })
  }, [sendMessage])

  const selectRobot = useCallback(
    (robotId: string) => {
      sendMessage({ type: 'selectRobot', robotId })
      setSelectedRobot(robotId)
    },
    [sendMessage, setSelectedRobot]
  )

  const getObstacles = useCallback(() => {
    sendMessage({ type: 'getObstacles' })
  }, [sendMessage])

  const requestPath = useCallback(
    (target: { x: number; y: number }) => {
      const selectedRobotId = useRobotStore.getState().selectedRobotId
      if (selectedRobotId) {
        sendMessage({
          type: 'pathPlan',
          robotId: selectedRobotId,
          target,
        })
      }
    },
    [sendMessage]
  )

  const sendWaypoints = useCallback(
    (waypoints: PathPoint[], autoMode: boolean = false) => {
      const selectedRobotId = useRobotStore.getState().selectedRobotId
      if (selectedRobotId) {
        sendMessage({
          type: 'setWaypoints',
          robotId: selectedRobotId,
          waypoints,
          autoMode,
        })
      }
    },
    [sendMessage]
  )

  const controlRecording = useCallback(
    (action: 'start' | 'stop' | 'list' | 'play' | 'pause', recordingId?: string, frameIndex?: number) => {
      const selectedRobotId = useRobotStore.getState().selectedRobotId
      const msg: Record<string, unknown> = {
        type: 'recording',
        action,
        robotId: selectedRobotId,
      }
      if (recordingId !== undefined) msg.recordingId = recordingId
      if (frameIndex !== undefined) msg.frameIndex = frameIndex
      sendMessage(msg)
    },
    [sendMessage]
  )

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    setConnection({ status: 'connecting' })

    try {
      const ws = new WebSocket(WS_URL)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws
      setWS(ws)

      ws.onopen = () => {
        setConnection({ status: 'connected' })
        useRobotStore.setState({ connectionStartTime: Date.now() })

        latencyIntervalRef.current = setInterval(() => {
          const id = Date.now()
          pingsRef.current.set(id, Date.now())
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', id }))
          }
        }, 1000)

        setTimeout(() => {
          getRobots()
          getObstacles()
          controlRecording('list')
        }, 500)
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data)
          if (data[0] === 'V'.charCodeAt(0)) {
            bytesReceivedRef.current += data.length
            const header = new TextDecoder().decode(data.slice(1, 13))
            const isPlayback = header.startsWith('PLAYBACK')
            const jpegData = data.slice(13)
            const blob = new Blob([jpegData], { type: 'image/jpeg' })
            const url = URL.createObjectURL(blob)
            if (isPlayback) {
              const frameIdxMatch = header.match(/FRM(\d+)/)
              const frameIdx = frameIdxMatch ? parseInt(frameIdxMatch[1]) : 0
              setPlaybackState({
                playbackFrameData: url,
                playbackFrameIndex: frameIdx,
              })
            } else {
              updateFromVideoFrame(url)
            }
          }
        } else {
          bytesReceivedRef.current += event.data.length

          const now = Date.now()
          if (now - lastThroughputCheckRef.current >= 1000) {
            const throughput = bytesReceivedRef.current
            setConnection({ throughput })
            bytesReceivedRef.current = 0
            lastThroughputCheckRef.current = now
          }

          try {
            const msg = JSON.parse(event.data)

            if (msg.type === 'pong') {
              const pingTime = pingsRef.current.get(msg.id)
              if (pingTime) {
                const latency = Date.now() - pingTime
                setConnection({ latency })
                pingsRef.current.delete(msg.id)
              }
              return
            }

            if (msg.type === 'sensor') {
              updateFromSensorData(msg)
            } else if (msg.type === 'video') {
              if (!isPlaying) {
                updateFromVideoFrame(msg.data)
              }
            } else if (msg.type === 'robotList') {
              setRobots(msg.robots)
              const state = useRobotStore.getState()
              if (!state.selectedRobotId && msg.robots.length > 0) {
                setSelectedRobot(msg.robots[0].id)
              }
            } else if (msg.type === 'obstacleList') {
              setObstacles(msg.obstacles)
            } else if (msg.type === 'pathPlanResult') {
              if (msg.success && msg.waypoints) {
                setWaypoints(msg.waypoints)
              }
            } else if (msg.type === 'recordingList') {
              setRecordings(msg.recordings)
            }
          } catch (e) {
            console.error('parse error:', e)
          }
        }
      }

      ws.onerror = () => {
        setConnection({ status: 'error' })
      }

      ws.onclose = () => {
        setConnection({ status: 'disconnected' })
        setWS(null)
        wsRef.current = null

        if (latencyIntervalRef.current) {
          clearInterval(latencyIntervalRef.current)
          latencyIntervalRef.current = null
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 1000)
      }
    } catch (e) {
      console.error('connection error:', e)
      setConnection({ status: 'error' })
    }
  }, [
    setConnection,
    setWS,
    updateFromSensorData,
    updateFromVideoFrame,
    setRobots,
    setSelectedRobot,
    setObstacles,
    setWaypoints,
    setRecordings,
    setPlaybackState,
    getRobots,
    getObstacles,
    controlRecording,
    isPlaying,
  ])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current)
      latencyIntervalRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setWS(null)
    setConnection({ status: 'disconnected', latency: 0, throughput: 0 })
    pingsRef.current.clear()
  }, [setConnection, setWS])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    getRobots,
    selectRobot,
    getObstacles,
    requestPath,
    sendWaypoints,
    controlRecording,
  }
}
