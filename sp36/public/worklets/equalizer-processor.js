class EqualizerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.sampleRate = 44100
    this.filters = []
    this.params = {
      bands: [
        { frequency: 80, gain: 0, q: 1.4, type: 'lowshelf' },
        { frequency: 250, gain: 0, q: 1.4, type: 'peaking' },
        { frequency: 1000, gain: 0, q: 1.4, type: 'peaking' },
        { frequency: 4000, gain: 0, q: 1.4, type: 'peaking' },
        { frequency: 12000, gain: 0, q: 1.4, type: 'highshelf' }
      ],
      bypassed: false
    }

    if (options.processorOptions && options.processorOptions.params) {
      Object.assign(this.params, options.processorOptions.params)
    }

    this.initFilters()

    this.port.onmessage = (event) => {
      if (event.data.type === 'setParams') {
        Object.assign(this.params, event.data.params)
        this.initFilters()
      }
    }
  }

  static get parameterDescriptors() {
    return []
  }

  initFilters() {
    this.filters = this.params.bands.map((band, index) => {
      const channels = 2
      return Array.from({ length: channels }, () => ({
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0
      }))
    })
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

    for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
      const inputChannel = input[channel]
      let outputChannel = output[channel]

      for (let i = 0; i < inputChannel.length; i++) {
        let sample = inputChannel[i]

        this.params.bands.forEach((band, bandIndex) => {
          const filterState = this.filters[bandIndex][channel]
          const { b0, b1, b2, a1, a2 } = this.calculateCoefficients(band)
          
          const x0 = sample
          const y0 = b0 * x0 + b1 * filterState.x1 + b2 * filterState.x2 - a1 * filterState.y1 - a2 * filterState.y2
          
          filterState.x2 = filterState.x1
          filterState.x1 = x0
          filterState.y2 = filterState.y1
          filterState.y1 = y0
          
          sample = y0
        })

        outputChannel[i] = sample
      }
    }

    return true
  }

  calculateCoefficients(band) {
    const f0 = band.frequency
    const gain = band.gain
    const q = band.q
    const type = band.type
    const fs = this.sampleRate

    const w0 = 2 * Math.PI * f0 / fs
    const alpha = Math.sin(w0) / (2 * q)
    const a = Math.sqrt(Math.pow(10, gain / 40))

    let b0, b1, b2, a1, a2

    switch (type) {
      case 'lowshelf':
        const beta = Math.sqrt(a) / q
        b0 = a * ((a + 1) - (a - 1) * Math.cos(w0) + 2 * Math.sqrt(a) * alpha)
        b1 = 2 * a * ((a - 1) - (a + 1) * Math.cos(w0))
        b2 = a * ((a + 1) - (a - 1) * Math.cos(w0) - 2 * Math.sqrt(a) * alpha)
        const a0shelf = (a + 1) + (a - 1) * Math.cos(w0) + 2 * Math.sqrt(a) * alpha
        a1 = -2 * ((a - 1) + (a + 1) * Math.cos(w0))
        a2 = (a + 1) + (a - 1) * Math.cos(w0) - 2 * Math.sqrt(a) * alpha
        b0 /= a0shelf
        b1 /= a0shelf
        b2 /= a0shelf
        a1 /= a0shelf
        a2 /= a0shelf
        break

      case 'highshelf':
        const betaH = Math.sqrt(a) / q
        b0 = a * ((a + 1) + (a - 1) * Math.cos(w0) + 2 * Math.sqrt(a) * alpha)
        b1 = -2 * a * ((a - 1) + (a + 1) * Math.cos(w0))
        b2 = a * ((a + 1) + (a - 1) * Math.cos(w0) - 2 * Math.sqrt(a) * alpha)
        const a0high = (a + 1) - (a - 1) * Math.cos(w0) + 2 * Math.sqrt(a) * alpha
        a1 = 2 * ((a - 1) - (a + 1) * Math.cos(w0))
        a2 = (a + 1) - (a - 1) * Math.cos(w0) - 2 * Math.sqrt(a) * alpha
        b0 /= a0high
        b1 /= a0high
        b2 /= a0high
        a1 /= a0high
        a2 /= a0high
        break

      case 'peaking':
      default:
        b0 = 1 + alpha * a
        b1 = -2 * Math.cos(w0)
        b2 = 1 - alpha * a
        const a0peak = 1 + alpha / a
        a1 = -2 * Math.cos(w0)
        a2 = 1 - alpha / a
        b0 /= a0peak
        b1 /= a0peak
        b2 /= a0peak
        a1 /= a0peak
        a2 /= a0peak
        break
    }

    return { b0, b1, b2, a1, a2 }
  }
}

registerProcessor('equalizer-processor', EqualizerProcessor)
