import { create } from 'zustand';
import type { Stats, Observer, Template, FlowRecord } from '@/lib/api';

interface FlowRatePoint {
  time: number;
  rate: number;
}

export interface TemplateWarning {
  id: string;
  sourceId: number;
  templateId: number;
  reason: string;
  timestamp: number;
}

interface NetFlowState {
  stats: Stats;
  observers: Observer[];
  selectedObserver: number | null;
  templates: Template[];
  selectedTemplate: number | null;
  flows: FlowRecord[];
  flowTotal: number;
  flowPage: number;
  flowPageSize: number;
  flowRates: FlowRatePoint[];
  wsConnected: boolean;
  warnings: TemplateWarning[];
  setStats: (stats: Stats) => void;
  setObservers: (observers: Observer[]) => void;
  setSelectedObserver: (id: number | null) => void;
  setTemplates: (templates: Template[]) => void;
  setSelectedTemplate: (id: number | null) => void;
  setFlows: (flows: FlowRecord[], total: number, page: number, pageSize: number) => void;
  addFlowRate: (rate: number) => void;
  setWsConnected: (connected: boolean) => void;
  addWarning: (warning: TemplateWarning) => void;
  dismissWarning: (id: string) => void;
}

export const useStore = create<NetFlowState>((set) => ({
  stats: { packets: 0, templates: 0, observers: 0, flows: 0 },
  observers: [],
  selectedObserver: null,
  templates: [],
  selectedTemplate: null,
  flows: [],
  flowTotal: 0,
  flowPage: 1,
  flowPageSize: 20,
  flowRates: [],
  wsConnected: false,
  warnings: [],
  setStats: (stats) => set({ stats }),
  setObservers: (observers) => set({ observers }),
  setSelectedObserver: (id) => set({ selectedObserver: id, selectedTemplate: null, templates: [], flows: [] }),
  setTemplates: (templates) => set({ templates }),
  setSelectedTemplate: (id) => set({ selectedTemplate: id }),
  setFlows: (flows, total, page, pageSize) => set({ flows, flowTotal: total, flowPage: page, flowPageSize: pageSize }),
  addFlowRate: (rate) =>
    set((state) => {
      const now = Date.now();
      const rates = [...state.flowRates, { time: now, rate }].filter(
        (p) => now - p.time < 60000
      );
      return { flowRates: rates };
    }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  addWarning: (warning) =>
    set((state) => ({
      warnings: [warning, ...state.warnings].slice(0, 50),
    })),
  dismissWarning: (id) =>
    set((state) => ({
      warnings: state.warnings.filter((w) => w.id !== id),
    })),
}));
