import type { LimiterParams } from '@/types/audio'

export class LimiterNode {
  private audioContext: AudioContext
  private workletNode: AudioWorkletNode | null = null
  private params: LimiterParams
  private bypassGain: GainNode
  private phaseGain: GainNode
  private inputNode: GainNode
  private outputNode: GainNode
  private nativeLimiter: DynamicsCompressorNode | null = null

  constructor(audioContext: AudioContext, initialParams: LimiterParams) {
    this.audioContext = audioContext
    this.params = initialParams
    this.inputNode = audioContext.createGain()
    this.outputNode = audioContext.createGain()
    this.bypassGain = audioContext.createGain()
    this.phaseGain = audioContext.createGain()
    this.bypassGain.gain.value = initialParams.bypassed ? 1 : 0
    this.phaseGain.gain.value = initialParams.phaseInvert ? -1 : 1
  }

  async init() {
    try {
      await this.audioContext.audioWorklet.addModule('/worklets/limiter-processor.js')
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'limiter-processor', {
        processorOptions: {
          params: this.params
        }
      })

      this.inputNode.connect(this.workletNode)
      this.workletNode.connect(this.phaseGain)
      this.phaseGain.connect(this.outputNode)
      this.inputNode.connect(this.bypassGain)
      this.bypassGain.connect(this.outputNode)
      
      this.updateBypass()
      this.updatePhase()
    } catch (error) {
      console.warn('AudioWorklet not available, using native DynamicsCompressor as limiter', error)
      this.createNativeLimiter()
    }
  }

  private createNativeLimiter() {
    this.nativeLimiter = this.audioContext.createDynamicsCompressor()
    this.nativeLimiter.threshold.value = this.params.threshold
    this.nativeLimiter.ratio.value = 20
    this.nativeLimiter.attack.value = this.params.attack / 1000
    this.nativeLimiter.release.value = this.params.release / 1000
    this.nativeLimiter.knee.value = 0

    this.inputNode.connect(this.nativeLimiter)
    this.nativeLimiter.connect(this.phaseGain)
    this.phaseGain.connect(this.outputNode)
    this.inputNode.connect(this.bypassGain)
    this.bypassGain.connect(this.outputNode)
  }

  setParams(params: Partial<LimiterParams>) {
    this.params = { ...this.params, ...params }
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setParams',
        params: this.params
      })
    } else if (this.nativeLimiter) {
      this.nativeLimiter.threshold.setValueAtTime(this.params.threshold, this.audioContext.currentTime)
      this.nativeLimiter.attack.setValueAtTime(this.params.attack / 1000, this.audioContext.currentTime)
      this.nativeLimiter.release.setValueAtTime(this.params.release / 1000, this.audioContext.currentTime)
    }
    
    this.updateBypass()
    this.updatePhase()
  }

  private updateBypass() {
    if (this.params.bypassed) {
      this.bypassGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01)
    } else {
      this.bypassGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01)
    }
  }

  private updatePhase() {
    if (this.params.phaseInvert) {
      this.phaseGain.gain.setTargetAtTime(-1, this.audioContext.currentTime, 0.01)
    } else {
      this.phaseGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01)
    }
  }

  getInput(): AudioNode {
    return this.inputNode
  }

  getOutput(): AudioNode {
    return this.outputNode
  }

  getParams(): LimiterParams {
    return { ...this.params }
  }

  dispose() {
    if (this.workletNode) {
      this.workletNode.disconnect()
    }
    if (this.nativeLimiter) {
      this.nativeLimiter.disconnect()
    }
    this.inputNode.disconnect()
    this.outputNode.disconnect()
    this.bypassGain.disconnect()
    this.phaseGain.disconnect()
  }
}
