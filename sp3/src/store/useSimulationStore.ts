import { create } from 'zustand'
import type { SimulateRequest, CompressionResult } from '@shared/types'
import { runSimulation } from '../utils/api'

interface SimulationState {
  isLoading: boolean
  error: string | null
  result: CompressionResult | null
  params: SimulateRequest
  isHealthy: boolean
  
  setParams: (params: Partial<SimulateRequest>) => void
  simulate: () => Promise<void>
  clearError: () => void
  setHealthy: (healthy: boolean) => void
  reset: () => void
}

const defaultParams: SimulateRequest = {
  sidCount: 5,
  customSids: [],
  prefix: '',
  compressionMethod: 'prefix',
  compressionDepth: 8,
  preserveBranches: true,
  sidFormat: 'srv6',
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  isLoading: false,
  error: null,
  result: null,
  params: defaultParams,
  isHealthy: true,
  
  setParams: (params) => set((state) => ({
    params: { ...state.params, ...params },
  })),
  
  simulate: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const { params } = get()
      const response = await runSimulation(params)
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Simulation failed')
      }
      
      set({ result: response.data, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
      })
    }
  },
  
  clearError: () => set({ error: null }),
  
  setHealthy: (healthy) => set({ isHealthy: healthy }),
  
  reset: () => set({
    result: null,
    error: null,
    params: defaultParams,
  }),
}))
