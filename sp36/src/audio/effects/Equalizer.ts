import type { EqualizerParams } from '@/types/audio'

export class EqualizerNode {
  private audioContext: AudioContext
  private workletNode: AudioWorkletNode | null = null
  private nativeFilters: BiquadFilterNode[] = []
  private params: EqualizerParams
  private bypassGain: GainNode
  private phaseGain: GainNode
  private inputNode: GainNode
  private outputNode: GainNode

  constructor(audioContext: AudioContext, initialParams: EqualizerParams) {
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
      await this.audioContext.audioWorklet.addModule('/worklets/equalizer-processor.js')
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'equalizer-processor', {
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
      console.warn('AudioWorklet not available, using native BiquadFilter', error)
      this.createNativeEqualizer()
    }
  }

  private createNativeEqualizer() {
    this.nativeFilters = this.params.bands.map(band => {
      const filter = this.audioContext.createBiquadFilter()
      filter.type = band.type as BiquadFilterType
      filter.frequency.value = band.frequency
      filter.gain.value = band.gain
      filter.Q.value = band.q
      return filter
    })

    if (this.nativeFilters.length > 0) {
      this.inputNode.connect(this.nativeFilters[0])
      for (let i = 0; i < this.nativeFilters.length - 1; i++) {
        this.nativeFilters[i].connect(this.nativeFilters[i + 1])
      }
      this.nativeFilters[this.nativeFilters.length - 1].connect(this.phaseGain)
      this.phaseGain.connect(this.outputNode)
    } else {
      this.inputNode.connect(this.phaseGain)
      this.phaseGain.connect(this.outputNode)
    }
    
    this.inputNode.connect(this.bypassGain)
    this.bypassGain.connect(this.outputNode)
  }

  setParams(params: Partial<EqualizerParams>) {
    this.params = { 
      ...this.params, 
      ...params,
      bands: params.bands || this.params.bands
    }
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setParams',
        params: this.params
      })
    } else if (this.nativeFilters.length > 0 && params.bands) {
      params.bands.forEach((band, index) => {
        if (this.nativeFilters[index]) {
          const filter = this.nativeFilters[index]
          filter.type = band.type as BiquadFilterType
          filter.frequency.setValueAtTime(band.frequency, this.audioContext.currentTime)
          filter.gain.setValueAtTime(band.gain, this.audioContext.currentTime)
          filter.Q.setValueAtTime(band.q, this.audioContext.currentTime)
        }
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

  getParams(): EqualizerParams {
    return { 
      ...this.params, 
      bands: [...this.params.bands.map(b => ({ ...b }))] 
    }
  }

  dispose() {
    if (this.workletNode) {
      this.workletNode.disconnect()
    }
    this.nativeFilters.forEach(filter => filter.disconnect())
    this.inputNode.disconnect()
    this.outputNode.disconnect()
    this.bypassGain.disconnect()
    this.phaseGain.disconnect()
  }
}
