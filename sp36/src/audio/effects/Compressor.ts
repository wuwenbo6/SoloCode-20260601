import type { CompressorParams } from '@/types/audio'

export class CompressorNode {
  private audioContext: AudioContext
  private workletNode: AudioWorkletNode | null = null
  private params: CompressorParams
  private bypassGain: GainNode
  private phaseGain: GainNode
  private inputNode: GainNode
  private outputNode: GainNode

  constructor(audioContext: AudioContext, initialParams: CompressorParams) {
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
      await this.audioContext.audioWorklet.addModule('/worklets/compressor-processor.js')
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'compressor-processor', {
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
      console.warn('AudioWorklet not available, using native DynamicsCompressor', error)
      this.createNativeCompressor()
    }
  }

  private createNativeCompressor() {
    const nativeCompressor = this.audioContext.createDynamicsCompressor()
    nativeCompressor.threshold.value = this.params.threshold
    nativeCompressor.ratio.value = this.params.ratio
    nativeCompressor.attack.value = this.params.attack / 1000
    nativeCompressor.release.value = this.params.release / 1000
    nativeCompressor.knee.value = this.params.knee

    const makeupGain = this.audioContext.createGain()
    makeupGain.gain.value = Math.pow(10, this.params.makeupGain / 20)

    this.inputNode.connect(nativeCompressor)
    nativeCompressor.connect(makeupGain)
    makeupGain.connect(this.phaseGain)
    this.phaseGain.connect(this.outputNode)
    this.inputNode.connect(this.bypassGain)
    this.bypassGain.connect(this.outputNode)
  }

  setParams(params: Partial<CompressorParams>) {
    this.params = { ...this.params, ...params }
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setParams',
        params: this.params
      })
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

  getParams(): CompressorParams {
    return { ...this.params }
  }

  dispose() {
    if (this.workletNode) {
      this.workletNode.disconnect()
    }
    this.inputNode.disconnect()
    this.outputNode.disconnect()
    this.bypassGain.disconnect()
    this.phaseGain.disconnect()
  }
}
