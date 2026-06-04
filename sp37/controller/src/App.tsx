import { useState, useEffect, useRef, useCallback } from 'react'
import RemoteScreen from './components/RemoteScreen'
import { WebTransportReceiver } from './utils/WebTransportReceiver'
import { H264Decoder } from './utils/H264Decoder'
import { ClipboardSync } from './utils/ClipboardSync'
import { SessionRecorder } from './utils/SessionRecorder'
import { SessionPlayer, PlaybackState } from './utils/SessionPlayer'
import './App.css'

interface DisplayOption {
  id: string
  label: string
  width?: number
  height?: number
}

type AppMode = 'live' | 'playback'

function App() {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('未连接')
  const [remoteWidth, setRemoteWidth] = useState(1920)
  const [remoteHeight, setRemoteHeight] = useState(1080)
  const [cursorX, setCursorX] = useState(0)
  const [cursorY, setCursorY] = useState(0)
  const [cursorVisible, setCursorVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [stats, setStats] = useState({ fps: 0, latency: 0 })
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const [currentDisplay, setCurrentDisplay] = useState('')
  const [clipboardText, setClipboardText] = useState('')
  const [whiteboardActive, setWhiteboardActive] = useState(false)
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [mode, setMode] = useState<AppMode>('live')
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    frameIndex: 0,
    totalFrames: 0,
  })
  const [showRecordingPanel, setShowRecordingPanel] = useState(false)
  const [showPlaybackPanel, setShowPlaybackPanel] = useState(false)
  const receiverRef = useRef<WebTransportReceiver | null>(null)
  const decoderRef = useRef<H264Decoder | null>(null)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())
  const containerRef = useRef<HTMLDivElement>(null)
  const displayMenuRef = useRef<HTMLDivElement>(null)
  const clipboardSyncRef = useRef<ClipboardSync | null>(null)
  const sessionRecorderRef = useRef<SessionRecorder | null>(null)
  const sessionPlayerRef = useRef<SessionPlayer | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const clipboardSync = new ClipboardSync()
    clipboardSyncRef.current = clipboardSync

    clipboardSync.onClipboardUpdate((text: string, direction: 'to-remote' | 'to-controller') => {
      setClipboardText(text)
      if (direction === 'to-remote' && receiverRef.current?.isConnected()) {
        receiverRef.current.sendClipboard(text)
      }
    })

    clipboardSync.startListening()

    return () => {
      clipboardSync.dispose()
    }
  }, [])

  useEffect(() => {
    const recorder = new SessionRecorder()
    sessionRecorderRef.current = recorder

    const player = new SessionPlayer()
    sessionPlayerRef.current = player

    player.onStateUpdate((state) => {
      setPlaybackState(state)
    })

    return () => {
      recorder.stop()
      player.dispose()
    }
  }, [])

  const setupReceiverEvents = useCallback((receiver: WebTransportReceiver) => {
    receiver.on('connected', () => {
      setConnected(true)
      setStatus('已连接 - 等待发送端...')
    })

    receiver.on('disconnected', () => {
      setConnected(false)
      setStatus('已断开连接')
    })

    receiver.on('error', (error: string) => {
      setStatus(`错误: ${error}`)
    })

    receiver.on('cursor', (data: { x: number; y: number; visible: boolean }) => {
      setCursorX(data.x)
      setCursorY(data.y)
      setCursorVisible(data.visible)
    })

    receiver.on('control', (data: any) => {
      if (data.type === 'init') {
        setRemoteWidth(data.width || 1920)
        setRemoteHeight(data.height || 1080)
        setCursorVisible(data.cursorVisible ?? true)
        setCurrentDisplay(data.displaySurface || 'monitor')
        setStatus('正在接收画面')

        const decoder = new H264Decoder({
          width: data.width || 1920,
          height: data.height || 1080,
        })

        decoder.onFrame(() => {
          frameCountRef.current++
          const now = performance.now()
          if (now - lastFpsTimeRef.current >= 1000) {
            setStats(prev => ({
              ...prev,
              fps: frameCountRef.current
            }))
            frameCountRef.current = 0
            lastFpsTimeRef.current = now
          }
        })

        decoderRef.current = decoder
        receiver.setDecoder(decoder)
        receiver.updateResolution(data.width || 1920, data.height || 1080)

        decoder.init().catch(console.error)
      }

      if (data.type === 'displays') {
        setDisplays(data.displays || [])
      }
    })

    receiver.on('clipboard', (payload: any) => {
      if (payload?.text && clipboardSyncRef.current) {
        clipboardSyncRef.current.handleRemoteClipboard(payload.text)
      }
    })

    receiver.on('whiteboard', (_payload: any) => {
      // whiteboard handled by WhiteboardCanvas via callback
    })
  }, [])

  useEffect(() => {
    if (mode !== 'live') return

    const receiver = new WebTransportReceiver('https://localhost:4433/ws?type=receiver')
    receiverRef.current = receiver

    setupReceiverEvents(receiver)

    receiver.connect().catch((error) => {
      setStatus(`连接失败: ${error}`)
    })

    return () => {
      receiver.disconnect()
    }
  }, [mode, setupReceiverEvents])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setShowDisplayMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseEvent = useCallback((event: any) => {
    if (mode !== 'live') return
    if (receiverRef.current?.isConnected()) {
      receiverRef.current.sendMouseEvent(event)
    }
  }, [mode])

  const handleKeyboardEvent = useCallback((event: any) => {
    if (mode !== 'live') return
    if (receiverRef.current?.isConnected()) {
      receiverRef.current.sendKeyboardEvent(event)
    }
  }, [mode])

  const handleWhiteboardAction = useCallback((action: any) => {
    if (mode !== 'live') return
    if (receiverRef.current?.isConnected()) {
      receiverRef.current.sendWhiteboard(action)
    }

    if (sessionRecorderRef.current?.isRecording()) {
      sessionRecorderRef.current.recordEvent('whiteboard', action)
    }
  }, [mode])

  const handleSwitchDisplay = useCallback((displayId: string) => {
    if (receiverRef.current?.isConnected()) {
      receiverRef.current.sendControl({
        type: 'switch_display',
        displayId
      })
      setShowDisplayMenu(false)
      setCurrentDisplay(displayId)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleReconnect = useCallback(async () => {
    if (receiverRef.current) {
      receiverRef.current.disconnect()
    }

    setStatus('正在重连...')

    const receiver = new WebTransportReceiver('https://localhost:4433/ws?type=receiver')
    receiverRef.current = receiver

    setupReceiverEvents(receiver)

    try {
      await receiver.connect()
    } catch (error) {
      setStatus(`重连失败: ${error}`)
    }
  }, [setupReceiverEvents])

  const toggleRecording = useCallback(() => {
    const recorder = sessionRecorderRef.current
    if (!recorder) return

    if (!isRecording) {
      recorder.start(remoteWidth, remoteHeight)
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(recorder.getDurationMs())
      }, 1000)
    } else {
      const recording = recorder.stop()
      setIsRecording(false)

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      if (recording) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        SessionRecorder.exportToFile(recording, `session-${timestamp}.rcd`)
      }
    }
  }, [isRecording, remoteWidth, remoteHeight])

  const handleLoadRecording = useCallback(async (file: File) => {
    try {
      const recording = await SessionRecorder.loadFromFile(file)
      const player = sessionPlayerRef.current
      if (!player) return

      setMode('playback')
      setShowPlaybackPanel(true)
      await player.load(recording)
      setStatus(`已加载录像: ${recording.metadata.width}x${recording.metadata.height}, ${Math.round(recording.metadata.duration / 1000)}s`)
    } catch (error) {
      setStatus(`加载录像失败: ${error}`)
    }
  }, [])

  const handlePlaybackPlay = useCallback(() => {
    sessionPlayerRef.current?.play()
  }, [])

  const handlePlaybackPause = useCallback(() => {
    sessionPlayerRef.current?.pause()
  }, [])

  const handlePlaybackSeek = useCallback((timeMs: number) => {
    sessionPlayerRef.current?.seekTo(timeMs)
  }, [])

  const handlePlaybackSpeed = useCallback((speed: number) => {
    sessionPlayerRef.current?.setPlaybackSpeed(speed)
  }, [])

  const handleBackToLive = useCallback(() => {
    sessionPlayerRef.current?.pause()
    setMode('live')
    setShowPlaybackPanel(false)
    setStatus('已连接 - 等待发送端...')
  }, [])

  const handlePasteToRemote = useCallback(() => {
    if (clipboardText && receiverRef.current?.isConnected()) {
      receiverRef.current.sendClipboard(clipboardText)
    }
  }, [clipboardText])

  const formatDuration = (ms: number): string => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="app" ref={containerRef}>
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="toolbar-title">远程桌面控制</h1>
          <span className={`status-indicator ${connected ? 'online' : 'offline'}`}>
            {connected ? '●' : '○'}
          </span>
          <span className="status-text">{status}</span>
          {mode === 'playback' && (
            <span className="mode-badge playback">回放模式</span>
          )}
          {isRecording && (
            <span className="mode-badge recording">
              ● REC {formatDuration(recordingDuration)}
            </span>
          )}
        </div>
        <div className="toolbar-right">
          <span className="stat-badge">{stats.fps} FPS</span>
          <span className="stat-badge">{remoteWidth}×{remoteHeight}</span>

          {displays.length > 0 && mode === 'live' && (
            <div className="display-switcher" ref={displayMenuRef}>
              <button
                className="toolbar-btn"
                onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                title="切换显示器"
              >
                🖴 {currentDisplay || '显示器'}
              </button>
              {showDisplayMenu && (
                <div className="display-menu">
                  <div className="display-menu-header">切换显示器</div>
                  {displays.map((d) => (
                    <button
                      key={d.id}
                      className={`display-menu-item ${d.id === currentDisplay ? 'active' : ''}`}
                      onClick={() => handleSwitchDisplay(d.id)}
                    >
                      <span className="display-menu-name">{d.label}</span>
                      {d.width && d.height && (
                        <span className="display-menu-res">{d.width}×{d.height}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className={`toolbar-btn ${whiteboardActive ? 'active' : ''}`}
            onClick={() => setWhiteboardActive(!whiteboardActive)}
            title="白板模式"
          >
            ✏️
          </button>

          {whiteboardActive && (
            <div className="toolbar-tool-group">
              <button
                className={`toolbar-btn tool-btn ${whiteboardTool === 'pen' ? 'active' : ''}`}
                onClick={() => setWhiteboardTool('pen')}
                title="画笔"
              >
                🖊️
              </button>
              <button
                className={`toolbar-btn tool-btn ${whiteboardTool === 'highlighter' ? 'active' : ''}`}
                onClick={() => setWhiteboardTool('highlighter')}
                title="荧光笔"
              >
                🖍️
              </button>
              <button
                className={`toolbar-btn tool-btn ${whiteboardTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setWhiteboardTool('eraser')}
                title="橡皮擦"
              >
                🧹
              </button>
            </div>
          )}

          <button
            className={`toolbar-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? '停止录制' : '开始录制'}
            disabled={mode !== 'live'}
          >
            {isRecording ? '⏹' : '⏺'}
          </button>

          <button
            className="toolbar-btn"
            onClick={() => setShowRecordingPanel(!showRecordingPanel)}
            title="录制管理"
          >
            📁
          </button>

          <button
            className="toolbar-btn"
            onClick={() => {
              setClipboardText('')
              navigator.clipboard.readText().then(t => setClipboardText(t)).catch(() => {})
            }}
            title="剪贴板"
          >
            📋
          </button>

          <button className="toolbar-btn" onClick={toggleFullscreen} title="全屏">
            {fullscreen ? '⬜' : '⬛'}
          </button>
          <button className="toolbar-btn" onClick={handleReconnect} title="重连" disabled={mode === 'playback'}>
            ↻
          </button>
        </div>
      </div>

      {whiteboardActive && (
        <div className="whiteboard-toolbar">
          <div className="color-palette">
            {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'].map(c => (
              <button
                key={c}
                className="color-btn"
                style={{ backgroundColor: c }}
                onClick={() => {
                  // handled via WhiteboardCanvas props
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="screen-area">
        {mode === 'live' && connected ? (
          <RemoteScreen
            receiver={receiverRef.current}
            remoteWidth={remoteWidth}
            remoteHeight={remoteHeight}
            onMouseEvent={handleMouseEvent}
            onKeyboardEvent={handleKeyboardEvent}
            cursorX={cursorX}
            cursorY={cursorY}
            cursorVisible={cursorVisible}
            whiteboardActive={whiteboardActive}
            whiteboardTool={whiteboardTool}
            onWhiteboardAction={handleWhiteboardAction}
            sessionRecorder={sessionRecorderRef.current}
            isRecording={isRecording}
          />
        ) : mode === 'playback' ? (
          <div className="playback-area">
            <canvas ref={(el) => {
              if (el && sessionPlayerRef.current) {
                sessionPlayerRef.current.mount(el)
              }
            }} className="playback-canvas" />
          </div>
        ) : (
          <div className="disconnected-overlay">
            <div className="disconnected-content">
              <div className="disconnected-icon">🖥️</div>
              <h2>未连接到远程桌面</h2>
              <p>请确保发送端和服务器正在运行</p>
              <button className="btn btn-primary" onClick={handleReconnect}>
                重新连接
              </button>
            </div>
          </div>
        )}
      </div>

      {showPlaybackPanel && mode === 'playback' && (
        <div className="playback-panel">
          <div className="playback-controls">
            <button className="playback-btn" onClick={handleBackToLive} title="返回直播">
              ← 直播
            </button>
            {!playbackState.playing ? (
              <button className="playback-btn play" onClick={handlePlaybackPlay} title="播放">
                ▶
              </button>
            ) : (
              <button className="playback-btn pause" onClick={handlePlaybackPause} title="暂停">
                ⏸
              </button>
            )}
            <span className="playback-time">
              {formatDuration(playbackState.currentTime)} / {formatDuration(playbackState.duration)}
            </span>
            <input
              type="range"
              className="playback-seek"
              min={0}
              max={playbackState.duration || 0}
              value={playbackState.currentTime}
              onChange={(e) => handlePlaybackSeek(Number(e.target.value))}
            />
            <select
              className="playback-speed"
              value={sessionPlayerRef.current?.getPlaybackSpeed() ?? 1}
              onChange={(e) => handlePlaybackSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
            <span className="playback-frame-info">
              {playbackState.frameIndex} / {playbackState.totalFrames}
            </span>
          </div>
        </div>
      )}

      {showRecordingPanel && (
        <div className="recording-panel">
          <div className="recording-panel-header">
            <h3>录制管理</h3>
            <button className="toolbar-btn" onClick={() => setShowRecordingPanel(false)}>✕</button>
          </div>
          <div className="recording-panel-body">
            <div className="recording-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.click()
                }}
              >
                加载录像文件
              </button>
              <input
                ref={fileInputRef as any}
                type="file"
                accept=".rcd,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLoadRecording(file)
                }}
              />
            </div>
            {isRecording && (
              <div className="recording-info">
                <span className="recording-dot">●</span>
                正在录制 {formatDuration(recordingDuration)}
                <span className="recording-frames">
                  {sessionRecorderRef.current?.getFrameCount() ?? 0} 帧,
                  {sessionRecorderRef.current?.getEventCount() ?? 0} 事件
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {clipboardText && (
        <div className="clipboard-toast">
          <span className="clipboard-toast-text">
            剪贴板: {clipboardText.length > 50 ? clipboardText.slice(0, 50) + '...' : clipboardText}
          </span>
          <button
            className="clipboard-toast-btn"
            onClick={handlePasteToRemote}
            disabled={!connected}
          >
            发送到远程
          </button>
          <button className="clipboard-toast-close" onClick={() => setClipboardText('')}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default App
