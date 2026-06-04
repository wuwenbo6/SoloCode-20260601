import { Note, EffectChain } from '../types';

const CHUNK_SIZE = 4096;
const FADE_TIME = 0.02;

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sampleCache: Map<number, AudioBuffer> = new Map();
  private activeOscillators: Map<string, OscillatorNode[]> = new Map();
  private activeOscGains: Map<string, GainNode[]> = new Map();
  private trackChains: Map<string, TrackAudioChain> = new Map();
  private activeMidiNotes: Map<number, string> = new Map();

  async init() {
    if (this.audioContext) return;

    this.audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    try {
      await this.audioContext.audioWorklet.addModule('/audio-worklet.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'sampler-processor');
      this.workletNode.connect(this.masterGain);
    } catch (e) {
      console.warn('AudioWorklet not available, using fallback oscillators');
    }

    await this.generateDefaultSamples();
  }

  private async generateDefaultSamples() {
    if (!this.audioContext) return;

    for (let midi = 21; midi <= 108; midi++) {
      const buffer = this.generatePianoSample(midi, 2);
      this.sampleCache.set(midi, buffer);

      if (this.workletNode) {
        const channelData = buffer.getChannelData(0);
        this.sendSampleInChunks(midi, channelData);
      }
    }
  }

  private sendSampleInChunks(midiNumber: number, channelData: Float32Array) {
    if (!this.workletNode) return;

    const totalChunks = Math.ceil(channelData.length / CHUNK_SIZE);

    this.workletNode.port.postMessage({
      type: 'loadSampleStart',
      midiNumber,
      totalChunks,
      sampleLength: channelData.length
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, channelData.length);
      const chunk = channelData.slice(start, end);

      this.workletNode.port.postMessage({
        type: 'loadSampleChunk',
        midiNumber,
        chunkIndex: i,
        totalChunks,
        sampleData: chunk.buffer
      }, [chunk.buffer]);
    }
  }

  private generatePianoSample(midiNumber: number, duration: number): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(duration * sampleRate);
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const channelData = buffer.getChannelData(0);

    const freq = 440 * Math.pow(2, (midiNumber - 69) / 12);
    const harmonicWeights = [1, 0.5, 0.25, 0.125, 0.06];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      harmonicWeights.forEach((weight, h) => {
        sample += weight * Math.sin(2 * Math.PI * freq * (h + 1) * t);
      });

      const envelope = Math.exp(-t * 3) * (1 - Math.exp(-t * 20));
      channelData[i] = sample * envelope * 0.3;
    }

    return buffer;
  }

  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  getContext(): AudioContext | null {
    return this.audioContext;
  }

  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  playNote(midiNumber: number, velocity: number = 100, trackId: string = 'default') {
    if (!this.audioContext) return;

    const trackChain = this.getOrCreateTrackChain(trackId);
    const noteId = `${midiNumber}-${Date.now()}-${Math.random()}`;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'noteOn',
        midiNumber,
        velocity,
        startTime: this.audioContext.currentTime
      });
    } else {
      const { oscillators, gains } = this.createNoteOscillators(midiNumber, velocity, trackChain);
      this.activeOscillators.set(noteId, oscillators);
      this.activeOscGains.set(noteId, gains);
    }

    this.activeMidiNotes.set(midiNumber, noteId);
    return noteId;
  }

  stopNote(noteIdOrMidi: string | number) {
    if (typeof noteIdOrMidi === 'number') {
      const midiNumber = noteIdOrMidi;
      const noteId = this.activeMidiNotes.get(midiNumber);
      if (noteId) {
        this.stopNoteById(noteId, midiNumber);
        this.activeMidiNotes.delete(midiNumber);
      } else {
        if (this.workletNode) {
          this.workletNode.port.postMessage({
            type: 'noteOff',
            midiNumber
          });
        }
      }
      return;
    }

    const noteId = noteIdOrMidi;
    for (const [midi, id] of this.activeMidiNotes) {
      if (id === noteId) {
        this.stopNoteById(noteId, midi);
        this.activeMidiNotes.delete(midi);
        return;
      }
    }
  }

  private stopNoteById(noteId: string, midiNumber: number) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'noteOff',
        midiNumber
      });
    }

    const gains = this.activeOscGains.get(noteId);
    const oscillators = this.activeOscillators.get(noteId);

    if (gains && this.audioContext) {
      const now = this.audioContext.currentTime;
      gains.forEach(g => {
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + FADE_TIME);
      });
    }

    if (oscillators && this.audioContext) {
      setTimeout(() => {
        oscillators.forEach(osc => {
          try { osc.stop(); } catch (_) {}
        });
      }, FADE_TIME * 1000 + 50);
    }

    this.activeOscillators.delete(noteId);
    this.activeOscGains.delete(noteId);
  }

  private createNoteOscillators(midiNumber: number, velocity: number, trackChain: TrackAudioChain): { oscillators: OscillatorNode[]; gains: GainNode[] } {
    if (!this.audioContext) return { oscillators: [], gains: [] };

    const freq = 440 * Math.pow(2, (midiNumber - 69) / 12);
    const gain = (velocity / 127) * 0.3;
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    const harmonicWeights = [1, 0.5, 0.25];
    harmonicWeights.forEach((weight, i) => {
      const osc = this.audioContext!.createOscillator();
      const oscGain = this.audioContext!.createGain();

      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq * (i + 1);
      oscGain.gain.value = 0;
      oscGain.gain.linearRampToValueAtTime(gain * weight, this.audioContext!.currentTime + 0.005);

      const envelope = this.audioContext!.createGain();
      envelope.gain.setValueAtTime(0, this.audioContext!.currentTime);
      envelope.gain.linearRampToValueAtTime(1, this.audioContext!.currentTime + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.3, this.audioContext!.currentTime + 0.1);

      osc.connect(oscGain);
      oscGain.connect(envelope);
      envelope.connect(trackChain.input);

      osc.start();
      oscillators.push(osc);
      gains.push(oscGain);
    });

    return { oscillators, gains };
  }

  playScheduledNote(note: Note, startTime: number, trackId: string = 'default') {
    if (!this.audioContext) return;

    const trackChain = this.getOrCreateTrackChain(trackId);
    const freq = 440 * Math.pow(2, (note.midiNumber - 69) / 12);
    const gain = (note.velocity / 127) * 0.3;
    const duration = (note.duration || 0.5) / 1000;

    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;
    oscGain.gain.value = gain;

    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.005);
    envelope.gain.setValueAtTime(0.7, startTime + duration * 0.8);
    envelope.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(oscGain);
    oscGain.connect(envelope);
    envelope.connect(trackChain.input);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private getOrCreateTrackChain(trackId: string): TrackAudioChain {
    let chain = this.trackChains.get(trackId);
    if (!chain) {
      chain = this.createTrackChain();
      this.trackChains.set(trackId, chain);
    }
    return chain;
  }

  private createTrackChain(): TrackAudioChain {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('AudioContext not initialized');
    }

    const input = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const delay = this.audioContext.createDelay(5);
    const delayFeedback = this.audioContext.createGain();
    const delayMix = this.audioContext.createGain();
    const delayDry = this.audioContext.createGain();
    const convolver = this.audioContext.createConvolver();
    const reverbMix = this.audioContext.createGain();
    const reverbDry = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    filter.Q.value = 1;

    delay.delayTime.value = 0.3;
    delayFeedback.gain.value = 0.4;
    delayMix.gain.value = 0;
    delayDry.gain.value = 1;

    reverbMix.gain.value = 0;
    reverbDry.gain.value = 1;

    const impulseResponse = this.createReverbImpulse(2, 2.5);
    convolver.buffer = impulseResponse;

    input.connect(filter);
    filter.connect(delayDry);
    filter.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayMix);
    delayDry.connect(reverbDry);
    delayMix.connect(reverbDry);
    reverbDry.connect(output);
    filter.connect(convolver);
    convolver.connect(reverbMix);
    reverbMix.connect(output);
    output.connect(this.masterGain);

    return {
      input,
      filter,
      delay,
      delayFeedback,
      delayMix,
      delayDry,
      convolver,
      reverbMix,
      reverbDry,
      output
    };
  }

  private createReverbImpulse(duration: number, decay: number): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(duration * sampleRate);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return buffer;
  }

  updateTrackEffects(trackId: string, effects: EffectChain) {
    const chain = this.trackChains.get(trackId);
    if (!chain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const t = FADE_TIME;

    if (effects.filter.enabled) {
      chain.filter.type = effects.filter.type;
      chain.filter.frequency.setTargetAtTime(effects.filter.frequency, now, t);
      chain.filter.Q.setTargetAtTime(effects.filter.q, now, t);
      chain.filter.gain.setTargetAtTime(effects.filter.gain, now, t);
    } else {
      chain.filter.frequency.setTargetAtTime(20000, now, t);
      chain.filter.Q.setTargetAtTime(1, now, t);
      chain.filter.gain.setTargetAtTime(0, now, t);
    }

    chain.delay.delayTime.setTargetAtTime(effects.delay.time, now, t);
    chain.delayFeedback.gain.setTargetAtTime(effects.delay.feedback, now, t);

    const targetDelayMix = effects.delay.enabled ? effects.delay.mix : 0;
    const targetDelayDry = effects.delay.enabled ? (1 - effects.delay.mix) : 1;
    chain.delayMix.gain.setTargetAtTime(targetDelayMix, now, t);
    chain.delayDry.gain.setTargetAtTime(targetDelayDry, now, t);

    const targetReverbMix = effects.reverb.enabled ? effects.reverb.mix : 0;
    const targetReverbDry = effects.reverb.enabled ? (1 - effects.reverb.mix) : 1;
    chain.reverbMix.gain.setTargetAtTime(targetReverbMix, now, t);
    chain.reverbDry.gain.setTargetAtTime(targetReverbDry, now, t);
  }

  setTrackVolume(trackId: string, volume: number) {
    const chain = this.trackChains.get(trackId);
    if (chain && this.audioContext) {
      chain.output.gain.setTargetAtTime(volume, this.audioContext.currentTime, FADE_TIME);
    }
  }

  setMasterVolume(volume: number) {
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, FADE_TIME);
    }
  }

  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  dispose() {
    this.activeOscillators.forEach(oscillators => {
      oscillators.forEach(osc => {
        try { osc.stop(); } catch (_) {}
      });
    });
    this.activeOscillators.clear();
    this.activeOscGains.clear();
    this.activeMidiNotes.clear();
    this.trackChains.clear();
    this.sampleCache.clear();
    this.audioContext?.close();
    this.audioContext = null;
  }
}

interface TrackAudioChain {
  input: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayMix: GainNode;
  delayDry: GainNode;
  convolver: ConvolverNode;
  reverbMix: GainNode;
  reverbDry: GainNode;
  output: GainNode;
}

export const audioEngine = new AudioEngine();
