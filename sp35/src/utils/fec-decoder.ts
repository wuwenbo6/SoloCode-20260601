import type { GameObject, VideoFrame, FECFrame } from '../../shared/types'

interface FECGroup {
  groupId: number
  frames: Map<number, VideoFrame>
  receivedCount: number
  totalExpected: number
  repairFrame: FECFrame | null
  recoveredFrameId: number | null
}

export class FECDecoder {
  private groups: Map<number, FECGroup> = new Map()
  private recoveredCount = 0
  private maxGroupAge = 5

  addFrame(frame: VideoFrame, fecGroupId: number, fecIndex: number, fecTotal: number): void {
    let group = this.groups.get(fecGroupId)
    if (!group) {
      group = {
        groupId: fecGroupId,
        frames: new Map(),
        receivedCount: 0,
        totalExpected: fecTotal,
        repairFrame: null,
        recoveredFrameId: null,
      }
      this.groups.set(fecGroupId, group)
    }
    group.frames.set(frame.frameId, frame)
    group.receivedCount++
    this.checkRecovery(group)
    this.cleanOldGroups(fecGroupId)
  }

  addRepairFrame(fecFrame: FECFrame): VideoFrame | null {
    const groupId = fecFrame.payload.fecGroupId
    let group = this.groups.get(groupId)
    if (!group) {
      group = {
        groupId,
        frames: new Map(),
        receivedCount: 0,
        totalExpected: fecFrame.payload.fecTotal,
        repairFrame: fecFrame,
        recoveredFrameId: null,
      }
      this.groups.set(groupId, group)
    }
    group.repairFrame = fecFrame
    return this.checkRecovery(group)
  }

  private checkRecovery(group: FECGroup): VideoFrame | null {
    if (!group.repairFrame) return null
    const protectedIds = group.repairFrame.payload.protectedFrameIds
    const missingIds = protectedIds.filter(id => !group.frames.has(id))

    if (missingIds.length === 1 && group.repairFrame) {
      const recovered = this.recoverFrame(group.repairFrame, Array.from(group.frames.values()), missingIds[0])
      if (recovered) {
        group.frames.set(missingIds[0], recovered)
        group.recoveredFrameId = missingIds[0]
        group.receivedCount++
        this.recoveredCount++
        return recovered
      }
    }
    return null
  }

  private recoverFrame(repair: FECFrame, received: VideoFrame[], missingId: number): VideoFrame | null {
    const xorResult = this.xorObjects(received.map(f => f.objects))
    const recoveredObjects = this.xorObjects([xorResult, repair.payload.xorObjects])

    return {
      frameId: missingId,
      isKeyframe: false,
      timestamp: Date.now(),
      width: repair.payload.width,
      height: repair.payload.height,
      bitrate: 0,
      objects: recoveredObjects,
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

  private cleanOldGroups(currentGroupId: number): void {
    const oldestKept = currentGroupId - this.maxGroupAge
    for (const [id] of this.groups) {
      if (id < oldestKept) {
        this.groups.delete(id)
      }
    }
  }

  getRecoveredCount(): number {
    return this.recoveredCount
  }

  reset(): void {
    this.groups.clear()
    this.recoveredCount = 0
  }
}
