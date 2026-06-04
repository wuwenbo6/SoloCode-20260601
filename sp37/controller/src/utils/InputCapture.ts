interface CursorPosition {
  x: number
  y: number
  visible: boolean
}

export class InputCapture {
  private canvas: HTMLCanvasElement
  private container: HTMLElement
  private remoteWidth: number = 0
  private remoteHeight: number = 0
  private videoWidth: number = 0
  private videoHeight: number = 0
  private scaleMode: 'contain' | 'cover' | 'stretch' = 'contain'
  private onMouseEvent: ((event: any) => void) | null = null
  private onKeyboardEvent: ((event: any) => void) | null = null
  private cursorHidden: boolean = false
  private boundHandlers: { [key: string]: EventListener } = {}
  private lastMoveTime: number = 0
  private moveThrottleMs: number = 8

  constructor(canvas: HTMLCanvasElement, container?: HTMLElement) {
    this.canvas = canvas
    this.container = container || canvas.parentElement || canvas
  }

  setRemoteSize(width: number, height: number) {
    this.remoteWidth = width
    this.remoteHeight = height
  }

  setVideoSize(width: number, height: number) {
    this.videoWidth = width
    this.videoHeight = height
  }

  setScaleMode(mode: 'contain' | 'cover' | 'stretch') {
    this.scaleMode = mode
  }

  setOnMouseEvent(handler: (event: any) => void) {
    this.onMouseEvent = handler
  }

  setOnKeyboardEvent(handler: (event: any) => void) {
    this.onKeyboardEvent = handler
  }

  updateRemoteCursor(_position: CursorPosition) {
  }

  private getVideoRect(): { left: number; top: number; width: number; height: number } {
    const containerRect = this.container.getBoundingClientRect()
    const cw = containerRect.width
    const ch = containerRect.height
    const iw = this.videoWidth || this.remoteWidth || cw
    const ih = this.videoHeight || this.remoteHeight || ch

    let scale: number
    let width: number
    let height: number

    if (this.scaleMode === 'stretch') {
      scale = 1
      width = cw
      height = ch
    } else if (this.scaleMode === 'cover') {
      scale = Math.max(cw / iw, ch / ih)
      width = iw * scale
      height = ih * scale
    } else {
      scale = Math.min(cw / iw, ch / ih)
      width = iw * scale
      height = ih * scale
    }

    const left = containerRect.left + (cw - width) / 2
    const top = containerRect.top + (ch - height) / 2

    return { left, top, width, height }
  }

  private getRelativePosition(clientX: number, clientY: number): { x: number; y: number } {
    const vr = this.getVideoRect()

    let x: number
    let y: number

    if (vr.width > 0 && vr.height > 0) {
      const relX = clientX - vr.left
      const relY = clientY - vr.top

      x = Math.max(0, Math.min(this.remoteWidth, Math.round(relX * (this.remoteWidth / vr.width))))
      y = Math.max(0, Math.min(this.remoteHeight, Math.round(relY * (this.remoteHeight / vr.height))))
    } else {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = this.remoteWidth / rect.width
      const scaleY = this.remoteHeight / rect.height

      x = Math.max(0, Math.min(this.remoteWidth, Math.round((clientX - rect.left) * scaleX)))
      y = Math.max(0, Math.min(this.remoteHeight, Math.round((clientY - rect.top) * scaleY)))
    }

    return { x, y }
  }

  hideLocalCursor() {
    if (!this.cursorHidden) {
      this.canvas.style.cursor = 'none'
      this.cursorHidden = true
    }
  }

  showLocalCursor() {
    if (this.cursorHidden) {
      this.canvas.style.cursor = 'default'
      this.cursorHidden = false
    }
  }

  start() {
    this.boundHandlers = {
      mousedown: this.handleMouseDown.bind(this) as EventListener,
      mouseup: this.handleMouseUp.bind(this) as EventListener,
      mousemove: this.handleMouseMove.bind(this) as EventListener,
      wheel: this.handleWheel.bind(this) as EventListener,
      contextmenu: this.handleContextMenu.bind(this) as EventListener,
      keydown: this.handleKeyDown.bind(this) as EventListener,
      keyup: this.handleKeyUp.bind(this) as EventListener,
      pointerlockchange: this.handlePointerLockChange.bind(this) as EventListener,
    }

    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown)
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseup)
    this.canvas.addEventListener('mousemove', this.boundHandlers.mousemove)
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel)
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextmenu)

    document.addEventListener('keydown', this.boundHandlers.keydown)
    document.addEventListener('keyup', this.boundHandlers.keyup)
    document.addEventListener('pointerlockchange', this.boundHandlers.pointerlockchange)

    this.canvas.addEventListener('mouseenter', () => this.hideLocalCursor())
    this.canvas.addEventListener('mouseleave', () => this.showLocalCursor())
  }

  stop() {
    this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown)
    this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseup)
    this.canvas.removeEventListener('mousemove', this.boundHandlers.mousemove)
    this.canvas.removeEventListener('wheel', this.boundHandlers.wheel)
    this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextmenu)

    document.removeEventListener('keydown', this.boundHandlers.keydown)
    document.removeEventListener('keyup', this.boundHandlers.keyup)
    document.removeEventListener('pointerlockchange', this.boundHandlers.pointerlockchange)

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }

    this.showLocalCursor()
  }

  private handlePointerLockChange() {
    if (document.pointerLockElement !== this.canvas) {
      this.showLocalCursor()
    }
  }

  private handleMouseDown(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.onMouseEvent) return

    const pos = this.getRelativePosition(e.clientX, e.clientY)
    this.onMouseEvent({
      x: pos.x,
      y: pos.y,
      button: e.button,
      buttons: e.buttons,
      movementX: e.movementX,
      movementY: e.movementY,
      deltaX: 0,
      deltaY: 0,
      event: 'mousedown',
      timestamp: performance.now()
    })
  }

  private handleMouseUp(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.onMouseEvent) return

    const pos = this.getRelativePosition(e.clientX, e.clientY)
    this.onMouseEvent({
      x: pos.x,
      y: pos.y,
      button: e.button,
      buttons: e.buttons,
      movementX: e.movementX,
      movementY: e.movementY,
      deltaX: 0,
      deltaY: 0,
      event: 'mouseup',
      timestamp: performance.now()
    })
  }

  private handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.onMouseEvent) return

    const now = performance.now()
    if (now - this.lastMoveTime < this.moveThrottleMs) return
    this.lastMoveTime = now

    const pos = this.getRelativePosition(e.clientX, e.clientY)
    this.onMouseEvent({
      x: pos.x,
      y: pos.y,
      button: e.button,
      buttons: e.buttons,
      movementX: e.movementX,
      movementY: e.movementY,
      deltaX: 0,
      deltaY: 0,
      event: 'mousemove',
      timestamp: now
    })
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.onMouseEvent) return

    const pos = this.getRelativePosition(e.clientX, e.clientY)
    this.onMouseEvent({
      x: pos.x,
      y: pos.y,
      button: 0,
      buttons: 0,
      movementX: 0,
      movementY: 0,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      event: 'wheel',
      timestamp: performance.now()
    })
  }

  private handleContextMenu(e: Event) {
    e.preventDefault()
    e.stopPropagation()
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.target !== document.body && 
        (e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    if (!this.onKeyboardEvent) return

    this.onKeyboardEvent({
      key: e.key,
      code: e.code,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
      event: 'keydown',
      timestamp: performance.now()
    })
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (e.target !== document.body && 
        (e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    if (!this.onKeyboardEvent) return

    this.onKeyboardEvent({
      key: e.key,
      code: e.code,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: false,
      event: 'keyup',
      timestamp: performance.now()
    })
  }

  requestPointerLock() {
    if (this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock()
    }
  }

  exitPointerLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock()
    }
  }
}
