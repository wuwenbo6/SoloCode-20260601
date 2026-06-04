interface CursorState {
  x: number
  y: number
  visible: boolean
  timestamp: number
}

interface InterpolationState {
  from: CursorState
  to: CursorState
  startTime: number
  duration: number
}

export class CursorInterpolator {
  private currentState: CursorState = { x: 0, y: 0, visible: true, timestamp: 0 }
  private interpolation: InterpolationState | null = null
  private animationFrameId: number | null = null
  private onUpdateCallback: ((x: number, y: number, visible: boolean) => void) | null = null
  private maxHistory: number = 3
  private recentTargets: CursorState[] = []
  private avgLatencyMs: number = 30
  private lastUpdateTime: number = 0
  private isPlaying: boolean = false

  constructor(onUpdate?: (x: number, y: number, visible: boolean) => void) {
    this.onUpdateCallback = onUpdate || null
  }

  setOnUpdate(callback: (x: number, y: number, visible: boolean) => void) {
    this.onUpdateCallback = callback
  }

  updateTarget(x: number, y: number, visible: boolean, timestamp?: number) {
    const now = performance.now()
    const target: CursorState = {
      x,
      y,
      visible,
      timestamp: timestamp ?? now
    }

    this.recentTargets.push(target)
    if (this.recentTargets.length > this.maxHistory) {
      this.recentTargets.shift()
    }

    if (this.recentTargets.length >= 2) {
      const recentCount = this.recentTargets.length
      let totalLatency = 0
      for (let i = 1; i < recentCount; i++) {
        totalLatency += this.recentTargets[i].timestamp - this.recentTargets[i - 1].timestamp
      }
      this.avgLatencyMs = totalLatency / (recentCount - 1)
    }

    const interpolationDuration = Math.max(16, Math.min(80, this.avgLatencyMs * 0.8))

    this.interpolation = {
      from: { ...this.currentState, timestamp: now },
      to: target,
      startTime: now,
      duration: interpolationDuration
    }

    this.lastUpdateTime = now

    if (!this.isPlaying) {
      this.startAnimation()
    }
  }

  private startAnimation() {
    if (this.animationFrameId !== null) return

    this.isPlaying = true

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      this.tick()
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  private stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.isPlaying = false
  }

  private tick() {
    const now = performance.now()

    if (!this.interpolation) {
      this.emitUpdate()
      return
    }

    const elapsed = now - this.interpolation.startTime
    const progress = Math.min(1, elapsed / this.interpolation.duration)

    const easeProgress = this.easeOutCubic(progress)

    if (progress >= 1) {
      this.currentState = { ...this.interpolation.to, timestamp: now }
      this.interpolation = null

      const timeSinceLastUpdate = now - this.lastUpdateTime
      if (timeSinceLastUpdate > 150) {
        this.stopAnimation()
      }
    } else {
      const from = this.interpolation.from
      const to = this.interpolation.to

      const predictedVelocity = this.predictVelocity()
      const lookAhead = Math.min(0.3, elapsed / this.avgLatencyMs) * 0.2

      this.currentState = {
        x: from.x + (to.x - from.x) * easeProgress + predictedVelocity.x * lookAhead,
        y: from.y + (to.y - from.y) * easeProgress + predictedVelocity.y * lookAhead,
        visible: to.visible,
        timestamp: now
      }
    }

    this.emitUpdate()
  }

  private predictVelocity(): { x: number; y: number } {
    if (this.recentTargets.length < 2) return { x: 0, y: 0 }

    const recent = this.recentTargets.slice(-3)
    let vx = 0
    let vy = 0

    for (let i = 1; i < recent.length; i++) {
      const dt = Math.max(1, recent[i].timestamp - recent[i - 1].timestamp)
      vx += (recent[i].x - recent[i - 1].x) / dt
      vy += (recent[i].y - recent[i - 1].y) / dt
    }

    const sampleCount = recent.length - 1
    return {
      x: (vx / sampleCount) * 16,
      y: (vy / sampleCount) * 16
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  private emitUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(
        this.currentState.x,
        this.currentState.y,
        this.currentState.visible
      )
    }
  }

  getCurrent(): { x: number; y: number; visible: boolean } {
    return {
      x: this.currentState.x,
      y: this.currentState.y,
      visible: this.currentState.visible
    }
  }

  reset(x: number, y: number, visible: boolean = true) {
    this.currentState = { x, y, visible, timestamp: performance.now() }
    this.interpolation = null
    this.recentTargets = []
    this.lastUpdateTime = performance.now()
    this.emitUpdate()
  }

  dispose() {
    this.stopAnimation()
    this.onUpdateCallback = null
    this.recentTargets = []
  }

  getStats() {
    return {
      avgLatencyMs: this.avgLatencyMs,
      interpolationActive: this.interpolation !== null,
      recentTargetCount: this.recentTargets.length
    }
  }
}
