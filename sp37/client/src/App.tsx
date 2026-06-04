import { useState, useEffect, useRef, useCallback } from 'react'
import ScreenCapture from './components/ScreenCapture'
import { WebTransportSender } from './utils/WebTransportSender'
import { CursorTracker } from './utils/CursorTracker'
import { ClipboardSync } from './utils/ClipboardSync'
import { WhiteboardOverlay, WhiteboardAction } from './utils/WhiteboardOverlay'
import './App.css'

interface DisplayInfo {
  id: string
  label: string
  width?: number
  height?: number
}

function App() {
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('未连接')
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedDisplay, setSelectedDisplay] = useState<string>('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(null)
  const [encoderStats, setEncoderStats] = useState<any>(null)
  const [clipboardText, setClipboardText] = useState('')
  const [whiteboardVisible, setWhiteboardVisible] = useState(false)
  const senderRef = useRef<WebTransportSender | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cursorTrackerRef = useRef<CursorTracker | null>(null)
  const statsIntervalRef = useRef<number | null>(null)
  const clipboardSyncRef = useRef<ClipboardSync | null>(null)
  const whiteboardRef = useRef<WhiteboardOverlay | null>(null)
  const screenContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const initSender = async () => {
      try {
        const sender = new WebTransportSender('https://localhost:4433/ws?type=sender')
        senderRef.current = sender

        sender.on('connected', () => {
          setConnected(true)
          setStatus('已连接到服务器')
        })

        sender.on('disconnected', () => {
          setConnected(false)
          setStreaming(false)
          setStatus('已断开连接')
        })

        sender.on('error', (error: string) => {
          setStatus(`错误: ${error}`)
        })

        sender.on('event', (data: any) => {
          if (data.type === 'control' && data.payload?.type === 'switch_display') {
            handleSwitchDisplay(data.payload.displayId)
          }
        })

        sender.on('clipboard', (payload: any) => {
          if (payload?.text) {
            if (clipboardSyncRef.current) {
              clipboardSyncRef.current.handleRemoteClipboard(payload.text)
            }
          }
        })

        sender.on('whiteboard', (payload: WhiteboardAction) => {
          if (whiteboardRef.current) {
            whiteboardRef.current.applyAction(payload)
          }
        })

        await sender.connect()
      } catch (error) {
        setStatus(`连接失败: ${error}`)
      }
    }

    initSender()

    return () => {
      if (senderRef.current) {
        senderRef.current.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    const clipboardSync = new ClipboardSync()
    clipboardSyncRef.current = clipboardSync

    clipboardSync.onRemoteClipboardUpdate((text, direction) => {
      setClipboardText(text)
      if (direction === 'to-remote' && senderRef.current?.isConnected()) {
        senderRef.current.sendClipboard(text)
      }
    })

    clipboardSync.startListening()

    return () => {
      clipboardSync.dispose()
    }
  }, [])

  const getDisplays = useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      const track = tempStream.getVideoTracks()[0]
      const settings = track.getSettings()
      
      const displayList: DisplayInfo[] = []
      
      if (settings.displaySurface) {
        displayList.push({
          id: 'current',
          label: `当前屏幕 (${settings.displaySurface})`,
          width: settings.width,
          height: settings.height,
        })
      }

      if (settings.deviceId) {
        displayList.push({
          id: settings.deviceId,
          label: `显示器 ${settings.deviceId.slice(0, 8)}`,
          width: settings.width,
          height: settings.height,
        })
      }

      if (displayList.length === 0) {
        displayList.push({
          id: 'default',
          label: '默认显示器',
          width: settings.width,
          height: settings.height,
        })
      }

      setDisplays(displayList)
      tempStream.getTracks().forEach(t => t.stop())
    } catch {
      setDisplays([])
    }
  }, [])

  useEffect(() => {
    getDisplays()
  }, [getDisplays])

  const startCursorTracking = useCallback(() => {
    if (!resolution) return

    if (cursorTrackerRef.current) {
      cursorTrackerRef.current.stop()
    }

    const tracker = new CursorTracker({
      remoteWidth: resolution.w,
      remoteHeight: resolution.h,
      onCursorUpdate: (x: number, y: number, visible: boolean) => {
        if (senderRef.current?.isConnected()) {
          senderRef.current.sendCursor({ x, y, visible })
        }
      }
    })

    tracker.start()
    cursorTrackerRef.current = tracker

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
    }
    statsIntervalRef.current = window.setInterval(() => {
      if (senderRef.current) {
        const stats = senderRef.current.getEncoderStats()
        if (stats) {
          setEncoderStats(stats)
        }
      }
    }, 1000)
  }, [resolution])

  const stopCursorTracking = useCallback(() => {
    if (cursorTrackerRef.current) {
      cursorTrackerRef.current.stop()
      cursorTrackerRef.current = null
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
      statsIntervalRef.current = null
    }
  }, [])

  const initWhiteboard = useCallback(() => {
    if (!resolution) return

    if (whiteboardRef.current) {
      whiteboardRef.current.dispose()
    }

    const overlay = new WhiteboardOverlay(resolution.w, resolution.h)
    whiteboardRef.current = overlay

    if (screenContainerRef.current) {
      overlay.mount(screenContainerRef.current)
    }

    if (whiteboardVisible) {
      overlay.show()
    }
  }, [resolution, whiteboardVisible])

  useEffect(() => {
    if (whiteboardRef.current && resolution) {
      whiteboardRef.current.resize(resolution.w, resolution.h)
    }
  }, [resolution])

  const startStreaming = async () => {
    if (!senderRef.current || !senderRef.current.isConnected()) {
      setStatus('请先连接到服务器')
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          cursor: cursorVisible ? 'always' : 'never',
          displaySurface: 'monitor' as DisplayCaptureSurfaceType,
        } as MediaTrackConstraints,
      }

      if (selectedDisplay && selectedDisplay !== 'default' && selectedDisplay !== 'current') {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: selectedDisplay }
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)

      streamRef.current = stream
      setStreaming(true)
      setStatus('正在推流...')

      const videoTrack = stream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()
      const w = settings.width || 1920
      const h = settings.height || 1080
      setResolution({ w, h })

      senderRef.current!.sendControl({
        type: 'init',
        width: w,
        height: h,
        cursorVisible,
        displaySurface: settings.displaySurface,
      })

      senderRef.current!.startEncoding(stream)

      startCursorTracking()
      initWhiteboard()

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopStreaming()
      })
    } catch (error) {
      setStatus(`开始推流失败: ${error}`)
    }
  }

  const stopStreaming = () => {
    stopCursorTracking()

    if (whiteboardRef.current) {
      whiteboardRef.current.dispose()
      whiteboardRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (senderRef.current) {
      senderRef.current.stopEncoding()
      senderRef.current.sendControl({ type: 'stop' })
    }

    setStreaming(false)
    setResolution(null)
    setWhiteboardVisible(false)
    setStatus('已停止推流')
  }

  const handleSwitchDisplay = async (displayId: string) => {
    if (streaming) {
      stopStreaming()
      await new Promise(r => setTimeout(r, 200))
      setSelectedDisplay(displayId)
      await new Promise(r => setTimeout(r, 100))
      startStreaming()
    }
  }

  const handleSelectDisplay = (displayId: string) => {
    setSelectedDisplay(displayId)
    if (streaming) {
      handleSwitchDisplay(displayId)
    }
  }

  const handlePasteToRemote = useCallback(() => {
    if (clipboardText && senderRef.current?.isConnected()) {
      senderRef.current.sendClipboard(clipboardText)
    }
  }, [clipboardText])

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>远程桌面 - 发送端</h1>
          <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {status}
          </div>
        </header>

        <div className="controls">
          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={cursorVisible}
                onChange={(e) => setCursorVisible(e.target.checked)}
                disabled={streaming}
              />
              <span>捕获光标（将光标包含在画面中）</span>
            </label>
            <p className="hint">
              关闭后，控制端将显示远程光标叠加层代替本地光标
            </p>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={whiteboardVisible}
                onChange={(e) => {
                  setWhiteboardVisible(e.target.checked)
                  if (whiteboardRef.current) {
                    if (e.target.checked) {
                      whiteboardRef.current.show()
                    } else {
                      whiteboardRef.current.hide()
                    }
                  }
                }}
                disabled={!streaming}
              />
              <span>显示白板标注（远程同步）</span>
            </label>
          </div>

          <div className="control-group">
            <label className="select-label">选择显示器</label>
            <div className="display-grid">
              <button
                className={`display-card ${selectedDisplay === '' ? 'selected' : ''}`}
                onClick={() => handleSelectDisplay('')}
                disabled={streaming}
              >
                <span className="display-icon">🖥️</span>
                <span className="display-name">自动选择</span>
                <span className="display-info">系统默认显示器</span>
              </button>
              {displays.map((display) => (
                <button
                  key={display.id}
                  className={`display-card ${selectedDisplay === display.id ? 'selected' : ''}`}
                  onClick={() => handleSelectDisplay(display.id)}
                  disabled={streaming}
                >
                  <span className="display-icon">🖵</span>
                  <span className="display-name">{display.label}</span>
                  {display.width && display.height && (
                    <span className="display-info">{display.width}×{display.height}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <button
              className="btn btn-detect"
              onClick={getDisplays}
              disabled={streaming}
            >
              重新检测显示器
            </button>
          </div>

          <div className="button-group">
            {!streaming ? (
              <button
                className="btn btn-primary"
                onClick={startStreaming}
                disabled={!connected}
              >
                开始推流
              </button>
            ) : (
              <button
                className="btn btn-danger"
                onClick={stopStreaming}
              >
                停止推流
              </button>
            )}
          </div>

          <div className="clipboard-section">
            <h3 className="section-title">剪贴板同步</h3>
            <div className="clipboard-controls">
              <input
                type="text"
                className="clipboard-input"
                placeholder="输入文本同步到控制端..."
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
              />
              <button
                className="btn btn-clipboard"
                onClick={handlePasteToRemote}
                disabled={!clipboardText || !connected}
              >
                发送到控制端
              </button>
            </div>
            <p className="hint">本地复制(Ctrl+C)的文本会自动同步到控制端</p>
          </div>

          {encoderStats && streaming && (
            <div className="stats-panel">
              <div className="stats-title">编码统计</div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">分辨率</span>
                  <span className="stat-value">{encoderStats.width}×{encoderStats.height}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">帧率</span>
                  <span className="stat-value">{encoderStats.fps} FPS</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">码率</span>
                  <span className="stat-value">{Math.round(encoderStats.bitrate / 1000)} kbps</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">编码耗时</span>
                  <span className="stat-value">{encoderStats.avgEncodeTime.toFixed(1)} ms</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已处理</span>
                  <span className="stat-value">{encoderStats.processedFrames} 帧</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已丢弃</span>
                  <span className="stat-value">{encoderStats.droppedFrames} 帧</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {streaming && streamRef.current && (
          <div className="preview-section">
            <div className="preview-header">
              <h3>屏幕预览</h3>
              {resolution && (
                <span className="resolution-badge">
                  {resolution.w}×{resolution.h}
                </span>
              )}
            </div>
            <div ref={screenContainerRef} className="preview-container">
              <ScreenCapture stream={streamRef.current} />
            </div>
          </div>
        )}

        <div className="info-section">
          <h3>连接信息</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">服务器</span>
              <span className="info-value">localhost:4433</span>
            </div>
            <div className="info-item">
              <span className="info-label">状态</span>
              <span className="info-value">{connected ? '在线' : '离线'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">推流</span>
              <span className="info-value">{streaming ? '进行中' : '未开始'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">光标模式</span>
              <span className="info-value">{cursorVisible ? '捕获' : '远程叠加'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">白板</span>
              <span className="info-value">{whiteboardVisible ? '显示' : '隐藏'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">剪贴板</span>
              <span className="info-value">{clipboardText ? '有内容' : '空'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
