import { WebSocket } from 'ws'
import { SpaceDefenderGame } from './game-engine.js'
import { FrameEncoder } from './frame-encoder.js'
import { BitrateController } from './bitrate-controller.js'
import { FECEncoder } from './fec-encoder.js'
import { FrameBuffer } from './frame-buffer.js'
import type { ClientMessage, VideoFrame, QualityLevel } from '../shared/types.js'
import { QUALITY_PRESETS } from '../shared/types.js'

export class GameSession {
  private game: SpaceDefenderGame
  private encoder: FrameEncoder
  private bitrateController: BitrateController
  private fecEncoder: FECEncoder
  private frameBuffer: FrameBuffer
  private gameLoop: NodeJS.Timeout | null = null
  private frameInterval: number
  private ws: WebSocket
  private destroyed = false
  private lastKeyframeRequest = 0
  private nackCount = 0
  private fecSentCount = 0
  private inputSequence = 0
  private lastInputTimestamp = Date.now()
  private inputLatencyHistory: number[] = []
  private fecGroupId = 0
  private fecGroupIndex = 0
  private fecGroupSize = 4
  private currentQuality: QualityLevel = '720p'
  private currentWidth = 1280
  private currentHeight = 720

  constructor(ws: WebSocket) {
    this.ws = ws
    this.game = new SpaceDefenderGame(1280, 720)
    this.encoder = new FrameEncoder()
    this.bitrateController = new BitrateController()
    this.fecEncoder = new FECEncoder()
    this.frameBuffer = new FrameBuffer()
    this.frameInterval = 1000 / 30

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString())
        this.handleMessage(msg)
      } catch (e) {
        console.error('Failed to parse client message:', e)
      }
    })

    this.startGameLoop()
  }

  private handleMessage(msg: ClientMessage) {
    const now = Date.now()
    if ('sequence' in msg) {
      this.inputSequence = msg.sequence
      this.game.setLastProcessedInput(msg.sequence)
      const latency = now - msg.timestamp
      this.inputLatencyHistory.push(latency)
      if (this.inputLatencyHistory.length > 30) {
        this.inputLatencyHistory.shift()
      }
    }
    this.lastInputTimestamp = now

    switch (msg.type) {
      case 'keydown':
        if (msg.data.key === 'ArrowLeft' || msg.data.key === 'a') this.game.setInput('left', true)
        if (msg.data.key === 'ArrowRight' || msg.data.key === 'd') this.game.setInput('right', true)
        if (msg.data.key === ' ' || msg.data.key === 'ArrowUp' || msg.data.key === 'w') this.game.setInput('shoot', true)
        if (msg.data.key === 'Enter') this.game.setInput('start', true)
        break
      case 'keyup':
        if (msg.data.key === 'ArrowLeft' || msg.data.key === 'a') this.game.setInput('left', false)
        if (msg.data.key === 'ArrowRight' || msg.data.key === 'd') this.game.setInput('right', false)
        if (msg.data.key === ' ' || msg.data.key === 'ArrowUp' || msg.data.key === 'w') this.game.setInput('shoot', false)
        break
      case 'joystick':
        this.game.setInput('left', msg.data.dx !== undefined && msg.data.dx < -0.3)
        this.game.setInput('right', msg.data.dx !== undefined && msg.data.dx > 0.3)
        break
      case 'button':
        if (msg.data.buttonId === 'a') this.game.setInput('shoot', msg.data.pressed === true)
        if (msg.data.buttonId === 'start') this.game.setInput('start', msg.data.pressed === true)
        break
      case 'bitrate-feedback':
        this.bitrateController.updateFeedback(msg.data.packetLoss, msg.data.rtt)
        break
      case 'keyframe-request':
        if (Date.now() - this.lastKeyframeRequest > 100) {
          this.lastKeyframeRequest = Date.now()
          this.sendKeyframe()
        }
        break
      case 'nack-request':
        this.handleNackRequest(msg.data.missingFrameIds)
        break
      case 'input-state-sync':
        this.game.setInput('left', msg.data.left)
        this.game.setInput('right', msg.data.right)
        this.game.setInput('shoot', msg.data.shoot)
        if (msg.data.mouseX !== null) {
          this.game.setMouseX(msg.data.mouseX)
        }
        break
      case 'mousemove':
        if (msg.data.x !== undefined) {
          this.game.setMouseX(msg.data.x * 1280)
        }
        break
      case 'mousedown':
        if (msg.data.button === 0) this.game.setInput('shoot', true)
        break
      case 'mouseup':
        if (msg.data.button === 0) this.game.setInput('shoot', false)
        break
      case 'touchstart':
        this.game.setInput('start', true)
        if (msg.data.touches && msg.data.touches.length > 0) {
          const t = msg.data.touches[0]
          this.game.setMouseX(t.x * 1280)
          this.game.setInput('shoot', true)
        }
        break
      case 'touchmove':
        if (msg.data.touches && msg.data.touches.length > 0) {
          const t = msg.data.touches[0]
          this.game.setMouseX(t.x * 1280)
        }
        break
      case 'touchend':
        this.game.setInput('shoot', false)
        break
      case 'quality-change':
        this.handleQualityChange(msg.data.quality, msg.data.width, msg.data.height)
        break
    }
  }

  private handleQualityChange(quality: QualityLevel, width: number, height: number): void {
    this.currentQuality = quality
    this.currentWidth = width
    this.currentHeight = height
    this.game.resize(width, height)
    this.bitrateController.setTargetBitrate(QUALITY_PRESETS[quality].bitrate)
    this.sendKeyframe()
  }

  private handleNackRequest(missingFrameIds: number[]): void {
    if (missingFrameIds.length === 0) return

    for (const frameId of missingFrameIds.slice(0, 5)) {
      const frame = this.frameBuffer.get(frameId)
      if (frame) {
        this.nackCount++
        this.send({ type: 'retransmitted-frame', payload: frame })
      }
    }

    if (missingFrameIds.length > 5) {
      this.sendKeyframe()
    }
  }

  private getAverageInputLatency(): number {
    if (this.inputLatencyHistory.length === 0) return 0
    const sum = this.inputLatencyHistory.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.inputLatencyHistory.length)
  }

  private startGameLoop() {
    this.gameLoop = setInterval(() => {
      if (this.destroyed || this.ws.readyState !== WebSocket.OPEN) return

      this.game.update()
      const quality = this.bitrateController.getQuality()
      const isKeyframe = this.encoder.shouldSendKeyframe(quality)
      const objects = this.game.getObjects()

      let frameObjects = objects
      if (!isKeyframe) {
        frameObjects = this.encoder.computeDelta(objects)
      }

      const frame: VideoFrame = {
        frameId: this.encoder.nextFrameId(),
        isKeyframe,
        timestamp: Date.now(),
        width: this.currentWidth,
        height: this.currentHeight,
        bitrate: this.bitrateController.getCurrentBitrate(),
        objects: frameObjects,
        inputSequence: this.inputSequence,
      }

      this.frameBuffer.add(frame)
      this.send({ type: 'frame', payload: frame })

      const fecFrame = this.fecEncoder.addFrame(frame)
      if (fecFrame) {
        this.fecSentCount++
        this.send(fecFrame)
      }

      this.send({
        type: 'stats',
        payload: {
          bitrate: this.bitrateController.getCurrentBitrate(),
          fps: 30,
          frameId: frame.frameId,
          gameScore: this.game.getScore(),
          packetLoss: 0,
          rtt: 0,
          fecRecovered: 0,
          nackRecovered: this.nackCount,
          inputLatency: this.getAverageInputLatency(),
        }
      })
    }, this.frameInterval)
  }

  private sendKeyframe() {
    if (this.ws.readyState !== WebSocket.OPEN) return
    const objects = this.game.getObjects()
    const frame: VideoFrame = {
      frameId: this.encoder.nextFrameId(),
      isKeyframe: true,
      timestamp: Date.now(),
      width: this.currentWidth,
      height: this.currentHeight,
      bitrate: this.bitrateController.getCurrentBitrate(),
      objects,
      inputSequence: this.inputSequence,
    }
    this.frameBuffer.add(frame)
    this.send({ type: 'frame', payload: frame })
  }

  private send(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  destroy() {
    this.destroyed = true
    if (this.gameLoop) {
      clearInterval(this.gameLoop)
      this.gameLoop = null
    }
    this.fecEncoder.reset()
    this.frameBuffer.clear()
  }
}
