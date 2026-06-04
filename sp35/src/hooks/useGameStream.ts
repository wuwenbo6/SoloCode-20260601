import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useGameStore } from '@/stores/gameStore'
import type { GameObject, ClientMessage, VideoFrame, StreamStatsPayload, FECFrame, RetransmittedFrame, JoystickMessage, ButtonMessage, InputEventMessage, RecordingFrame, QualityLevel } from '../../shared/types'
import { parseServerMessage, createBitrateFeedback, createKeyframeRequest, createNackRequest, resetSequence, createQualityChangeRequest } from '@/utils/protocol'
import { FECDecoder } from '@/utils/fec-decoder'
import { DeadReckoning } from '@/utils/dead-reckoning'

export function useGameStream() {
  const [frameObjects, setFrameObjects] = useState<GameObject[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const lastFrameIdRef = useRef(0)
  const framesReceivedRef = useRef(0)
  const framesLostRef = useRef(0)
  const lastFeedbackRef = useRef(Date.now())
  const rttRef = useRef(0)
  const lastPingRef = useRef(0)
  const nackSentRef = useRef(0)
  const fecDecoderRef = useRef<FECDecoder | null>(null)
  const deadReckoningRef = useRef<DeadReckoning | null>(null)
  const fecRecoveredRef = useRef(0)
  const nackRecoveredRef = useRef(0)
  const pendingNackRef = useRef<Set<number>>(new Set())
  const fecGroupIdRef = useRef(0)
  const fecGroupIndexRef = useRef(0)
  const fecGroupSize = 4

  const setConnectionState = useGameStore((s) => s.setConnectionState)
  const setStreamStats = useGameStore((s) => s.setStreamStats)
  const addRecordingFrame = useGameStore((s) => s.addRecordingFrame)
  const isRecording = useGameStore((s) => s.isRecording)
  const currentFrameRef = useRef<GameObject[]>([])
  const serverPlayerXRef = useRef(640)

  if (!fecDecoderRef.current) {
    fecDecoderRef.current = new FECDecoder()
  }
  if (!deadReckoningRef.current) {
    deadReckoningRef.current = new DeadReckoning()
    deadReckoningRef.current.setGameDimensions(1280)
    deadReckoningRef.current.setPlayerSize(40)
  }

  const applyDeadReckoning = useCallback((objects: GameObject[]): GameObject[] => {
    if (!deadReckoningRef.current) return objects

    const dr = deadReckoningRef.current

    const hasPlayer = objects.some(o => o.type === 'player')
    if (!hasPlayer) return objects

    let lastInputSeq = 0
    for (const obj of objects) {
      if (obj.type === 'player') {
        serverPlayerXRef.current = obj.x
        lastInputSeq = (obj as GameObject & { lastProcessedInput: number }).lastProcessedInput || 0
        dr.setServerPosition(obj.x, obj.y, lastInputSeq)
        break
      }
    }

    const newObjects: GameObject[] = []
    for (const obj of objects) {
      if (obj.type === 'player') {
        const predictedX = dr.getPredictedPosition().x
        const weight = Math.min(1, rttRef.current / 200)
        const smoothX = obj.x + (predictedX - obj.x) * weight
        newObjects.push({ ...obj, x: smoothX })
      } else {
        newObjects.push(obj)
      }
    }

    return newObjects
  }, [])

  const connect = useCallback(() => {
    resetSequence()
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:3001/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    if (fecDecoderRef.current) {
      fecDecoderRef.current.reset()
    }
    if (deadReckoningRef.current) {
      deadReckoningRef.current.reset()
    }
    lastFrameIdRef.current = 0
    pendingNackRef.current.clear()
    fecGroupIdRef.current = 0
    fecGroupIndexRef.current = 0

    ws.onopen = () => {
      setConnected(true)
      setConnectionState({ webrtc: 'connected', webtransport: 'connected' })
      lastPingRef.current = Date.now()
    }

    ws.onclose = () => {
      setConnected(false)
      setConnectionState({ webrtc: 'disconnected', webtransport: 'disconnected' })
      setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      const msg = parseServerMessage(event.data)
      if (!msg) return

      if (msg.type === 'frame') {
        const frame = msg.payload as VideoFrame
        let objects: GameObject[]

        if (frame.isKeyframe) {
          objects = frame.objects
          currentFrameRef.current = objects
          pendingNackRef.current.clear()
        } else {
          objects = frame.objects
          currentFrameRef.current = objects
        }

        const fecGroupId = fecGroupIdRef.current
        const fecIndex = fecGroupIndexRef.current
        fecGroupIndexRef.current = (fecGroupIndexRef.current + 1) % fecGroupSize
        if (fecGroupIndexRef.current === 0) {
          fecGroupIdRef.current++
        }

        if (fecDecoderRef.current) {
          fecDecoderRef.current.addFrame(frame, fecGroupId, fecIndex, fecGroupSize)
        }

        const displayObjects = applyDeadReckoning(objects)
        setFrameObjects(displayObjects)

        if (isRecording) {
          const recordingFrame: RecordingFrame = {
            frameId: frame.frameId,
            timestamp: Date.now(),
            objects: displayObjects,
            width: frame.width,
            height: frame.height,
          }
          addRecordingFrame(recordingFrame)
        }

        if (lastFrameIdRef.current > 0 && frame.frameId > lastFrameIdRef.current + 1) {
          const missingIds: number[] = []
          for (let i = lastFrameIdRef.current + 1; i < frame.frameId; i++) {
            if (!pendingNackRef.current.has(i)) {
              missingIds.push(i)
              pendingNackRef.current.add(i)
              framesLostRef.current++
            }
          }
          if (missingIds.length > 0 && missingIds.length <= 3) {
            ws.send(JSON.stringify(createNackRequest(missingIds)))
            nackSentRef.current++
          } else if (missingIds.length > 3) {
            ws.send(JSON.stringify(createKeyframeRequest(lastFrameIdRef.current)))
          }
        }

        for (let i = lastFrameIdRef.current + 1; i <= frame.frameId; i++) {
          pendingNackRef.current.delete(i)
        }

        lastFrameIdRef.current = frame.frameId
        framesReceivedRef.current++

        rttRef.current = Date.now() - lastPingRef.current
        lastPingRef.current = Date.now()
        if (deadReckoningRef.current) {
          deadReckoningRef.current.setRTT(rttRef.current)
        }

        const now = Date.now()
        if (now - lastFeedbackRef.current > 2000) {
          const totalFrames = framesReceivedRef.current + framesLostRef.current
          const packetLoss = totalFrames > 0 ? framesLostRef.current / totalFrames : 0
          ws.send(JSON.stringify(createBitrateFeedback(4000, packetLoss, rttRef.current)))
          setStreamStats({
            packetLoss,
            rtt: rttRef.current,
            fecRecovered: fecDecoderRef.current?.getRecoveredCount() || 0,
            nackRecovered: nackRecoveredRef.current,
          })
          lastFeedbackRef.current = now
          framesReceivedRef.current = 0
          framesLostRef.current = 0
        }
      }

      if (msg.type === 'fec-repair') {
        const fecFrame = msg as FECFrame
        if (fecDecoderRef.current) {
          const recovered = fecDecoderRef.current.addRepairFrame(fecFrame)
          if (recovered) {
            fecRecoveredRef.current++
            const displayObjects = applyDeadReckoning(recovered.objects)
            setFrameObjects(displayObjects)
            pendingNackRef.current.delete(recovered.frameId)
          }
        }
      }

      if (msg.type === 'retransmitted-frame') {
        const retrans = msg as RetransmittedFrame
        const frame = retrans.payload
        nackRecoveredRef.current++
        pendingNackRef.current.delete(frame.frameId)

        const displayObjects = applyDeadReckoning(frame.objects)
        setFrameObjects(displayObjects)

        if (frame.frameId > lastFrameIdRef.current) {
          lastFrameIdRef.current = frame.frameId
        }
      }

      if (msg.type === 'stats') {
        const stats = msg.payload as StreamStatsPayload
        setStreamStats({
          ...stats,
          fecRecovered: fecRecoveredRef.current,
          nackRecovered: nackRecoveredRef.current,
          rtt: rttRef.current,
        })
      }
    }
  }, [applyDeadReckoning, setConnectionState, setStreamStats])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
    if (deadReckoningRef.current && (msg.type === 'keydown' || msg.type === 'keyup' || msg.type === 'joystick' || msg.type === 'button' || msg.type === 'mousemove')) {
      deadReckoningRef.current.addInput(msg as JoystickMessage | ButtonMessage | InputEventMessage)
    }
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
  }, [])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  const predictedPosition = useMemo(() => {
    return deadReckoningRef.current?.getPredictedPosition() || { x: 640, y: 640 }
  }, [])

  return {
    frameObjects,
    connected,
    send,
    disconnect,
    reconnect: connect,
    predictedPosition,
    fecRecovered: fecRecoveredRef.current,
    nackRecovered: nackRecoveredRef.current,
    rtt: rttRef.current,
  }
}
