export class BitrateController {
  private currentBitrate = 4000
  private targetBitrate = 4000
  private minBitrate = 500
  private maxBitrate = 8000
  private quality = 0.8
  private lastFeedbackTime = 0

  getCurrentBitrate(): number {
    return this.currentBitrate
  }

  getQuality(): number {
    return this.quality
  }

  setTargetBitrate(bitrate: number) {
    this.targetBitrate = bitrate
    this.currentBitrate = bitrate
    this.maxBitrate = Math.max(this.maxBitrate, bitrate)
  }

  updateFeedback(packetLoss: number, rtt: number) {
    this.lastFeedbackTime = Date.now()
    if (packetLoss > 0.05) {
      this.currentBitrate = Math.max(this.minBitrate, this.currentBitrate * 0.85)
      this.quality = Math.max(0.3, this.quality - 0.05)
    } else if (packetLoss < 0.01 && rtt < 100) {
      this.currentBitrate = Math.min(this.maxBitrate, Math.min(this.targetBitrate, this.currentBitrate * 1.05))
      this.quality = Math.min(1.0, this.quality + 0.02)
    }
  }
}
