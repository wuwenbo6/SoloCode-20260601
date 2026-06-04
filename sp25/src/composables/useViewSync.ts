import { ref, reactive, computed, watch } from 'vue'
import type { ViewState, ViewStateSync } from '@/types'
import { useWebTransport } from '@/composables/useWebTransport'

const localState = reactive<ViewState>({
  selectedSensors: [],
  viewMode: 'monitor',
  showPrediction: true,
  userId: '',
  userName: '',
})

const remoteStates = ref<Map<string, ViewStateSync>>(new Map())
const syncEnabled = ref(false)
const lastSyncTime = ref(0)

export function useViewSync() {
  const { send, onMessage, connectionState } = useWebTransport()

  const activeUsers = computed(() => {
    const users: { id: string; name: string; count: number }[] = []
    remoteStates.value.forEach((sync) => {
      users.push({
        id: sync.sessionId,
        name: sync.state.userName,
        count: sync.state.selectedSensors.length,
      })
    })
    return users
  })

  function broadcastState() {
    if (!syncEnabled.value || connectionState.value !== 'connected') return
    send({
      type: 'view_state_update',
      payload: localState,
    })
    lastSyncTime.value = Date.now()
  }

  function updateLocalState(updates: Partial<ViewState>) {
    Object.assign(localState, updates)
    broadcastState()
  }

  function applyRemoteState(remote: ViewStateSync) {
    if (remote.state.selectedSensors?.length > 0) {
      localState.selectedSensors = [...remote.state.selectedSensors]
    }
    if (typeof remote.state.showPrediction === 'boolean') {
      localState.showPrediction = remote.state.showPrediction
    }
    if (remote.state.viewMode) {
      localState.viewMode = remote.state.viewMode
    }
  }

  function toggleSync(enabled: boolean) {
    syncEnabled.value = enabled
    if (enabled) {
      broadcastState()
    }
  }

  function initUser(id: string, name: string) {
    localState.userId = id
    localState.userName = name
  }

  const hasRemoteState = computed(() => remoteStates.value.size > 0)

  onMessage((msg) => {
    if (msg.type === 'view_state_sync') {
      const sync = msg.payload as ViewStateSync
      remoteStates.value.set(sync.sessionId, sync)
      setTimeout(() => {
        if (remoteStates.value.has(sync.sessionId)) {
          const current = remoteStates.value.get(sync.sessionId)
          if (current && current.ts === sync.ts) {
            remoteStates.value.delete(sync.sessionId)
          }
        }
      }, 30000)
    }
  })

  watch(
    () => localState.selectedSensors,
    () => broadcastState(),
    { deep: true }
  )

  watch(
    () => localState.showPrediction,
    () => broadcastState()
  )

  return {
    localState,
    remoteStates,
    syncEnabled,
    activeUsers,
    hasRemoteState,
    lastSyncTime,
    updateLocalState,
    broadcastState,
    applyRemoteState,
    toggleSync,
    initUser,
  }
}
