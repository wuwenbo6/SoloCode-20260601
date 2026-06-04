import type { VideoFrame } from '../shared/types.js'

export class FrameBuffer {
  private buffer: Map<number, VideoFrame> = new Map()
  private maxSize = 60
  private accessOrder: number[] = []

  add(frame: VideoFrame): void {
    if (this.buffer.size >= this.maxSize) {
      const oldest = this.accessOrder.shift()
      if (oldest !== undefined) {
        this.buffer.delete(oldest)
      }
    }
    this.buffer.set(frame.frameId, frame)
    this.accessOrder.push(frame.frameId)
  }

  get(frameId: number): VideoFrame | undefined {
    const frame = this.buffer.get(frameId)
    if (frame) {
      const idx = this.accessOrder.indexOf(frameId)
      if (idx > -1) {
        this.accessOrder.splice(idx, 1)
        this.accessOrder.push(frameId)
      }
    }
    return frame
  }

  has(frameId: number): boolean {
    return this.buffer.has(frameId)
  }

  getRange(startId: number, endId: number): VideoFrame[] {
    const frames: VideoFrame[] = []
    for (let i = startId; i <= endId; i++) {
      const frame = this.buffer.get(i)
      if (frame) frames.push(frame)
    }
    return frames
  }

  clear(): void {
    this.buffer.clear()
    this.accessOrder = []
  }

  size(): number {
    return this.buffer.size
  }
}
