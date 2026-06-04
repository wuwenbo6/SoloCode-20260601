import { create } from 'zustand';
import type { ModelInfo, MaterialPreset, RenderStats, OBJData } from '../../shared/types.js';

interface AppState {
  models: ModelInfo[];
  materials: MaterialPreset[];
  selectedModelId: string;
  currentScene: OBJData | null;
  renderStats: RenderStats;
  maxBounces: number;
  enableAO: boolean;
  aoSamples: number;
  aoRadius: number;
  enableSoftShadows: boolean;
  shadowSamples: number;
  lightRadius: number;
  isLoading: boolean;
  error: string | null;
  panelCollapsed: boolean;
  
  setModels: (models: ModelInfo[]) => void;
  setMaterials: (materials: MaterialPreset[]) => void;
  setSelectedModelId: (id: string) => void;
  setCurrentScene: (scene: OBJData | null) => void;
  setRenderStats: (stats: RenderStats) => void;
  setMaxBounces: (bounces: number) => void;
  setEnableAO: (enabled: boolean) => void;
  setAOSamples: (samples: number) => void;
  setAORadius: (radius: number) => void;
  setEnableSoftShadows: (enabled: boolean) => void;
  setShadowSamples: (samples: number) => void;
  setLightRadius: (radius: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  resetRenderStats: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  models: [],
  materials: [],
  selectedModelId: 'cornell-box',
  currentScene: null,
  renderStats: {
    currentSample: 0,
    fps: 0,
    triangleCount: 0,
    rayCount: 0,
    renderTime: 0,
  },
  maxBounces: 8,
  enableAO: false,
  aoSamples: 4,
  aoRadius: 0.5,
  enableSoftShadows: false,
  shadowSamples: 4,
  lightRadius: 0.5,
  isLoading: false,
  error: null,
  panelCollapsed: false,

  setModels: (models) => set({ models }),
  setMaterials: (materials) => set({ materials }),
  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setCurrentScene: (scene) => set({ currentScene: scene }),
  setRenderStats: (stats) => set({ renderStats: stats }),
  setMaxBounces: (bounces) => set({ maxBounces: bounces }),
  setEnableAO: (enableAO) => set({ enableAO }),
  setAOSamples: (aoSamples) => set({ aoSamples }),
  setAORadius: (aoRadius) => set({ aoRadius }),
  setEnableSoftShadows: (enableSoftShadows) => set({ enableSoftShadows }),
  setShadowSamples: (shadowSamples) => set({ shadowSamples }),
  setLightRadius: (lightRadius) => set({ lightRadius }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
  resetRenderStats: () =>
    set({
      renderStats: {
        currentSample: 0,
        fps: 0,
        triangleCount: 0,
        rayCount: 0,
        renderTime: 0,
      },
    }),
}));
