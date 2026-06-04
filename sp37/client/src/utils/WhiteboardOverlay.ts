export interface WhiteboardAction {
  type: 'stroke' | 'clear' | 'undo'
  points?: { x: number; y: number }[]
  color?: string
  lineWidth?: number
  timestamp?: number
}

export class WhiteboardOverlay {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private width: number = 0
  private height: number = 0
  private strokes: WhiteboardAction[] = []
  private visible: boolean = false

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  mount(container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '20'
    this.canvas.style.display = this.visible ? 'block' : 'none'
    this.ctx = this.canvas.getContext('2d')
    container.appendChild(this.canvas)
    this.redraw()
  }

  unmount() {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
    this.canvas = null
    this.ctx = null
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.redraw()
  }

  applyAction(action: WhiteboardAction) {
    if (action.type === 'clear') {
      this.strokes = []
    } else if (action.type === 'undo') {
      this.strokes.pop()
    } else if (action.type === 'stroke') {
      this.strokes.push(action)
    }
    this.redraw()
  }

  show() {
    this.visible = true
    if (this.canvas) this.canvas.style.display = 'block'
  }

  hide() {
    this.visible = false
    if (this.canvas) this.canvas.style.display = 'none'
  }

  isVisible() {
    return this.visible
  }

  private redraw() {
    if (!this.ctx || !this.canvas) return

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (const stroke of this.strokes) {
      if (stroke.type !== 'stroke' || !stroke.points || stroke.points.length < 2) continue

      this.ctx.beginPath()
      this.ctx.strokeStyle = stroke.color || '#ff0000'
      this.ctx.lineWidth = stroke.lineWidth || 3
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'

      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      this.ctx.stroke()
    }
  }

  clear() {
    this.strokes = []
    this.redraw()
  }

  dispose() {
    this.unmount()
    this.strokes = []
  }
}
