export interface Note {
  id: string;
  midiNumber: number;
  velocity: number;
  startTime: number;
  endTime: number | null;
  duration?: number;
}

export interface CCEvent {
  id: string;
  controller: number;
  value: number;
  time: number;
}

export interface AutomationTrack {
  id: string;
  trackId: string;
  parameterName: string;
  ccNumber: number;
  events: CCEvent[];
}

export interface Track {
  id: string;
  name: string;
  notes: Note[];
  muted: boolean;
  solo: boolean;
  volume: number;
  effects: EffectChain;
  instrument: string;
  automation: AutomationTrack[];
  vst?: VSTPlugin;
}

export interface VSTPlugin {
  id: string;
  name: string;
  enabled: boolean;
  path: string;
  parameters: VSTParameter[];
}

export interface VSTParameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
}

export interface EffectChain {
  reverb: ReverbSettings;
  delay: DelaySettings;
  filter: FilterSettings;
}

export interface ReverbSettings {
  enabled: boolean;
  mix: number;
  decay: number;
}

export interface DelaySettings {
  enabled: boolean;
  time: number;
  feedback: number;
  mix: number;
}

export interface FilterSettings {
  enabled: boolean;
  type: BiquadFilterType;
  frequency: number;
  q: number;
  gain: number;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface MetronomeSettings {
  enabled: boolean;
  bpm: number;
  volume: number;
  accentFirstBeat: boolean;
}

export type RecordingState = 'idle' | 'recording' | 'playing';

export interface MIDIDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
}

export type QuantizationValue = 1 | 2 | 4 | 8 | 16 | 32;
