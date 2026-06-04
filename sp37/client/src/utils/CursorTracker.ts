interface CursorTrackerConfig {
  remoteWidth: number
  remoteHeight: number
  onCursorUpdate: (x: number, y: number, visible: boolean) => void
}

export class CursorTracker {
  private config: CursorTrackerConfig
  private overlay: HTMLElement | null = null
  private cursorX: number = 0
  private cursorY: number = 0
  private visible: boolean = true
  private lastSendTime: number = 0
  private sendIntervalMs: number = 16
  private isTracking: boolean = false
  private animationFrameId: number | null = null
  private pendingX: number | null = null
  private pendingY: number | null = null

  constructor(config: CursorTrackerConfig) {
    this.config = config
  }

  updateConfig(config: Partial<CursorTrackerConfig>) {
    this.config = { ...this.config, ...config }
  }

  start() {
    if (this.isTracking) return

    this.createOverlay()
    this.attachListeners()
    this.isTracking = true

    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick)
      this.maybeSend()
    }
    this.animationFrameId = requestAnimationFrame(tick)
  }

  stop() {
    this.isTracking = false

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.detachListeners()
    this.removeOverlay()
  }

  setVisible(visible: boolean) {
    this.visible = visible
    this.forceSend()
  }

  forceSend() {
    this.config.onCursorUpdate(this.cursorX, this.cursorY, this.visible)
    this.lastSendTime = performance.now()
  }

  private createOverlay() {
    if (this.overlay) return

    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647',
    })

    document.documentElement.appendChild(this.overlay)
  }

  private removeOverlay() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
      this.overlay = null
    }
  }

  private attachListeners() {
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseenter', this.handleMouseEnter)
    document.addEventListener('mouseleave', this.handleMouseLeave)
  }

  private detachListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseenter', this.handleMouseEnter)
    document.removeEventListener('mouseleave', this.handleMouseLeave)
  }

  private handleMouseMove = (e: MouseEvent) => {
    const screenX = e.screenX
    const screenY = e.screenY

    const displayWidth = window.screen.width
    const displayHeight = window.screen.height

    if (displayWidth > 0 && displayHeight > 0) {
      const scaleX = this.config.remoteWidth / displayWidth
      const scaleY = this.config.remoteHeight / displayHeight

      this.pendingX = Math.max(0, Math.min(this.config.remoteWidth, Math.round(screenX * scaleX)))
      this.pendingY = Math.max(0, Math.min(this.config.remoteHeight, Math.round(screenY * scaleY)))
    }
  }

  private handleMouseEnter = () => {
    this.visible = true
    this.forceSend()
  }

  private handleMouseLeave = () => {
    this.visible = true
    this.forceSend()
  }

  private maybeSend() {
    if (!this.isTracking) return

    const now = performance.now()
    if (now - this.lastSendTime < this.sendIntervalMs) return

    if (this.pendingX !== null && this.pendingY !== null) {
      this.cursorX = this.pendingX
      this.cursorY = this.pendingY
      this.pendingX = null
      this.pendingY = null

      this.config.onCursorUpdate(this.cursorX, this.cursorY, this.visible)
      this.lastSendTime = now
    }
  }

  getPosition() {
    return {
      x: this.cursorX,
      y: this.cursorY,
      visible: this.visible,
    }
  }

  setSendInterval(ms: number) {
    this.sendIntervalMs = Math.max(8, ms)
  }
}
