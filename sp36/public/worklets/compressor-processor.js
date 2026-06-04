class CompressorProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.sampleRate = 44100
    this.envelope = 0
    this.gainReduction = 0
    this.params = {
      threshold: -20,
      ratio: 4,
      attack: 10,
      release: 100,
      knee: 6,
      makeupGain: 0,
      bypassed: false
    }
    
    if (options.processorOptions && options.processorOptions.params) {
      Object.assign(this.params, options.processorOptions.params)
    }

    this.port.onmessage = (event) => {
      if (event.data.type === 'setParams') {
        Object.assign(this.params, event.data.params)
      }
    }
  }

  static get parameterDescriptors() {
    return []
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]

    if (input.length === 0 || this.params.bypassed) {
      if (input.length > 0 && output.length > 0) {
        for (let channel = 0; channel < input.length; channel++) {
          output[channel].set(input[channel])
        }
      }
      return true
    }

    const attackCoef = this.calculateCoef(this.params.attack)
    const releaseCoef = this.calculateCoef(this.params.release)
    const thresholdLinear = Math.pow(10, this.params.threshold / 20)
    const makeupGainLinear = Math.pow(10, this.params.makeupGain / 20)

    const kneeWidth = Math.pow(10, this.params.knee / 20)
    const kneeStart = thresholdLinear / kneeWidth
    const kneeEnd = thresholdLinear * kneeWidth

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel]
      const outputChannel = output[channel]

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i]
        const absSample = Math.abs(sample)

        let targetGain = 1

        if (absSample > thresholdLinear) {
          const overThreshold = absSample / thresholdLinear
          const ratio = this.params.ratio
          targetGain = Math.pow(overThreshold, 1 - ratio)
        } else if (absSample > kneeStart) {
          const kneePos = (absSample - kneeStart) / (kneeEnd - kneeStart)
          const ratio = 1 + (this.params.ratio - 1) * kneePos
          targetGain = Math.pow(absSample / thresholdLinear, 1 - ratio)
        }

        const coef = targetGain < this.gainReduction ? attackCoef : releaseCoef
        this.gainReduction = this.gainReduction * coef + targetGain * (1 - coef)

        outputChannel[i] = sample * this.gainReduction * makeupGainLinear
      }
    }

    return true
  }

  calculateCoef(timeMs) {
    return Math.exp(-1 / (this.sampleRate * timeMs / 1000))
  }
}

registerProcessor('compressor-processor', CompressorProcessor)
