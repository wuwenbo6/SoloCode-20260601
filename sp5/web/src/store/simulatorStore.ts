import { create } from 'zustand';
import {
  type NamespaceStatus,
  type SimulatorConfig,
  type IOResult,
  type WSMessageWithNS,
  fetchNamespaces,
  fetchAllStatus,
  fetchLogs,
  updateConfig,
  startSimulator,
  stopSimulator,
  submitIO,
  createNamespace,
  deleteNamespace,
  connectWebSocket,
} from '@/utils/api';

interface SimulatorState {
  namespaces: string[];
  statuses: Record<string, NamespaceStatus>;
  logsByNS: Record<string, IOResult[]>;
  connected: boolean;
  lastIOResult: IOResult | null;
  selectedNS: string;
  ws: WebSocket | null;

  setSelectedNS: (ns: string) => void;
  init: () => void;
  loadNamespaces: () => Promise<void>;
  loadAllStatus: () => Promise<void>;
  loadLogs: (ns?: string) => Promise<void>;
  setConfig: (ns: string, config: SimulatorConfig) => Promise<void>;
  start: (ns: string) => Promise<void>;
  stop: (ns: string) => Promise<void>;
  submitIO: (ns: string) => Promise<void>;
  createNS: (name: string) => Promise<void>;
  deleteNS: (name: string) => Promise<void>;
  handleMessage: (msg: WSMessageWithNS) => void;
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  namespaces: [],
  statuses: {},
  logsByNS: {},
  connected: false,
  lastIOResult: null,
  selectedNS: 'ns0',
  ws: null,

  setSelectedNS: (ns: string) => {
    set({ selectedNS: ns });
    get().loadLogs(ns);
  },

  init: () => {
    get().loadNamespaces();
    get().loadAllStatus();
    get().loadLogs();

    const ws = connectWebSocket((msg) => {
      get().handleMessage(msg);
    });

    ws.onopen = () => set({ connected: true });
    ws.onclose = () => set({ connected: false });

    set({ ws });
  },

  loadNamespaces: async () => {
    try {
      const namespaces = await fetchNamespaces();
      set({ namespaces });
    } catch (e) {
      console.error('Failed to load namespaces:', e);
    }
  },

  loadAllStatus: async () => {
    try {
      const statuses = await fetchAllStatus();
      set({ statuses });
    } catch (e) {
      console.error('Failed to load status:', e);
    }
  },

  loadLogs: async (ns?: string) => {
    try {
      const targetNS = ns || get().selectedNS;
      const logs = await fetchLogs(targetNS);
      set((state) => ({
        logsByNS: { ...state.logsByNS, [targetNS]: logs },
      }));
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  },

  setConfig: async (ns: string, config: SimulatorConfig) => {
    try {
      const status = await updateConfig(ns, config);
      set((state) => ({
        statuses: { ...state.statuses, [ns]: status },
      }));
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  },

  start: async (ns: string) => {
    try {
      await startSimulator(ns);
      await get().loadAllStatus();
    } catch (e) {
      console.error('Failed to start:', e);
    }
  },

  stop: async (ns: string) => {
    try {
      await stopSimulator(ns);
      await get().loadAllStatus();
    } catch (e) {
      console.error('Failed to stop:', e);
    }
  },

  submitIO: async (ns: string) => {
    try {
      const result = await submitIO(ns);
      set({ lastIOResult: result });
      set((state) => {
        const current = state.logsByNS[ns] || [];
        return {
          logsByNS: { ...state.logsByNS, [ns]: [...current, result].slice(-200) },
        };
      });
    } catch (e) {
      console.error('Failed to submit IO:', e);
    }
  },

  createNS: async (name: string) => {
    try {
      await createNamespace(name);
      await get().loadNamespaces();
      await get().loadAllStatus();
    } catch (e) {
      console.error('Failed to create namespace:', e);
    }
  },

  deleteNS: async (name: string) => {
    try {
      await deleteNamespace(name);
      await get().loadNamespaces();
      set((state) => {
        const { [name]: _, ...restStatuses } = state.statuses;
        const { [name]: __, ...restLogs } = state.logsByNS;
        return {
          selectedNS: state.selectedNS === name ? 'ns0' : state.selectedNS,
          statuses: restStatuses,
          logsByNS: restLogs,
        };
      });
    } catch (e) {
      console.error('Failed to delete namespace:', e);
    }
  },

  handleMessage: (msg: WSMessageWithNS) => {
    if (msg.type === 'status') {
      const status = msg.payload as NamespaceStatus;
      set((state) => ({
        statuses: { ...state.statuses, [msg.namespace]: status },
      }));
    } else if (msg.type === 'io_result') {
      const result = msg.payload as IOResult;
      set((state) => {
        const current = state.logsByNS[msg.namespace] || [];
        return {
          lastIOResult: result,
          logsByNS: {
            ...state.logsByNS,
            [msg.namespace]: [...current, result].slice(-200),
          },
        };
      });
    }
  },
}));
