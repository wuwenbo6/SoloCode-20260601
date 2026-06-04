import { Project, Note, AutomationTrack } from '../types';

const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;

export class AudioExporter {
  async exportToWAV(
    project: Project,
    trackIds?: string[],
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const tracksToExport = trackIds
      ? project.tracks.filter(t => trackIds.includes(t.id))
      : project.tracks;

    const totalDurationMs = this.calculateTotalDuration(tracksToExport);
    const totalDurationSeconds = Math.max(totalDurationMs / 1000 + 2, 5);

    console.log(`Exporting ${tracksToExport.length} track(s), duration: ${totalDurationSeconds.toFixed(2)}s`);

    const offlineContext = new OfflineAudioContext(
      2,
      Math.ceil(totalDurationSeconds * SAMPLE_RATE),
      SAMPLE_RATE
    );

    const masterGain = offlineContext.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(offlineContext.destination);

    for (let i = 0; i < tracksToExport.length; i++) {
      const track = tracksToExport[i];
      if (track.muted) continue;

      const trackChain = this.buildTrackChain(offlineContext, track, masterGain);
      this.scheduleTrackNotes(offlineContext, track, trackChain.input);
      this.scheduleAutomation(offlineContext, track, trackChain);

      if (onProgress) {
        onProgress(((i + 1) / tracksToExport.length) * 50);
      }
    }

    if (onProgress) onProgress(60);

    console.log('Starting offline rendering...');
    const renderedBuffer = await offlineContext.startRendering();

    if (onProgress) onProgress(90);

    const wavBlob = this.encodeWAV(renderedBuffer);

    if (onProgress) onProgress(100);

    return wavBlob;
  }

  private calculateTotalDuration(tracks: { notes: Note[]; automation: AutomationTrack[] }[]): number {
    let maxDuration = 0;
    tracks.forEach(track => {
      track.notes.forEach(note => {
        const end = note.startTime + (note.duration || 500);
        if (end > maxDuration) maxDuration = end;
      });
      track.automation.forEach(auto => {
        if (auto.events.length > 0) {
          const lastEvent = auto.events[auto.events.length - 1];
          if (lastEvent.time > maxDuration) maxDuration = lastEvent.time;
        }
      });
    });
    return maxDuration;
  }

  private buildTrackChain(
    offlineContext: OfflineAudioContext,
    track: { volume: number; muted: boolean; effects: any },
    masterGain: GainNode
  ): TrackAudioChain {
    const input = offlineContext.createGain();
    const filter = offlineContext.createBiquadFilter();
    const delay = offlineContext.createDelay(5);
    const delayFeedback = offlineContext.createGain();
    const delayMix = offlineContext.createGain();
    const delayDry = offlineContext.createGain();
    const convolver = offlineContext.createConvolver();
    const reverbMix = offlineContext.createGain();
    const reverbDry = offlineContext.createGain();
    const output = offlineContext.createGain();

    const effects = track.effects;

    filter.type = effects.filter?.type || 'lowpass';
    filter.frequency.value = effects.filter?.enabled ? effects.filter.frequency : 20000;
    filter.Q.value = effects.filter?.enabled ? effects.filter.q : 1;
    filter.gain.value = effects.filter?.enabled ? effects.filter.gain : 0;

    delay.delayTime.value = effects.delay?.time || 0.3;
    delayFeedback.gain.value = effects.delay?.feedback || 0.4;
    delayMix.gain.value = effects.delay?.enabled ? effects.delay.mix : 0;
    delayDry.gain.value = effects.delay?.enabled ? (1 - effects.delay.mix) : 1;

    reverbMix.gain.value = effects.reverb?.enabled ? effects.reverb.mix : 0;
    reverbDry.gain.value = effects.reverb?.enabled ? (1 - effects.reverb.mix) : 1;

    output.gain.value = track.muted ? 0 : track.volume;

    const impulseResponse = this.createReverbImpulse(
      offlineContext,
      effects.reverb?.decay || 2,
      2.5
    );
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
    output.connect(masterGain);

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

  private createReverbImpulse(
    context: OfflineAudioContext,
    duration: number,
    decay: number
  ): AudioBuffer {
    const length = Math.floor(duration * context.sampleRate);
    const buffer = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return buffer;
  }

  private scheduleTrackNotes(
    offlineContext: OfflineAudioContext,
    track: { notes: Note[]; id: string; muted: boolean; volume: number },
    input: GainNode
  ) {
    track.notes.forEach((note) => {
      const startTime = note.startTime / 1000;
      const duration = (note.duration || 500) / 1000;
      const freq = 440 * Math.pow(2, (note.midiNumber - 69) / 12);
      const gain = (note.velocity / 127) * 0.3;

      const osc = offlineContext.createOscillator();
      const oscGain = offlineContext.createGain();
      const envelope = offlineContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;
      oscGain.gain.value = gain;

      envelope.gain.setValueAtTime(0, startTime);
      envelope.gain.linearRampToValueAtTime(1, startTime + 0.005);
      envelope.gain.setValueAtTime(0.7, startTime + duration * 0.8);
      envelope.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(oscGain);
      oscGain.connect(envelope);
      envelope.connect(input);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  }

  private scheduleAutomation(
    _offlineContext: OfflineAudioContext,
    track: { automation: AutomationTrack[]; effects: any; volume: number },
    chain: TrackAudioChain
  ) {
    track.automation.forEach(autoTrack => {
      autoTrack.events.forEach(event => {
        const time = event.time / 1000;
        const normalizedValue = event.value / 127;

        if (autoTrack.parameterName === 'volume') {
          chain.output.gain.setValueAtTime(
            normalizedValue * track.volume,
            time
          );
        } else if (autoTrack.parameterName.startsWith('filter.')) {
          if (autoTrack.parameterName === 'filter.frequency') {
            chain.filter.frequency.setValueAtTime(
              20 + normalizedValue * 19980,
              time
            );
          } else if (autoTrack.parameterName === 'filter.q') {
            chain.filter.Q.setValueAtTime(
              0.1 + normalizedValue * 19.9,
              time
            );
          } else if (autoTrack.parameterName === 'filter.gain') {
            chain.filter.gain.setValueAtTime(
              -40 + normalizedValue * 80,
              time
            );
          }
        } else if (autoTrack.parameterName.startsWith('delay.')) {
          if (autoTrack.parameterName === 'delay.time') {
            chain.delay.delayTime.setValueAtTime(
              0.01 + normalizedValue * 1.99,
              time
            );
          } else if (autoTrack.parameterName === 'delay.feedback') {
            chain.delayFeedback.gain.setValueAtTime(
              normalizedValue * 0.95,
              time
            );
          } else if (autoTrack.parameterName === 'delay.mix') {
            chain.delayMix.gain.setValueAtTime(
              normalizedValue * track.effects.delay.mix,
              time
            );
          }
        } else if (autoTrack.parameterName.startsWith('reverb.')) {
          if (autoTrack.parameterName === 'reverb.mix') {
            chain.reverbMix.gain.setValueAtTime(
              normalizedValue * track.effects.reverb.mix,
              time
            );
          }
        }
      });
    });
  }

  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const byteRate = sampleRate * numberOfChannels * (BIT_DEPTH / 8);
    const blockAlign = numberOfChannels * (BIT_DEPTH / 8);

    const length = audioBuffer.length * numberOfChannels * (BIT_DEPTH / 8) + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    let offset = 0;

    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
      offset += str.length;
    };

    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, BIT_DEPTH, true); offset += 2;
    writeString('data');
    view.setUint32(offset, audioBuffer.length * numberOfChannels * (BIT_DEPTH / 8), true); offset += 4;

    const channels: Float32Array[] = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let sampleIdx = 0;
    while (offset < length) {
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][sampleIdx]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, Math.floor(intSample), true);
        offset += 2;
      }
      sampleIdx++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  downloadWAV(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

export const audioExporter = new AudioExporter();
