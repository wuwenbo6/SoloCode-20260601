import { create } from 'zustand';

export interface TelemetryData {
  altitude: number;
  speed: number;
  gpsLat: number;
  gpsLon: number;
  batteryVoltage: number;
  signalStrength: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface GimbalState {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface StreamStatus {
  running: boolean;
  resolution: string;
  fps: number;
  uptime: number;
  clientCount: number;
  clients: string[];
}

export interface ConnectionState {
  webTransport: 'disconnected' | 'connecting' | 'connected';
  webSocket: 'disconnected' | 'connecting' | 'connected';
}

interface FPVStore {
  telemetry: TelemetryData;
  gimbal: GimbalState;
  streamStatus: StreamStatus;
  recording: boolean;
  recordingElapsedMs: number;
  connection: ConnectionState;

  setTelemetry: (data: Partial<TelemetryData>) => void;
  setGimbal: (data: Partial<GimbalState>) => void;
  setStreamStatus: (data: Partial<StreamStatus>) => void;
  setRecording: (recording: boolean) => void;
  setRecordingElapsed: (ms: number) => void;
  setConnection: (data: Partial<ConnectionState>) => void;
}

const defaultTelemetry: TelemetryData = {
  altitude: 0,
  speed: 0,
  gpsLat: 0,
  gpsLon: 0,
  batteryVoltage: 0,
  signalStrength: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
};

const defaultGimbal: GimbalState = {
  yaw: 0,
  pitch: 0,
  roll: 0,
};

const defaultStreamStatus: StreamStatus = {
  running: false,
  resolution: '',
  fps: 0,
  uptime: 0,
  clientCount: 0,
  clients: [],
};

const defaultConnection: ConnectionState = {
  webTransport: 'disconnected',
  webSocket: 'disconnected',
};

export const useFPVStore = create<FPVStore>((set) => ({
  telemetry: defaultTelemetry,
  gimbal: defaultGimbal,
  streamStatus: defaultStreamStatus,
  recording: false,
  recordingElapsedMs: 0,
  connection: defaultConnection,

  setTelemetry: (data) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...data } })),
  setGimbal: (data) =>
    set((state) => ({ gimbal: { ...state.gimbal, ...data } })),
  setStreamStatus: (data) =>
    set((state) => ({ streamStatus: { ...state.streamStatus, ...data } })),
  setRecording: (recording) => set({ recording }),
  setRecordingElapsed: (ms) => set({ recordingElapsedMs: ms }),
  setConnection: (data) =>
    set((state) => ({ connection: { ...state.connection, ...data } })),
}));
