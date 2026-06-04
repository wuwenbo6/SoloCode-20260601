export interface WhiteboardAction {
  type: 'stroke' | 'clear' | 'undo'
  points?: { x: number; y: number }[]
  color?: string
  lineWidth?: number
  timestamp?: number
}

export type WhiteboardActionCallback = (action: WhiteboardAction) => void

export class WhiteboardCanvas {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private drawing: boolean = false
  private active: boolean = false
  private currentStroke: { x: number; y: number }[] = []
  private strokes: WhiteboardAction[] = []
  private color: string = '#ff0000'
  private lineWidth: number = 3
  private onActionCallback: WhiteboardActionCallback | null = null
  private remoteWidth: number = 1920
  private remoteHeight: number = 1080
  private displayWidth: number = 0
  private displayHeight: number = 0
  private offsetX: number = 0
  private offsetY: number = 0

  constructor() {}

  setRemoteSize(width: number, height: number) {
    this.remoteWidth = width
    this.remoteHeight = height
  }

  setDisplayRect(offsetX: number, offsetY: number, width: number, height: number) {
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.displayWidth = width
    this.displayHeight = height
  }

  onAction(callback: WhiteboardActionCallback) {
    this.onActionCallback = callback
  }

  mount(container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.zIndex = '15'
    this.canvas.style.pointerEvents = this.active ? 'auto' : 'none'
    this.canvas.style.cursor = this.active ? 'crosshair' : 'default'

    this.ctx = this.canvas.getContext('2d')

    const resizeObserver = new ResizeObserver(() => {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect()
        this.canvas.width = rect.width
        this.canvas.height = rect.height
        this.redraw()
      }
    })
    resizeObserver.observe(container)

    this.canvas.addEventListener('mousedown', this.handleMouseDown)
    this.canvas.addEventListener('mousemove', this.handleMouseMove)
    this.canvas.addEventListener('mouseup', this.handleMouseUp)
    this.canvas.addEventListener('mouseleave', this.handleMouseUp)

    this.canvas.addEventListener('touchstart', this.handleTouchStart as EventListener)
    this.canvas.addEventListener('touchmove', this.handleTouchMove as EventListener)
    this.canvas.addEventListener('touchend', this.handleTouchEnd)

    container.appendChild(this.canvas)
  }

  unmount() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown)
      this.canvas.removeEventListener('mousemove', this.handleMouseMove)
      this.canvas.removeEventListener('mouseup', this.handleMouseUp)
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp)
      this.canvas.removeEventListener('touchstart', this.handleTouchStart as EventListener)
      this.canvas.removeEventListener('touchmove', this.handleTouchMove as EventListener)
      this.canvas.removeEventListener('touchend', this.handleTouchEnd)

      if (this.canvas.parentElement) {
        this.canvas.parentElement.removeChild(this.canvas)
      }
    }
    this.canvas = null
    this.ctx = null
  }

  activate() {
    this.active = true
    if (this.canvas) {
      this.canvas.style.pointerEvents = 'auto'
      this.canvas.style.cursor = 'crosshair'
    }
  }

  deactivate() {
    this.active = false
    this.drawing = false
    this.currentStroke = []
    if (this.canvas) {
      this.canvas.style.pointerEvents = 'none'
      this.canvas.style.cursor = 'default'
    }
  }

  isActive() {
    return this.active
  }

  setTool(tool: 'pen' | 'highlighter' | 'eraser') {
    switch (tool) {
      case 'pen':
        this.color = '#ff0000'
        this.lineWidth = 3
        break
      case 'highlighter':
        this.color = 'rgba(255, 255, 0, 0.4)'
        this.lineWidth = 20
        break
      case 'eraser':
        this.color = '#000000'
        this.lineWidth = 20
        break
    }
  }

  setColor(color: string) {
    this.color = color
  }

  setLineWidth(width: number) {
    this.lineWidth = width
  }

  undo() {
    const action: WhiteboardAction = { type: 'undo' }
    this.strokes.pop()
    this.redraw()
    if (this.onActionCallback) this.onActionCallback(action)
  }

  clear() {
    const action: WhiteboardAction = { type: 'clear' }
    this.strokes = []
    this.redraw()
    if (this.onActionCallback) this.onActionCallback(action)
  }

  applyRemoteAction(action: WhiteboardAction) {
    if (action.type === 'clear') {
      this.strokes = []
    } else if (action.type === 'undo') {
      this.strokes.pop()
    } else if (action.type === 'stroke') {
      this.strokes.push(action)
    }
    this.redraw()
  }

  private screenToRemote(clientX: number, clientY: number): { x: number; y: number } {
    if (this.displayWidth > 0 && this.displayHeight > 0) {
      const relX = clientX - this.offsetX
      const relY = clientY - this.offsetY
      return {
        x: Math.max(0, Math.min(this.remoteWidth, Math.round(relX * (this.remoteWidth / this.displayWidth)))),
        y: Math.max(0, Math.min(this.remoteHeight, Math.round(relY * (this.remoteHeight / this.displayHeight)))),
      }
    }

    if (!this.canvas) return { x: 0, y: 0 }
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(this.remoteWidth, Math.round((clientX - rect.left) / rect.width * this.remoteWidth))),
      y: Math.max(0, Math.min(this.remoteHeight, Math.round((clientY - rect.top) / rect.height * this.remoteHeight))),
    }
  }

  private remoteToScreen(rx: number, ry: number): { x: number; y: number } {
    if (this.displayWidth > 0 && this.displayHeight > 0) {
      return {
        x: this.offsetX + rx * (this.displayWidth / this.remoteWidth),
        y: this.offsetY + ry * (this.displayHeight / this.remoteHeight),
      }
    }

    if (!this.canvas) return { x: 0, y: 0 }
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: rect.left + rx / this.remoteWidth * rect.width,
      y: rect.top + ry / this.remoteHeight * rect.height,
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.active) return
    e.preventDefault()
    e.stopPropagation()

    this.drawing = true
    const remotePos = this.screenToRemote(e.clientX, e.clientY)
    this.currentStroke = [remotePos]
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.active || !this.drawing) return
    e.preventDefault()
    e.stopPropagation()

    const remotePos = this.screenToRemote(e.clientX, e.clientY)
    this.currentStroke.push(remotePos)
    this.redrawWithCurrentStroke()
  }

  private handleMouseUp = (_e: MouseEvent) => {
    if (!this.drawing) return

    this.drawing = false

    if (this.currentStroke.length >= 2) {
      const action: WhiteboardAction = {
        type: 'stroke',
        points: [...this.currentStroke],
        color: this.color,
        lineWidth: this.lineWidth,
        timestamp: performance.now(),
      }
      this.strokes.push(action)
      if (this.onActionCallback) this.onActionCallback(action)
    }

    this.currentStroke = []
    this.redraw()
  }

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.active) return
    e.preventDefault()

    const touch = e.touches[0]
    this.drawing = true
    const remotePos = this.screenToRemote(touch.clientX, touch.clientY)
    this.currentStroke = [remotePos]
  }

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.active || !this.drawing) return
    e.preventDefault()

    const touch = e.touches[0]
    const remotePos = this.screenToRemote(touch.clientX, touch.clientY)
    this.currentStroke.push(remotePos)
    this.redrawWithCurrentStroke()
  }

  private handleTouchEnd = () => {
    if (!this.drawing) return

    this.drawing = false

    if (this.currentStroke.length >= 2) {
      const action: WhiteboardAction = {
        type: 'stroke',
        points: [...this.currentStroke],
        color: this.color,
        lineWidth: this.lineWidth,
        timestamp: performance.now(),
      }
      this.strokes.push(action)
      if (this.onActionCallback) this.onActionCallback(action)
    }

    this.currentStroke = []
    this.redraw()
  }

  private redraw() {
    if (!this.ctx || !this.canvas) return

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (const stroke of this.strokes) {
      this.drawStroke(stroke)
    }
  }

  private redrawWithCurrentStroke() {
    this.redraw()

    if (this.currentStroke.length >= 2) {
      this.drawStroke({
        type: 'stroke',
        points: this.currentStroke,
        color: this.color,
        lineWidth: this.lineWidth,
      })
    }
  }

  private drawStroke(stroke: WhiteboardAction) {
    if (!this.ctx || !stroke.points || stroke.points.length < 2) return

    this.ctx.beginPath()
    this.ctx.strokeStyle = stroke.color || '#ff0000'
    this.ctx.lineWidth = stroke.lineWidth || 3
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    const start = this.remoteToScreen(stroke.points[0].x, stroke.points[0].y)
    this.ctx.moveTo(start.x, start.y)

    for (let i = 1; i < stroke.points.length; i++) {
      const pt = this.remoteToScreen(stroke.points[i].x, stroke.points[i].y)
      this.ctx.lineTo(pt.x, pt.y)
    }

    this.ctx.stroke()
  }

  getStrokes(): WhiteboardAction[] {
    return [...this.strokes]
  }

  dispose() {
    this.unmount()
    this.strokes = []
    this.currentStroke = []
    this.onActionCallback = null
  }
}
