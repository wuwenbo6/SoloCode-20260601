import type {
  ServerMessage,
  InputEventMessage,
  BitrateFeedback,
  KeyframeRequest,
  NackRequest,
  JoystickMessage,
  ButtonMessage,
  InputStateSync,
  QualityChangeRequest,
  QualityLevel,
} from '../../shared/types'
import { QUALITY_PRESETS } from '../../shared/types'

let inputSequenceCounter = 0

export function nextSequence(): number {
  return ++inputSequenceCounter
}

export function resetSequence(): void {
  inputSequenceCounter = 0
}

export function createInputEvent(
  type: InputEventMessage['type'],
  data: InputEventMessage['data'],
  predicted = false
): InputEventMessage {
  return { type, timestamp: Date.now(), sequence: nextSequence(), predicted, data }
}

export function createBitrateFeedback(
  targetBitrate: number,
  packetLoss: number,
  rtt: number
): BitrateFeedback {
  return { type: 'bitrate-feedback', timestamp: Date.now(), data: { targetBitrate, packetLoss, rtt } }
}

export function createKeyframeRequest(lastReceivedFrameId: number): KeyframeRequest {
  return { type: 'keyframe-request', timestamp: Date.now(), data: { lastReceivedFrameId } }
}

export function createNackRequest(missingFrameIds: number[]): NackRequest {
  return { type: 'nack-request', timestamp: Date.now(), data: { missingFrameIds } }
}

export function createJoystickMessage(
  dx: number,
  dy: number,
  predicted = false
): JoystickMessage {
  return { type: 'joystick', timestamp: Date.now(), sequence: nextSequence(), predicted, data: { dx, dy } }
}

export function createButtonMessage(
  buttonId: string,
  pressed: boolean,
  predicted = false
): ButtonMessage {
  return { type: 'button', timestamp: Date.now(), sequence: nextSequence(), predicted, data: { buttonId, pressed } }
}

export function createInputStateSync(
  left: boolean,
  right: boolean,
  shoot: boolean,
  mouseX: number | null,
  useMouseControl: boolean
): InputStateSync {
  return {
    type: 'input-state-sync',
    timestamp: Date.now(),
    sequence: nextSequence(),
    data: { left, right, shoot, mouseX, useMouseControl }
  }
}

export function createQualityChangeRequest(quality: QualityLevel): QualityChangeRequest {
  const preset = QUALITY_PRESETS[quality]
  return {
    type: 'quality-change',
    timestamp: Date.now(),
    data: {
      quality,
      width: preset.width,
      height: preset.height,
    }
  }
}

export function parseServerMessage(data: string): ServerMessage | null {
  try {
    return JSON.parse(data) as ServerMessage
  } catch {
    return null
  }
}
