import { useEffect, useRef, useCallback, useState } from 'react'
import { H264Decoder } from '../utils/H264Decoder'
import { InputCapture } from '../utils/InputCapture'
import { WebTransportReceiver } from '../utils/WebTransportReceiver'
import { CursorInterpolator } from '../utils/CursorInterpolator'
import { WhiteboardCanvas, WhiteboardAction } from '../utils/WhiteboardCanvas'
import { SessionRecorder } from '../utils/SessionRecorder'

interface RemoteScreenProps {
  receiver: WebTransportReceiver | null
  remoteWidth: number
  remoteHeight: number
  onMouseEvent: (event: any) => void
  onKeyboardEvent: (event: any) => void
  cursorX: number
  cursorY: number
  cursorVisible: boolean
  whiteboardActive: boolean
  whiteboardTool: 'pen' | 'highlighter' | 'eraser'
  onWhiteboardAction: (action: WhiteboardAction) => void
  sessionRecorder: SessionRecorder | null
  isRecording: boolean
}

export default function RemoteScreen({
  receiver,
  remoteWidth,
  remoteHeight,
  onMouseEvent,
  onKeyboardEvent,
  cursorX,
  cursorY,
  cursorVisible,
  whiteboardActive,
  whiteboardTool,
  onWhiteboardAction,
  sessionRecorder: _sessionRecorder,
  isRecording: _isRecording,
}: RemoteScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const decoderRef = useRef<H264Decoder | null>(null)
  const inputCaptureRef = useRef<InputCapture | null>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorInterpolatorRef = useRef<CursorInterpolator | null>(null)
  const displaySizeRef = useRef({ width: 0, height: 0 })
  const whiteboardRef = useRef<WhiteboardCanvas | null>(null)
  const [_interpolatedCursor, setInterpolatedCursor] = useState({ x: 0, y: 0, visible: true })
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 0, height: 0 })

  const getVideoFitRect = useCallback(() => {
    if (!containerRef.current || remoteWidth === 0 || remoteHeight === 0) {
      return { left: 0, top: 0, width: 0, height: 0, scale: 1 }
    }

    const container = containerRef.current.getBoundingClientRect()
    const cw = container.width
    const ch = container.height
    const iw = displaySizeRef.current.width || remoteWidth
    const ih = displaySizeRef.current.height || remoteHeight

    const scale = Math.min(cw / iw, ch / ih)
    const width = iw * scale
    const height = ih * scale
    const left = (cw - width) / 2
    const top = (ch - height) / 2

    return { left, top, width, height, scale }
  }, [remoteWidth, remoteHeight])

  const remoteToScreen = useCallback((remoteX: number, remoteY: number) => {
    const rect = getVideoFitRect()
    if (rect.width === 0 || rect.height === 0) {
      return { x: remoteX, y: remoteY }
    }
    
    const scaleX = rect.width / (displaySizeRef.current.width || remoteWidth)
    const scaleY = rect.height / (displaySizeRef.current.height || remoteHeight)
    
    return {
      x: rect.left + remoteX * scaleX,
      y: rect.top + remoteY * scaleY
    }
  }, [getVideoFitRect, remoteWidth, remoteHeight])

  const drawCursor = useCallback((x: number, y: number, visible: boolean) => {
    const canvas = cursorCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const containerRect = container.getBoundingClientRect()
    if (canvas.width !== containerRect.width || canvas.height !== containerRect.height) {
      canvas.width = containerRect.width
      canvas.height = containerRect.height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!visible) return

    const screenPos = remoteToScreen(x, y)
    const cx = screenPos.x
    const cy = screenPos.y

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy + 22)
    ctx.lineTo(cx + 6, cy + 17)
    ctx.lineTo(cx + 12, cy + 26)
    ctx.lineTo(cx + 16, cy + 24)
    ctx.lineTo(cx + 10, cy + 15)
    ctx.lineTo(cx + 17, cy + 15)
    ctx.closePath()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 4
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [remoteToScreen])

  useEffect(() => {
    if (!canvasRef.current) return

    const decoder = new H264Decoder({
      width: remoteWidth || 1920,
      height: remoteHeight || 1080,
    })

    decoder.onFrame((frame: VideoFrame) => {
      const canvas = canvasRef.current
      if (!canvas) {
        frame.close()
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        frame.close()
        return
      }

      const container = containerRef.current
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const iw = frame.displayWidth
        const ih = frame.displayHeight
        const scale = Math.min(containerRect.width / iw, containerRect.height / ih)
        
        const displayWidth = iw * scale
        const displayHeight = ih * scale
        
        displaySizeRef.current = { width: displayWidth, height: displayHeight }
        setVideoDisplaySize({ width: displayWidth, height: displayHeight })
        
        if (canvas.width !== iw || canvas.height !== ih) {
          canvas.width = iw
          canvas.height = ih
        }

        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`
        canvas.style.left = `${(containerRect.width - displayWidth) / 2}px`
        canvas.style.top = `${(containerRect.height - displayHeight) / 2}px`
        canvas.style.position = 'absolute'

        if (whiteboardRef.current) {
          whiteboardRef.current.setDisplayRect(
            (containerRect.width - displayWidth) / 2,
            (containerRect.height - displayHeight) / 2,
            displayWidth,
            displayHeight
          )
        }
      } else {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
          canvas.width = frame.displayWidth
          canvas.height = frame.displayHeight
        }
      }

      ctx.drawImage(frame, 0, 0)
      frame.close()
    })

    decoderRef.current = decoder

    if (receiver) {
      receiver.setDecoder(decoder)
    }

    return () => {
      decoder.stop()
    }
  }, [receiver, remoteWidth, remoteHeight])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const inputCapture = new InputCapture(canvasRef.current, containerRef.current)
    inputCapture.setRemoteSize(remoteWidth, remoteHeight)
    inputCapture.setVideoSize(
      displaySizeRef.current.width || remoteWidth,
      displaySizeRef.current.height || remoteHeight
    )
    inputCapture.setScaleMode('contain')
    inputCapture.setOnMouseEvent(onMouseEvent)
    inputCapture.setOnKeyboardEvent(onKeyboardEvent)
    inputCapture.start()

    inputCaptureRef.current = inputCapture

    return () => {
      inputCapture.stop()
    }
  }, [remoteWidth, remoteHeight, onMouseEvent, onKeyboardEvent])

  useEffect(() => {
    if (inputCaptureRef.current) {
      inputCaptureRef.current.setVideoSize(
        videoDisplaySize.width || remoteWidth,
        videoDisplaySize.height || remoteHeight
      )
    }
  }, [videoDisplaySize, remoteWidth, remoteHeight])

  useEffect(() => {
    if (!cursorInterpolatorRef.current) {
      cursorInterpolatorRef.current = new CursorInterpolator((x, y, visible) => {
        setInterpolatedCursor({ x, y, visible })
        drawCursor(x, y, visible)
      })
    }

    return () => {
      if (cursorInterpolatorRef.current) {
        cursorInterpolatorRef.current.dispose()
        cursorInterpolatorRef.current = null
      }
    }
  }, [drawCursor])

  useEffect(() => {
    if (cursorInterpolatorRef.current) {
      cursorInterpolatorRef.current.updateTarget(cursorX, cursorY, cursorVisible)
    }
  }, [cursorX, cursorY, cursorVisible])

  useEffect(() => {
    const onResize = () => {
      if (cursorInterpolatorRef.current) {
        const current = cursorInterpolatorRef.current.getCurrent()
        drawCursor(current.x, current.y, current.visible)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawCursor])

  useEffect(() => {
    if (!containerRef.current) return

    if (whiteboardRef.current) {
      whiteboardRef.current.dispose()
      whiteboardRef.current = null
    }

    const wb = new WhiteboardCanvas()
    wb.setRemoteSize(remoteWidth, remoteHeight)
    wb.onAction((action) => {
      onWhiteboardAction(action)
    })
    wb.mount(containerRef.current)
    whiteboardRef.current = wb

    return () => {
      wb.dispose()
      whiteboardRef.current = null
    }
  }, [remoteWidth, remoteHeight, onWhiteboardAction])

  useEffect(() => {
    if (!whiteboardRef.current) return

    if (whiteboardActive) {
      whiteboardRef.current.activate()
      whiteboardRef.current.setTool(whiteboardTool)
    } else {
      whiteboardRef.current.deactivate()
    }
  }, [whiteboardActive, whiteboardTool])

  useEffect(() => {
    if (whiteboardRef.current && whiteboardActive) {
      whiteboardRef.current.setTool(whiteboardTool)
    }
  }, [whiteboardTool, whiteboardActive])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    if (!receiver) return

    const handleWhiteboard = (payload: WhiteboardAction) => {
      if (whiteboardRef.current) {
        whiteboardRef.current.applyRemoteAction(payload)
      }
    }

    receiver.on('whiteboard', handleWhiteboard)

    return () => {
      receiver.off('whiteboard', handleWhiteboard)
    }
  }, [receiver])

  return (
    <div className="remote-screen-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="remote-canvas"
        onContextMenu={handleContextMenu}
      />
      <canvas
        ref={cursorCanvasRef}
        className="cursor-canvas"
        onContextMenu={handleContextMenu}
      />
    </div>
  )
}
