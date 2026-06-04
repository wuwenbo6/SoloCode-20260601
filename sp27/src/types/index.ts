export interface Particle {
  position: [number, number];
  velocity: [number, number];
  color: [number, number, number];
  lodLevel: number;
}

export const PARTICLE_SIZE = 32;

export interface ForceFieldParams {
  gravityStrength: number;
  gravityRadius: number;
  repulsionStrength: number;
  repulsionRadius: number;
  vortexStrength: number;
  vortexRadius: number;
  mouseStrength: number;
  mouseRadius: number;
  damping: number;
  bounceDamping: number;
  centerX: number;
  centerY: number;
  mouseX: number;
  mouseY: number;
  mouseActive: number;
  deltaTime: number;
}

export const FORCE_FIELD_SIZE = 64;

export interface BoidsParams {
  separationStrength: number;
  separationRadius: number;
  alignmentStrength: number;
  alignmentRadius: number;
  cohesionStrength: number;
  cohesionRadius: number;
  boidsEnabled: number;
  cellSize: number;
}

export const BOIDS_SIZE = 32;

export interface RenderParams {
  particleSize: number;
  width: number;
  height: number;
  colorMode: number;
  baseColorR: number;
  baseColorG: number;
  baseColorB: number;
  time: number;
  lodBias: number;
  renderMask: number;
  viewMode: number;
  viewAngle: number;
  viewZoom: number;
}

export const RENDER_PARAMS_SIZE = 48;

export type ColorMode = 'velocity' | 'position' | 'rainbow' | 'fixed' | 'boids';

export const COLOR_MODE_VALUES: Record<ColorMode, number> = {
  velocity: 0,
  position: 1,
  rainbow: 2,
  fixed: 3,
  boids: 4,
};

export type ViewMode = 'top' | 'side' | 'perspective' | 'split';

export const VIEW_MODE_VALUES: Record<ViewMode, number> = {
  top: 0,
  side: 1,
  perspective: 2,
  split: 3,
};

export interface MouseTrajectoryPoint {
  x: number;
  y: number;
  timestamp: number;
  strength: number;
}

export interface ForceRecording {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  points: MouseTrajectoryPoint[];
  particleCount: number;
  params: PresetParams;
}

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  params: PresetParams;
}

export interface PresetParams {
  particleCount: number;
  particleSize: number;
  gravityStrength: number;
  gravityRadius: number;
  repulsionStrength: number;
  repulsionRadius: number;
  vortexStrength: number;
  vortexRadius: number;
  mouseStrength: number;
  mouseRadius: number;
  damping: number;
  bounceDamping: number;
  colorMode: ColorMode;
  baseColor: [number, number, number];
  lodBias: number;
  boidsEnabled: boolean;
  separationStrength: number;
  separationRadius: number;
  alignmentStrength: number;
  alignmentRadius: number;
  cohesionStrength: number;
  cohesionRadius: number;
  viewMode: ViewMode;
  viewAngle: number;
  viewZoom: number;
}

export const DEFAULT_PRESET_PARAMS: PresetParams = {
  particleCount: 200000,
  particleSize: 1.5,
  gravityStrength: 50.0,
  gravityRadius: 400.0,
  repulsionStrength: 0.0,
  repulsionRadius: 100.0,
  vortexStrength: 40.0,
  vortexRadius: 300.0,
  mouseStrength: 800.0,
  mouseRadius: 200.0,
  damping: 0.995,
  bounceDamping: 0.75,
  colorMode: 'velocity',
  baseColor: [0.0, 0.94, 1.0],
  lodBias: 0,
  boidsEnabled: false,
  separationStrength: 1.5,
  separationRadius: 15.0,
  alignmentStrength: 1.0,
  alignmentRadius: 30.0,
  cohesionStrength: 0.8,
  cohesionRadius: 50.0,
  viewMode: 'top',
  viewAngle: 0,
  viewZoom: 1.0,
};

export interface PerformanceMetrics {
  fps: number;
  particleCount: number;
  renderedCount: number;
  frameTime: number;
  computeTime: number;
  renderTime: number;
}

export interface CSVExportOptions {
  includePosition: boolean;
  includeVelocity: boolean;
  includeColor: boolean;
  includeLodLevel: boolean;
  samplingRate: number;
}

export type RecordingState = 'idle' | 'recording' | 'playing' | 'paused';
