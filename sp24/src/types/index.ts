export type BackgroundType = 'image' | 'video' | 'blur' | 'transparent' | 'color' | 'bokeh';

export type Resolution = '480p' | '720p' | '1080p';

export type SegmentationModel = 'bodypix';

export type AccuracyLevel = 'low' | 'medium' | 'high';

export type RecordingFormat = 'webm' | 'mp4';

export type BlurLevel = 'light' | 'medium' | 'strong' | 'extreme';

export interface CameraConfig {
  resolution: Resolution;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export interface SegmentationConfig {
  model: SegmentationModel;
  accuracy: AccuracyLevel;
  edgeSmoothing: number;
  foregroundThreshold: number;
  frameSkip: number;
  featherRadius: number;
  temporalSmooth: number;
}

export interface RecordingConfig {
  format: RecordingFormat;
  bitrate: number;
  includeAudio: boolean;
}

export interface AppConfig {
  camera: CameraConfig;
  segmentation: SegmentationConfig;
  recording: RecordingConfig;
  janus: JanusConfig;
}

export interface JanusConfig {
  serverUrl: string;
  roomId: number;
  displayName: string;
}

export interface Background {
  id: string;
  type: BackgroundType;
  source: string | HTMLImageElement | HTMLVideoElement;
  thumbnail?: string;
  name?: string;
  blurAmount?: number;
  color?: string;
  bokehLevel?: BlurLevel;
  downloadable?: boolean;
  downloadUrl?: string;
}

export interface FrameData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
  format: 'RGBA' | 'RGB';
}

export interface MaskData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
}

export interface ModelConfig {
  model: SegmentationModel;
  accuracy: AccuracyLevel;
}

export type WorkerMessage =
  | { type: 'LOAD_MODEL'; config: ModelConfig }
  | { type: 'PROCESS_FRAME'; frame: FrameData; transfer: Transferable[] }
  | { type: 'UPDATE_CONFIG'; config: SegmentationConfig }
  | { type: 'UNLOAD_MODEL' };

export type MainThreadMessage =
  | { type: 'MODEL_LOADED' }
  | { type: 'MODEL_LOAD_ERROR'; error: string }
  | { type: 'FRAME_PROCESSED'; mask: MaskData; transfer: Transferable[] }
  | { type: 'PROCESS_ERROR'; error: string }
  | { type: 'FPS_UPDATE'; fps: number };

export const RESOLUTION_MAP: Record<Resolution, { width: number; height: number }> = {
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

export const DEFAULT_CONFIG: AppConfig = {
  camera: {
    resolution: '720p',
    frameRate: 30,
    facingMode: 'user',
  },
  segmentation: {
    model: 'bodypix',
    accuracy: 'medium',
    edgeSmoothing: 5,
    foregroundThreshold: 0.5,
    frameSkip: 2,
    featherRadius: 3,
    temporalSmooth: 0.4,
  },
  recording: {
    format: 'webm',
    bitrate: 2500000,
    includeAudio: true,
  },
  janus: {
    serverUrl: 'ws://localhost:8188',
    roomId: 1234,
    displayName: '用户',
  },
};

export const BLUR_LEVEL_MAP: Record<BlurLevel, { blur: number; brightness: number; contrast: number }> = {
  light: { blur: 8, brightness: 1, contrast: 1 },
  medium: { blur: 18, brightness: 1.05, contrast: 1.05 },
  strong: { blur: 30, brightness: 1.1, contrast: 1.1 },
  extreme: { blur: 50, brightness: 1.15, contrast: 1.15 },
};

export const PRESET_BACKGROUNDS: Omit<Background, 'id' | 'source'>[] = [
  { type: 'blur', name: '轻度模糊', blurAmount: 8, thumbnail: 'blur-light' },
  { type: 'blur', name: '中度模糊', blurAmount: 18, thumbnail: 'blur-medium' },
  { type: 'blur', name: '高度模糊', blurAmount: 30, thumbnail: 'blur-strong' },
  { type: 'bokeh', name: '大光圈虚化', bokehLevel: 'strong', thumbnail: 'bokeh' },
  { type: 'color', name: '深蓝', color: '#0F172A', thumbnail: '#0F172A' },
  { type: 'color', name: '翠绿', color: '#10B981', thumbnail: '#10B981' },
  { type: 'color', name: '紫色', color: '#8B5CF6', thumbnail: '#8B5CF6' },
  { type: 'color', name: '黑色', color: '#000000', thumbnail: '#000000' },
  { type: 'transparent', name: '透明', thumbnail: 'transparent' },
];

export const VIRTUAL_BACKGROUNDS: Omit<Background, 'id'>[] = [
  {
    type: 'image',
    name: '现代办公室',
    source: 'office',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
  {
    type: 'image',
    name: '热带海滩',
    source: 'beach',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
  {
    type: 'image',
    name: '会议室',
    source: 'conference',
    thumbnail: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
  {
    type: 'image',
    name: '书房',
    source: 'study',
    thumbnail: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
  {
    type: 'image',
    name: '城市夜景',
    source: 'city',
    thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
  {
    type: 'image',
    name: '自然森林',
    source: 'forest',
    thumbnail: 'https://images.unsplash.com/photo-14483752405869-8e974853859f?w=300&h=200&fit=crop',
    downloadUrl: 'https://images.unsplash.com/photo-14483752405869-8e974853859f?w=1920&h=1080&fit=crop',
    downloadable: true,
  },
];

export interface Participant {
  id: string;
  displayName: string;
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocal: boolean;
  isSpeaking: boolean;
}

export interface JanusClientState {
  isConnected: boolean;
  isInRoom: boolean;
  participants: Participant[];
  error: string | null;
  roomId: number;
  displayName: string;
}

export interface BodyPixModelConfig {
  architecture?: 'MobileNetV1' | 'ResNet50';
  outputStride?: 8 | 16 | 32;
  multiplier?: number;
  quantBytes?: 1 | 2 | 4;
}

export interface BodyPixInferenceConfig {
  flipHorizontal?: boolean;
  internalResolution?: number | string;
  segmentationThreshold?: number;
  maxDetections?: number;
  scoreThreshold?: number;
  nmsRadius?: number;
}
