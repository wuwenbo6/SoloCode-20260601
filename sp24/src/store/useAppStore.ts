import { create } from 'zustand';
import {
  AppConfig,
  Background,
  DEFAULT_CONFIG,
  PRESET_BACKGROUNDS,
  SegmentationConfig,
  CameraConfig,
  RecordingConfig,
  JanusConfig,
  Participant,
} from '@/types';

interface AppState {
  config: AppConfig;
  isCameraActive: boolean;
  isModelLoaded: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  recordingTime: number;
  fps: number;
  modelLoadingProgress: number;
  error: string | null;
  selectedBackground: Background | null;
  customBackgrounds: Background[];
  showSettings: boolean;
  showBackgroundSelector: boolean;
  recordedVideoUrl: string | null;
  stream: MediaStream | null;
  isConferenceMode: boolean;
  conferenceParticipants: Participant[];
  showJoinModal: boolean;

  setConfig: (config: Partial<AppConfig>) => void;
  setCameraConfig: (config: Partial<CameraConfig>) => void;
  setSegmentationConfig: (config: Partial<SegmentationConfig>) => void;
  setRecordingConfig: (config: Partial<RecordingConfig>) => void;
  setJanusConfig: (config: Partial<JanusConfig>) => void;
  setCameraActive: (active: boolean) => void;
  setModelLoaded: (loaded: boolean) => void;
  setRecording: (recording: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setRecordingTime: (time: number) => void;
  setFps: (fps: number) => void;
  setModelLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setSelectedBackground: (background: Background | null) => void;
  addCustomBackground: (background: Background) => void;
  removeCustomBackground: (id: string) => void;
  setShowSettings: (show: boolean) => void;
  setShowBackgroundSelector: (show: boolean) => void;
  setRecordedVideoUrl: (url: string | null) => void;
  setStream: (stream: MediaStream | null) => void;
  setConferenceMode: (enabled: boolean) => void;
  setConferenceParticipants: (participants: Participant[]) => void;
  setShowJoinModal: (show: boolean) => void;
  resetState: () => void;
}

const initialBackground: Background = {
  id: 'preset-blur',
  type: 'blur',
  source: '',
  name: '模糊背景',
  blurAmount: 15,
  thumbnail: 'blur',
};

export const useAppStore = create<AppState>((set, get) => ({
  config: DEFAULT_CONFIG,
  isCameraActive: false,
  isModelLoaded: false,
  isRecording: false,
  isProcessing: false,
  recordingTime: 0,
  fps: 0,
  modelLoadingProgress: 0,
  error: null,
  selectedBackground: initialBackground,
  customBackgrounds: [],
  showSettings: false,
  showBackgroundSelector: false,
  recordedVideoUrl: null,
  stream: null,
  isConferenceMode: false,
  conferenceParticipants: [],
  showJoinModal: false,

  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),

  setCameraConfig: (config) =>
    set((state) => ({
      config: {
        ...state.config,
        camera: { ...state.config.camera, ...config },
      },
    })),

  setSegmentationConfig: (config) =>
    set((state) => ({
      config: {
        ...state.config,
        segmentation: { ...state.config.segmentation, ...config },
      },
    })),

  setRecordingConfig: (config) =>
    set((state) => ({
      config: {
        ...state.config,
        recording: { ...state.config.recording, ...config },
      },
    })),

  setJanusConfig: (config) =>
    set((state) => ({
      config: {
        ...state.config,
        janus: { ...state.config.janus, ...config },
      },
    })),

  setCameraActive: (active) => set({ isCameraActive: active }),
  setModelLoaded: (loaded) => set({ isModelLoaded: loaded }),
  setRecording: (recording) => set({ isRecording: recording }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setRecordingTime: (time) => set({ recordingTime: time }),
  setFps: (fps) => set({ fps }),
  setModelLoadingProgress: (progress) => set({ modelLoadingProgress: progress }),
  setError: (error) => set({ error }),
  setSelectedBackground: (background) => set({ selectedBackground: background }),

  addCustomBackground: (background) =>
    set((state) => ({
      customBackgrounds: [...state.customBackgrounds, background],
    })),

  removeCustomBackground: (id) =>
    set((state) => ({
      customBackgrounds: state.customBackgrounds.filter((b) => b.id !== id),
    })),

  setShowSettings: (show) => set({ showSettings: show }),
  setShowBackgroundSelector: (show) => set({ showBackgroundSelector: show }),
  setRecordedVideoUrl: (url) => set({ recordedVideoUrl: url }),
  setStream: (stream) => set({ stream }),
  setConferenceMode: (enabled) => set({ isConferenceMode: enabled }),
  setConferenceParticipants: (participants) => set({ conferenceParticipants: participants }),
  setShowJoinModal: (show) => set({ showJoinModal: show }),

  resetState: () => {
    const state = get();
    if (state.recordedVideoUrl) {
      URL.revokeObjectURL(state.recordedVideoUrl);
    }
    set({
      isCameraActive: false,
      isRecording: false,
      isProcessing: false,
      recordingTime: 0,
      fps: 0,
      error: null,
      recordedVideoUrl: null,
      stream: null,
      isConferenceMode: false,
      conferenceParticipants: [],
      showJoinModal: false,
    });
  },
}));

export { PRESET_BACKGROUNDS };
