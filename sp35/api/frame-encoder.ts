import type { GameObject } from '../shared/types.js'

export class FrameEncoder {
  private frameId = 0
  private lastFullFrame: GameObject[] = []
  private framesSinceKeyframe = 0

  nextFrameId(): number {
    return ++this.frameId
  }

  shouldSendKeyframe(quality: number): boolean {
    this.framesSinceKeyframe++
    const keyframeInterval = Math.max(15, Math.floor(60 * (1 - quality)))
    if (this.framesSinceKeyframe >= keyframeInterval) {
      this.framesSinceKeyframe = 0
      this.lastFullFrame = []
      return true
    }
    return false
  }

  computeDelta(currentObjects: GameObject[]): GameObject[] {
    this.lastFullFrame = currentObjects
    return currentObjects
  }

  getFrameId(): number {
    return this.frameId
  }
}
