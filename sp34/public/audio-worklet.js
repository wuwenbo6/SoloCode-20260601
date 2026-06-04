const VOICE_POOL_SIZE = 32;
const BUFFER_CHUNK_SIZE = 512;

class Voice {
  constructor() {
    this.active = false;
    this.sample = null;
    this.position = 0;
    this.velocity = 0;
    this.fadeIn = 0;
    this.fadeOut = 0;
    this.fadePosition = 0;
    this.fadeLength = 64;
    this.releasing = false;
  }

  reset(sample, velocity) {
    this.active = true;
    this.sample = sample;
    this.position = 0;
    this.velocity = velocity;
    this.fadeIn = 1;
    this.fadeOut = 1;
    this.fadePosition = 0;
    this.fadeLength = Math.min(64, sample.length >> 2);
    this.releasing = false;
  }

  release() {
    this.releasing = true;
    this.fadePosition = 0;
    this.fadeLength = Math.min(256, (this.sample.length - this.position) >> 1);
    if (this.fadeLength < 16) this.fadeLength = 16;
  }

  getNextSample() {
    if (!this.active || !this.sample) return 0;

    if (this.position >= this.sample.length) {
      this.active = false;
      return 0;
    }

    let amp = this.velocity;

    if (this.fadePosition < this.fadeLength) {
      const fadeRatio = this.fadePosition / this.fadeLength;
      if (this.releasing) {
        amp *= (1 - fadeRatio);
      }
    }

    if (this.releasing && this.fadePosition >= this.fadeLength) {
      this.active = false;
      return 0;
    }

    const sample = this.sample[this.position] * amp;
    this.position++;
    this.fadePosition++;
    return sample;
  }
}

class SamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.samples = new Map();
    this.sampleChunks = new Map();
    this.loadingSamples = new Map();
    this.voicePool = [];
    this.activeVoiceCount = 0;
    this.outputBuffer = new Float32Array(128);

    for (let i = 0; i < VOICE_POOL_SIZE; i++) {
      this.voicePool.push(new Voice());
    }

    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type, midiNumber, velocity, sampleData, chunkIndex, totalChunks } = event.data;

    if (type === 'loadSampleStart') {
      this.loadingSamples.set(midiNumber, {
        chunks: new Array(totalChunks),
        received: 0,
        total: totalChunks,
        length: event.data.sampleLength
      });
    } else if (type === 'loadSampleChunk') {
      const loading = this.loadingSamples.get(midiNumber);
      if (loading) {
        loading.chunks[chunkIndex] = new Float32Array(sampleData);
        loading.received++;

        if (loading.received >= loading.total) {
          const fullSample = new Float32Array(loading.length);
          let offset = 0;
          for (let i = 0; i < loading.chunks.length; i++) {
            fullSample.set(loading.chunks[i], offset);
            offset += loading.chunks[i].length;
          }
          this.samples.set(midiNumber, fullSample);
          this.loadingSamples.delete(midiNumber);
          this.port.postMessage({ type: 'sampleLoaded', midiNumber });
        }
      }
    } else if (type === 'loadSample') {
      this.samples.set(midiNumber, new Float32Array(sampleData));
    } else if (type === 'noteOn') {
      this.startVoice(midiNumber, velocity);
    } else if (type === 'noteOff') {
      this.releaseVoice(midiNumber);
    }
  }

  startVoice(midiNumber, velocity) {
    const sample = this.samples.get(midiNumber);
    if (!sample) return;

    let voice = null;
    for (let i = 0; i < this.voicePool.length; i++) {
      if (!this.voicePool[i].active) {
        voice = this.voicePool[i];
        break;
      }
    }

    if (!voice) {
      let oldest = 0;
      let oldestPos = Infinity;
      for (let i = 0; i < this.voicePool.length; i++) {
        if (this.voicePool[i].position > oldestPos) continue;
        oldestPos = this.voicePool[i].position;
        oldest = i;
      }
      voice = this.voicePool[oldest];
    }

    voice.reset(sample, velocity / 127);
  }

  releaseVoice(midiNumber) {
    for (let i = 0; i < this.voicePool.length; i++) {
      if (this.voicePool[i].active && !this.voicePool[i].releasing) {
        voice_release_if_match(this.voicePool[i], midiNumber, this.samples);
      }
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    const blockSize = channel.length;

    this.outputBuffer.fill(0);

    for (let v = 0; v < this.voicePool.length; v++) {
      const voice = this.voicePool[v];
      if (!voice.active) continue;

      for (let i = 0; i < blockSize; i++) {
        this.outputBuffer[i] += voice.getNextSample();
      }
    }

    for (let i = 0; i < blockSize; i++) {
      channel[i] = this.outputBuffer[i];
    }

    return true;
  }
}

function voice_release_if_match(voice, midiNumber, samplesMap) {
  for (const [key, sample] of samplesMap) {
    if (voice.sample === sample && key === midiNumber) {
      voice.release();
      return;
    }
  }
}

registerProcessor('sampler-processor', SamplerProcessor);
