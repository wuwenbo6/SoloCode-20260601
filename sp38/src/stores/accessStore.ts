import { create } from 'zustand'

interface AccessEvent {
  type: string
  timestamp: string
  username: string
  keyName: string
  doorName: string
  method: string
  gps: { latitude: number; longitude: number } | null
  success: boolean
  operatorType: string
}

interface AccessState {
  events: AccessEvent[]
  soundEnabled: boolean
  addEvent: (event: AccessEvent) => void
  toggleSound: () => void
}

export const useAccessStore = create<AccessState>((set) => ({
  events: [],
  soundEnabled: true,
  addEvent: (event) => set((state) => ({ events: [event, ...state.events].slice(0, 100) })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))
