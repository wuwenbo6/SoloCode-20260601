import { create } from 'zustand';
import type { Process, SystemMetrics, CLOSGroup, SimulatorStatus, SystemConfig } from '../types';

interface AppState {
  processes: Process[];
  systemMetrics: SystemMetrics | null;
  closGroups: CLOSGroup[];
  simulatorStatus: SimulatorStatus | null;
  systemConfig: SystemConfig | null;
  wsConnected: boolean;
  selectedProcessId: number | null;

  setProcesses: (processes: Process[]) => void;
  setSystemMetrics: (metrics: SystemMetrics) => void;
  setCLOSGroups: (groups: CLOSGroup[]) => void;
  setSimulatorStatus: (status: SimulatorStatus) => void;
  setSystemConfig: (config: SystemConfig) => void;
  setWsConnected: (connected: boolean) => void;
  setSelectedProcessId: (id: number | null) => void;

  updateProcessMetrics: (pid: number, updates: Partial<Process>) => void;
}

export const useStore = create<AppState>((set) => ({
  processes: [],
  systemMetrics: null,
  closGroups: [],
  simulatorStatus: null,
  systemConfig: null,
  wsConnected: false,
  selectedProcessId: null,

  setProcesses: (processes) => set({ processes }),
  setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
  setCLOSGroups: (closGroups) => set({ closGroups }),
  setSimulatorStatus: (simulatorStatus) => set({ simulatorStatus }),
  setSystemConfig: (systemConfig) => set({ systemConfig }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setSelectedProcessId: (selectedProcessId) => set({ selectedProcessId }),

  updateProcessMetrics: (pid, updates) =>
    set((state) => ({
      processes: state.processes.map((p) =>
        p.pid === pid ? { ...p, ...updates } : p
      ),
    })),
}));
