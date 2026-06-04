import { CCEvent, AutomationTrack, EffectChain } from '../types';
import { audioEngine } from './AudioEngine';

export const CC_MAPPINGS: Record<number, { param: string; min: number; max: number; trackParam: string }> = {
  1: { param: 'filter.frequency', min: 20, max: 20000, trackParam: 'effects.filter.frequency' },
  2: { param: 'filter.q', min: 0.1, max: 20, trackParam: 'effects.filter.q' },
  7: { param: 'volume', min: 0, max: 1, trackParam: 'volume' },
  10: { param: 'pan', min: 0, max: 1, trackParam: 'pan' },
  11: { param: 'expression', min: 0, max: 1, trackParam: 'volume' },
  12: { param: 'reverb.mix', min: 0, max: 1, trackParam: 'effects.reverb.mix' },
  13: { param: 'delay.time', min: 0.01, max: 2, trackParam: 'effects.delay.time' },
  14: { param: 'delay.feedback', min: 0, max: 0.95, trackParam: 'effects.delay.feedback' },
  15: { param: 'delay.mix', min: 0, max: 1, trackParam: 'effects.delay.mix' },
  16: { param: 'filter.gain', min: -40, max: 40, trackParam: 'effects.filter.gain' },
  91: { param: 'reverb.decay', min: 0.1, max: 5, trackParam: 'effects.reverb.decay' },
  92: { param: 'reverb.mix', min: 0, max: 1, trackParam: 'effects.reverb.mix' },
};

export class AutomationManager {
  private activeAutomations: Map<string, AutomationTrack> = new Map();
  private isRecording = false;
  private currentTrackId: string | null = null;
  private recordingStartTime = 0;
  private activeCCValues: Map<number, number> = new Map();
  private smoothedCCValues: Map<number, number> = new Map();
  private smoothingFactor = 0.3;
  private lastCCEventTime: Map<number, number> = new Map();
  private debounceThreshold = 10;

  setCurrentTrack(trackId: string | null) {
    this.currentTrackId = trackId;
  }

  startRecording(trackId: string) {
    this.isRecording = true;
    this.currentTrackId = trackId;
    this.recordingStartTime = audioEngine.getCurrentTime();
    this.activeCCValues.clear();
    this.lastCCEventTime.clear();
  }

  stopRecording(): AutomationTrack[] {
    if (!this.isRecording) return [];

    this.isRecording = false;
    const recordedAutomations: AutomationTrack[] = [];

    for (const [, events] of this.activeAutomations) {
      if (events.events.length > 0) {
        recordedAutomations.push(events);
      }
    }

    this.activeAutomations.clear();
    return recordedAutomations;
  }

  handleCCEvent(
    controller: number,
    value: number,
    audioTime: number,
    trackId: string,
    _isPlaying: boolean
  ): CCEvent | null {
    const now = performance.now();
    const lastTime = this.lastCCEventTime.get(controller) || 0;
    if (now - lastTime < this.debounceThreshold) {
      return null;
    }
    this.lastCCEventTime.set(controller, now);

    const mapping = CC_MAPPINGS[controller];
    if (!mapping) {
      this.applyRawCC(controller, value, trackId);
      return null;
    }

    const normalizedValue = value / 127;
    const mappedValue = mapping.min + normalizedValue * (mapping.max - mapping.min);

    const previousSmoothed = this.smoothedCCValues.get(controller) ?? mappedValue;
    const smoothedValue = previousSmoothed + (mappedValue - previousSmoothed) * this.smoothingFactor;
    this.smoothedCCValues.set(controller, smoothedValue);

    this.applyCCMapping(controller, smoothedValue, trackId, mapping);
    this.activeCCValues.set(controller, value);

    if (this.isRecording && this.currentTrackId === trackId) {
      const timeMs = (audioTime - this.recordingStartTime) * 1000;
      const event: CCEvent = {
        id: `cc-${Date.now()}-${Math.random()}`,
        controller,
        value,
        time: Math.max(0, timeMs)
      };

      let automation = this.activeAutomations.get(`${trackId}-${controller}`);
      if (!automation) {
        automation = {
          id: `auto-${trackId}-${controller}`,
          trackId,
          parameterName: mapping.param,
          ccNumber: controller,
          events: []
        };
        this.activeAutomations.set(`${trackId}-${controller}`, automation);
      }
      automation.events.push(event);
      return event;
    }

    return null;
  }

  private applyRawCC(_controller: number, _value: number, _trackId: string) {
  }

  private applyCCMapping(
    _controller: number,
    mappedValue: number,
    trackId: string,
    mapping: { param: string; min: number; max: number; trackParam: string }
  ) {
    if (mapping.trackParam === 'volume') {
      audioEngine.setTrackVolume(trackId, mappedValue);
      return;
    }

    const effects: Partial<EffectChain> = {};

    if (mapping.trackParam.startsWith('effects.reverb')) {
      effects.reverb = {
        enabled: true,
        mix: 0.3,
        decay: 2
      };
      if (mapping.param === 'reverb.mix') effects.reverb.mix = mappedValue;
      if (mapping.param === 'reverb.decay') effects.reverb.decay = mappedValue;
    }

    if (mapping.trackParam.startsWith('effects.delay')) {
      effects.delay = {
        enabled: true,
        time: 0.3,
        feedback: 0.4,
        mix: 0.3
      };
      if (mapping.param === 'delay.time') effects.delay.time = mappedValue;
      if (mapping.param === 'delay.feedback') effects.delay.feedback = mappedValue;
      if (mapping.param === 'delay.mix') effects.delay.mix = mappedValue;
    }

    if (mapping.trackParam.startsWith('effects.filter')) {
      effects.filter = {
        enabled: true,
        type: 'lowpass',
        frequency: 1000,
        q: 1,
        gain: 0
      };
      if (mapping.param === 'filter.frequency') effects.filter.frequency = mappedValue;
      if (mapping.param === 'filter.q') effects.filter.q = mappedValue;
      if (mapping.param === 'filter.gain') effects.filter.gain = mappedValue;
    }

    if (Object.keys(effects).length > 0) {
      audioEngine.updateTrackEffects(trackId, effects as EffectChain);
    }
  }

  playAutomationEvents(
    automationTracks: AutomationTrack[],
    currentTimeMs: number,
    trackId: string,
    lastEventIndex: Map<string, number>
  ): Map<string, number> {
    const newLastIndex = new Map(lastEventIndex);

    automationTracks.forEach((autoTrack) => {
      const key = autoTrack.id;
      let idx = newLastIndex.get(key) || 0;

      while (idx < autoTrack.events.length && autoTrack.events[idx].time <= currentTimeMs) {
        const event = autoTrack.events[idx];
        const mapping = CC_MAPPINGS[event.controller];
        if (mapping) {
          const normalizedValue = event.value / 127;
          const mappedValue = mapping.min + normalizedValue * (mapping.max - mapping.min);
          this.applyCCMapping(event.controller, mappedValue, trackId, mapping);
        }
        idx++;
      }

      newLastIndex.set(key, idx);
    });

    return newLastIndex;
  }

  getCCValue(controller: number): number {
    return this.activeCCValues.get(controller) || 0;
  }

  createAutomationTrack(
    trackId: string,
    paramName: string,
    ccNumber: number
  ): AutomationTrack {
    return {
      id: `auto-${trackId}-${ccNumber}-${Date.now()}`,
      trackId,
      parameterName: paramName,
      ccNumber,
      events: []
    };
  }

  quantizeEvents(events: CCEvent[], bpm: number): CCEvent[] {
    const beatMs = 60000 / bpm;
    const gridMs = beatMs / 16;
    return events.map(e => ({
      ...e,
      time: Math.round(e.time / gridMs) * gridMs
    }));
  }

  smoothEvents(events: CCEvent[], windowSize: number = 3): CCEvent[] {
    if (events.length < windowSize) return events;

    const smoothed: CCEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(events.length - 1, i + windowSize); j++) {
        sum += events[j].value;
        count++;
      }
      smoothed.push({
        ...events[i],
        value: Math.round(sum / count)
      });
    }
    return smoothed;
  }

  dispose() {
    this.activeAutomations.clear();
    this.activeCCValues.clear();
    this.smoothedCCValues.clear();
    this.lastCCEventTime.clear();
  }
}

export const automationManager = new AutomationManager();
