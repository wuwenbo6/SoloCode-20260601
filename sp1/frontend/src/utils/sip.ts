import { create } from 'zustand'

export type SIPState = 'Idle' | 'Calling' | 'Proceeding' | 'Completed' | 'Terminated'
export type SIPEvent = 'send_invite' | 'recv_1xx' | 'recv_2xx' | 'recv_3xx_6xx' | 'recv_401' | 'recv_407' | 'timer_b' | 'timer_d' | 'ack_sent' | 'cancel_sent' | 'invite_auth' | 'invite_prx_auth'
export type MessageDirection = 'send' | 'recv' | 'internal'

export interface StateChangeEntry {
  from: SIPState
  to: SIPState
  event: SIPEvent
  timestamp: number
}

export interface LogEntry {
  direction: MessageDirection
  messageType: string
  content: string
  timestamp: number
  id: string
}

interface SimulatorState {
  currentState: SIPState
  validEvents: SIPEvent[]
  stateHistory: StateChangeEntry[]
  logs: LogEntry[]
  error: string | null
  selectedLogId: string | null
  connected: boolean

  setCurrentState: (state: SIPState) => void
  setValidEvents: (events: SIPEvent[]) => void
  addStateChange: (entry: StateChangeEntry) => void
  addLog: (entry: LogEntry) => void
  setError: (error: string | null) => void
  setSelectedLogId: (id: string | null) => void
  setConnected: (connected: boolean) => void
  reset: () => void
}

const VALID_EVENTS_MAP: Record<SIPState, SIPEvent[]> = {
  Idle: ['send_invite'],
  Calling: ['recv_1xx', 'recv_2xx', 'recv_3xx_6xx', 'recv_401', 'recv_407', 'timer_b'],
  Proceeding: ['recv_1xx', 'recv_2xx', 'recv_3xx_6xx', 'recv_401', 'recv_407'],
  Completed: ['timer_d', 'ack_sent'],
  Terminated: [],
}

export function getValidEvents(state: SIPState): SIPEvent[] {
  return VALID_EVENTS_MAP[state] || []
}

export const EVENT_LABELS: Record<SIPEvent, string> = {
  send_invite: 'Send INVITE',
  recv_1xx: 'Recv 1xx (Ringing)',
  recv_2xx: 'Recv 2xx (OK)',
  recv_3xx_6xx: 'Recv 3xx-6xx',
  recv_401: 'Recv 401',
  recv_407: 'Recv 407',
  timer_b: 'Timer B',
  timer_d: 'Timer D',
  ack_sent: 'Send ACK',
  cancel_sent: 'Send CANCEL',
  invite_auth: 'INVITE (+Auth)',
  invite_prx_auth: 'INVITE (+Proxy-Auth)',
}

export const STATE_COLORS: Record<SIPState, string> = {
  Idle: '#64748b',
  Calling: '#3b82f6',
  Proceeding: '#f59e0b',
  Completed: '#8b5cf6',
  Terminated: '#ef4444',
}

export const EVENT_COLORS: Record<SIPEvent, string> = {
  send_invite: '#3b82f6',
  recv_1xx: '#22c55e',
  recv_2xx: '#22c55e',
  recv_3xx_6xx: '#ef4444',
  recv_401: '#f97316',
  recv_407: '#fb923c',
  timer_b: '#f59e0b',
  timer_d: '#f59e0b',
  ack_sent: '#3b82f6',
  cancel_sent: '#ef4444',
  invite_auth: '#06b6d4',
  invite_prx_auth: '#0891b2',
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  currentState: 'Idle',
  validEvents: getValidEvents('Idle'),
  stateHistory: [],
  logs: [],
  error: null,
  selectedLogId: null,
  connected: false,

  setCurrentState: (state) =>
    set({ currentState: state, validEvents: getValidEvents(state) }),

  setValidEvents: (events) => set({ validEvents: events }),

  addStateChange: (entry) =>
    set((s) => ({ stateHistory: [...s.stateHistory, entry] })),

  addLog: (entry) =>
    set((s) => ({ logs: [...s.logs, entry] })),

  setError: (error) => set({ error }),

  setSelectedLogId: (id) => set({ selectedLogId: id }),

  setConnected: (connected) => set({ connected }),

  reset: () =>
    set({
      currentState: 'Idle',
      validEvents: getValidEvents('Idle'),
      stateHistory: [],
      logs: [],
      error: null,
      selectedLogId: null,
    }),
}))
