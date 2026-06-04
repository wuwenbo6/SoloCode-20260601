class LimiterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.sampleRate = 44100
    this.envelope = 0
    this.gainReduction = 1
    this.lookaheadBuffer = []
    this.bufferIndex = 0
    
    this.params = {
      threshold: -0.5,
      attack: 1,
      release: 50,
      lookahead: 5,
      ceiling: -0.1,
      bypassed: false
    }

    if (options.processorOptions && options.processorOptions.params) {
      Object.assign(this.params, options.processorOptions.params)
    }

    this.initLookaheadBuffer()

    this.port.onmessage = (event) => {
      if (event.data.type === 'setParams') {
        Object.assign(this.params, event.data.params)
        this.initLookaheadBuffer()
      }
    }
  }

  static get parameterDescriptors() {
    return []
  }

  initLookaheadBuffer() {
    const lookaheadSamples = Math.ceil(this.params.lookahead * this.sampleRate / 1000)
    this.lookaheadBuffer = new Float32Array(lookaheadSamples * 2)
    this.bufferIndex = 0
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
    const ceilingLinear = Math.pow(10, this.params.ceiling / 20)
    const lookaheadLength = this.lookaheadBuffer.length / 2

    for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
      const inputChannel = input[channel]
      const outputChannel = output[channel]
      const channelOffset = channel * lookaheadLength

      for (let i = 0; i < inputChannel.length; i++) {
        const delayedSample = this.lookaheadBuffer[this.bufferIndex + channelOffset]
        this.lookaheadBuffer[this.bufferIndex + channelOffset] = inputChannel[i]

        const peakSample = Math.abs(inputChannel[i])
        const lookaheadPeak = Math.max(peakSample, Math.abs(delayedSample))

        let targetGain = 1
        if (lookaheadPeak > thresholdLinear) {
          targetGain = thresholdLinear / lookaheadPeak
        }

        const coef = targetGain < this.gainReduction ? attackCoef : releaseCoef
        this.gainReduction = this.gainReduction * coef + targetGain * (1 - coef)

        const limitedSample = delayedSample * this.gainReduction
        outputChannel[i] = Math.max(-ceilingLinear, Math.min(ceilingLinear, limitedSample))
      }
    }

    this.bufferIndex = (this.bufferIndex + 1) % lookaheadLength

    return true
  }

  calculateCoef(timeMs) {
    return Math.exp(-1 / (this.sampleRate * timeMs / 1000))
  }
}

registerProcessor('limiter-processor', LimiterProcessor)
