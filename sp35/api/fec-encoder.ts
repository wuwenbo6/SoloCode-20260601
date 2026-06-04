import type { GameObject, VideoFrame, FECFrame } from '../shared/types.js'

export class FECEncoder {
  private groupSize = 4
  private frameBuffer: VideoFrame[] = []
  private fecGroupId = 0

  addFrame(frame: VideoFrame): FECFrame | null {
    this.frameBuffer.push(frame)
    if (this.frameBuffer.length >= this.groupSize) {
      const fecFrame = this.generateFEC()
      this.frameBuffer = []
      this.fecGroupId++
      return fecFrame
    }
    return null
  }

  private generateFEC(): FECFrame {
    const protectedFrameIds = this.frameBuffer.map(f => f.frameId)
    const xorObjects = this.xorObjects(this.frameBuffer.map(f => f.objects))
    return {
      type: 'fec-repair',
      payload: {
        fecGroupId: this.fecGroupId,
        fecIndex: this.groupSize,
        fecTotal: this.groupSize,
        protectedFrameIds,
        xorObjects,
        width: this.frameBuffer[0].width,
        height: this.frameBuffer[0].height,
      }
    }
  }

  private xorObjects(objectsArrays: GameObject[][]): GameObject[] {
    const objectMap = new Map<string, GameObject>()

    for (const arr of objectsArrays) {
      for (const obj of arr) {
        const key = obj.id || `${obj.type}-${obj.x}-${obj.y}`
        if (!objectMap.has(key)) {
          objectMap.set(key, { ...obj })
        } else {
          const existing = objectMap.get(key)!
          existing.x = this.xorNum(existing.x, obj.x)
          existing.y = this.xorNum(existing.y, obj.y)
          existing.opacity = this.xorNum(existing.opacity || 0, obj.opacity || 0)
          if (existing.width !== undefined && obj.width !== undefined) {
            existing.width = this.xorNum(existing.width, obj.width)
          }
          if (existing.height !== undefined && obj.height !== undefined) {
            existing.height = this.xorNum(existing.height, obj.height)
          }
          if (existing.rotation !== undefined && obj.rotation !== undefined) {
            existing.rotation = this.xorNum(existing.rotation, obj.rotation)
          }
        }
      }
    }

    return Array.from(objectMap.values())
  }

  private xorNum(a: number, b: number): number {
    return a ^ b
  }

  reset(): void {
    this.frameBuffer = []
    this.fecGroupId = 0
  }

  getGroupSize(): number {
    return this.groupSize
  }
}
