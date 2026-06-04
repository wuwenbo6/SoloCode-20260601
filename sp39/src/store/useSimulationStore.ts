import { create } from 'zustand';

export type DisplayMode = 'velocity' | 'density' | 'combined';
export type ObstacleShape = 'circle' | 'rectangle';
export type GridSize = 256 | 512;

interface SimulationState {
  gridSize: GridSize;
  displayMode: DisplayMode;
  obstacleShape: ObstacleShape;
  obstacleSize: number;
  tau: number;
  injectionRadius: number;
  injectionDensity: number;
  injectionStrength: number;
  isRunning: boolean;
  fps: number;
  iterationTime: number;
  gpuMemory: number;
  
  setGridSize: (size: GridSize) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setObstacleShape: (shape: ObstacleShape) => void;
  setObstacleSize: (size: number) => void;
  setTau: (tau: number) => void;
  setInjectionRadius: (radius: number) => void;
  setInjectionDensity: (density: number) => void;
  setInjectionStrength: (strength: number) => void;
  toggleRunning: () => void;
  setPerformance: (fps: number, iterationTime: number, gpuMemory: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  gridSize: 256,
  displayMode: 'combined',
  obstacleShape: 'circle',
  obstacleSize: 20,
  tau: 0.6,
  injectionRadius: 15,
  injectionDensity: 0.5,
  injectionStrength: 0.1,
  isRunning: true,
  fps: 0,
  iterationTime: 0,
  gpuMemory: 0,
  
  setGridSize: (size) => set({ gridSize: size }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setObstacleShape: (shape) => set({ obstacleShape: shape }),
  setObstacleSize: (size) => set({ obstacleSize: size }),
  setTau: (tau) => set({ tau }),
  setInjectionRadius: (radius) => set({ injectionRadius: radius }),
  setInjectionDensity: (density) => set({ injectionDensity: density }),
  setInjectionStrength: (strength) => set({ injectionStrength: strength }),
  toggleRunning: () => set((state) => ({ isRunning: !state.isRunning })),
  setPerformance: (fps, iterationTime, gpuMemory) => set({ fps, iterationTime, gpuMemory }),
}));
