import type { PredictedInput, InputStateSync, JoystickMessage, ButtonMessage, InputEventMessage } from '../../shared/types'

interface InputState {
  left: boolean
  right: boolean
  shoot: boolean
  mouseX: number | null
  useMouseControl: boolean
}

interface PlayerPosition {
  x: number
  y: number
}

export class DeadReckoning {
  private pendingInputs: PredictedInput[] = []
  private currentInputState: InputState = {
    left: false,
    right: false,
    shoot: false,
    mouseX: null,
    useMouseControl: false,
  }
  private lastServerState: PlayerPosition = { x: 640, y: 640 }
  private predictedPosition: PlayerPosition = { x: 640, y: 640 }
  private playerSpeed = 6
  private rtt = 50
  private lastProcessedSequence = 0
  private sequenceCounter = 0
  private width = 1280
  private playerWidth = 40

  nextSequence(): number {
    return ++this.sequenceCounter
  }

  setRTT(rtt: number): void {
    this.rtt = rtt
  }

  setGameDimensions(width: number): void {
    this.width = width
  }

  setPlayerSize(width: number): void {
    this.playerWidth = width
  }

  setServerPosition(x: number, y: number, lastProcessedSeq: number): void {
    this.lastServerState = { x, y }
    this.lastProcessedSequence = lastProcessedSeq
    this.reconcileState()
  }

  reconcileState(): void {
    this.pendingInputs = this.pendingInputs.filter(
      input => input.sequence > this.lastProcessedSequence
    )

    let predictedX = this.lastServerState.x
    let predictedY = this.lastServerState.y

    const predictionFrames = Math.max(1, Math.ceil(this.rtt / 33))

    for (let i = 0; i < predictionFrames; i++) {
      for (const input of this.pendingInputs) {
        if (input.type === 'left') {
          this.currentInputState.left = input.value as boolean
        } else if (input.type === 'right') {
          this.currentInputState.right = input.value as boolean
        } else if (input.type === 'shoot') {
          this.currentInputState.shoot = input.value as boolean
        } else if (input.type === 'mouseX') {
          this.currentInputState.mouseX = input.value as number
          this.currentInputState.useMouseControl = true
        }
      }

      if (this.currentInputState.useMouseControl && this.currentInputState.mouseX !== null) {
        const targetX = this.currentInputState.mouseX
        const diff = targetX - predictedX
        if (Math.abs(diff) > 2) {
          predictedX += diff * 0.15
        }
      } else {
        if (this.currentInputState.left) predictedX -= this.playerSpeed
        if (this.currentInputState.right) predictedX += this.playerSpeed
      }

      predictedX = Math.max(this.playerWidth / 2, Math.min(this.width - this.playerWidth / 2, predictedX))
    }

    this.predictedPosition = { x: predictedX, y: predictedY }
  }

  addInput(message: JoystickMessage | ButtonMessage | InputEventMessage): void {
    const timestamp = Date.now()

    if (message.type === 'joystick') {
      const dx = message.data.dx || 0
      this.pendingInputs.push({
        sequence: message.sequence,
        type: 'left',
        value: dx < -0.3,
        timestamp,
      })
      this.pendingInputs.push({
        sequence: message.sequence,
        type: 'right',
        value: dx > 0.3,
        timestamp,
      })
      this.currentInputState.left = dx < -0.3
      this.currentInputState.right = dx > 0.3
    } else if (message.type === 'button') {
      if (message.data.buttonId === 'a') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'shoot',
          value: message.data.pressed,
          timestamp,
        })
        this.currentInputState.shoot = message.data.pressed
      }
    } else if (message.type === 'keydown') {
      if (message.data.key === 'ArrowLeft' || message.data.key === 'a') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'left',
          value: true,
          timestamp,
        })
        this.currentInputState.left = true
      }
      if (message.data.key === 'ArrowRight' || message.data.key === 'd') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'right',
          value: true,
          timestamp,
        })
        this.currentInputState.right = true
      }
      if (message.data.key === ' ' || message.data.key === 'ArrowUp' || message.data.key === 'w') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'shoot',
          value: true,
          timestamp,
        })
        this.currentInputState.shoot = true
      }
    } else if (message.type === 'keyup') {
      if (message.data.key === 'ArrowLeft' || message.data.key === 'a') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'left',
          value: false,
          timestamp,
        })
        this.currentInputState.left = false
      }
      if (message.data.key === 'ArrowRight' || message.data.key === 'd') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'right',
          value: false,
          timestamp,
        })
        this.currentInputState.right = false
      }
      if (message.data.key === ' ' || message.data.key === 'ArrowUp' || message.data.key === 'w') {
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'shoot',
          value: false,
          timestamp,
        })
        this.currentInputState.shoot = false
      }
    } else if (message.type === 'mousemove') {
      if (message.data.x !== undefined) {
        const mouseX = message.data.x * this.width
        this.pendingInputs.push({
          sequence: message.sequence,
          type: 'mouseX',
          value: mouseX,
          timestamp,
        })
        this.currentInputState.mouseX = mouseX
        this.currentInputState.useMouseControl = true
      }
    }

    this.reconcileState()
  }

  getPredictedPosition(): PlayerPosition {
    return this.predictedPosition
  }

  getInputStateSync(): InputStateSync {
    return {
      type: 'input-state-sync',
      timestamp: Date.now(),
      sequence: this.nextSequence(),
      data: { ...this.currentInputState },
    }
  }

  getCurrentInputState(): InputState {
    return { ...this.currentInputState }
  }

  reset(): void {
    this.pendingInputs = []
    this.currentInputState = {
      left: false,
      right: false,
      shoot: false,
      mouseX: null,
      useMouseControl: false,
    }
    this.lastProcessedSequence = 0
    this.sequenceCounter = 0
    this.predictedPosition = { ...this.lastServerState }
  }
}
