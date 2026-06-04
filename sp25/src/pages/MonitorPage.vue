<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useWebTransport } from '@/composables/useWebTransport'
import { useSensorStore } from '@/composables/useSensorStore'
import { useAlert } from '@/composables/useAlert'
import { useViewSync } from '@/composables/useViewSync'
import SensorPanel from '@/components/SensorPanel.vue'
import RealtimeChart from '@/components/RealtimeChart.vue'
import SensorGrid from '@/components/SensorGrid.vue'
import AlertBanner from '@/components/AlertBanner.vue'
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import { Users, Share2, CheckCircle } from 'lucide-vue-next'
import type { ServerMessage, SensorData, AlertPayload, CongestionPayload, ViewStateSync } from '@/types'

const { connectionState, connect, disconnect, send, onMessage } = useWebTransport()
const sensorStore = useSensorStore()
const alertStore = useAlert()
const viewSync = useViewSync()

const sidebarOpen = ref(true)
const dataRate = ref(0)
const lastTimestamp = ref(0)
const showUserPanel = ref(false)
let messageCount = 0
let rateTimer: ReturnType<typeof setInterval> | null = null

const API_BASE = `https://${window.location.hostname}:4433`

async function loadSensorInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/sensors`)
    if (res.ok) {
      const sensors = await res.json()
      for (const s of sensors) {
        sensorStore.registerSensorInfo(s.id, s.name, s.area)
      }
      if (sensorStore.selectedSensorIds.value.length === 0 && sensors.length > 0) {
        sensorStore.selectSensor(sensors[0].id)
        send({
          type: 'subscribe',
          payload: { sensorIds: [sensors[0].id] },
        })
        updateSyncState()
      }
    }
  } catch {
    for (let i = 1; i <= 100; i++) {
      sensorStore.registerSensorInfo(i, `Sensor-${i}`, `Area-${Math.ceil(i / 10)}`)
    }
    sensorStore.selectSensor(1)
    updateSyncState()
  }
}

function updateSyncState() {
  viewSync.updateLocalState({
    selectedSensors: [...sensorStore.selectedSensorIds.value],
  })
}

onMessage((msg: ServerMessage) => {
  messageCount++
  switch (msg.type) {
    case 'sensor_data': {
      const data = msg.payload as SensorData
      sensorStore.updateSensorData(data)
      lastTimestamp.value = data.ts
      break
    }
    case 'alert': {
      const alert = msg.payload as AlertPayload
      sensorStore.addAlert(alert)
      alertStore.addActiveAlert(alert)
      break
    }
    case 'congestion': {
      const congestion = msg.payload as CongestionPayload
      console.log('Congestion: new interval', congestion.intervalMs, 'ms')
      break
    }
    case 'replay_data': {
      const replayData = msg.payload as SensorData
      sensorStore.updateSensorData(replayData)
      break
    }
    case 'view_state_sync': {
      // Just log remote state changes - user decides when to apply
      break
    }
  }
})

const formattedTimestamp = computed(() => {
  if (!lastTimestamp.value) return '--:--:--'
  return new Date(lastTimestamp.value).toLocaleTimeString('zh-CN')
})

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function handleSubscribe(sensorIds: number[]) {
  send({
    type: 'subscribe',
    payload: { sensorIds },
  })
  updateSyncState()
}

function handleUnsubscribe(sensorIds: number[]) {
  send({
    type: 'unsubscribe',
    payload: { sensorIds },
  })
  updateSyncState()
}

function applyRemoteState(remote: ViewStateSync) {
  if (remote.state.selectedSensors?.length > 0) {
    sensorStore.state.selectedSensors.clear()
    for (const id of remote.state.selectedSensors) {
      sensorStore.selectSensor(id)
    }
    send({
      type: 'subscribe',
      payload: { sensorIds: remote.state.selectedSensors },
    })
  }
  alertStore.fetchAlerts()
}

onMounted(async () => {
  connect()
  await loadSensorInfo()
  alertStore.fetchAlerts()
  rateTimer = setInterval(() => {
    dataRate.value = messageCount
    messageCount = 0
  }, 1000)
})

onUnmounted(() => {
  disconnect()
  if (rateTimer) clearInterval(rateTimer)
})
</script>

<template>
  <div class="h-[calc(100vh-3.5rem)] flex flex-col relative overflow-hidden">
    <AlertBanner />

    <div class="flex-1 flex overflow-hidden">
      <div
        class="transition-all duration-300 flex-shrink-0"
        :class="sidebarOpen ? 'w-64' : 'w-10'"
      >
        <div class="h-full flex">
          <button
            class="w-10 h-full bg-cyber-panel/50 border-r border-cyber-cyan/10 flex items-center justify-center hover:bg-cyber-cyan/5 transition-colors"
            @click="toggleSidebar"
          >
            <span class="text-cyber-cyan text-lg">{{ sidebarOpen ? '◀' : '▶' }}</span>
          </button>
          <div v-if="sidebarOpen" class="flex-1 overflow-hidden">
            <SensorPanel
              @subscribe="handleSubscribe"
              @unsubscribe="handleUnsubscribe"
            />
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 p-4 overflow-hidden">
          <RealtimeChart />
        </div>
      </div>

      <div class="w-72 flex-shrink-0 overflow-y-auto border-l border-cyber-cyan/10 bg-cyber-panel/30">
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-orbitron text-xs text-cyber-cyan/70 tracking-wider">传感器矩阵</h3>
            <div class="flex items-center gap-2">
              <button
                class="p-1.5 rounded-lg transition-all"
                :class="[
                  viewSync.syncEnabled.value
                    ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30'
                    : 'bg-cyber-panel text-gray-500 border border-gray-700 hover:border-gray-500'
                ]"
                @click="viewSync.toggleSync(!viewSync.syncEnabled.value)"
                title="视图同步"
              >
                <Share2 class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1.5 rounded-lg transition-all relative"
                :class="[
                  viewSync.hasRemoteState.value
                    ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30'
                    : 'bg-cyber-panel text-gray-500 border border-gray-700'
                ]"
                @click="showUserPanel = !showUserPanel"
                title="在线用户"
              >
                <Users class="w-3.5 h-3.5" />
                <span
                  v-if="viewSync.activeUsers.value.length > 0"
                  class="absolute -top-1 -right-1 w-3 h-3 bg-cyber-green rounded-full text-[8px] flex items-center justify-center text-cyber-bg font-bold"
                >
                  {{ viewSync.activeUsers.value.length }}
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="showUserPanel && viewSync.activeUsers.value.length > 0"
            class="glass-panel rounded-lg p-2 space-y-1"
          >
            <p class="text-xs text-gray-500 mb-1">在线用户</p>
            <div
              v-for="user in viewSync.activeUsers.value"
              :key="user.id"
              class="flex items-center justify-between p-1.5 rounded hover:bg-cyber-cyan/5 cursor-pointer"
              @click="() => { const s = viewSync.remoteStates.value.get(user.id); if (s) applyRemoteState(s) }"
            >
              <span class="text-xs text-gray-300">{{ user.name }}</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">{{ user.count }}个传感器</span>
                <CheckCircle class="w-3 h-3 text-cyber-cyan" />
              </div>
            </div>
          </div>

          <SensorGrid />
        </div>
      </div>
    </div>

    <div class="absolute top-4 right-80 z-10">
      <ConnectionStatus :state="connectionState" />
    </div>

    <div class="h-8 glass-panel border-t border-cyber-cyan/10 flex items-center justify-between px-4 text-xs text-gray-500">
      <span>最后更新: {{ formattedTimestamp }}</span>
      <div class="flex items-center gap-4">
        <span v-if="viewSync.syncEnabled.value" class="text-cyber-cyan flex items-center gap-1">
          <Share2 class="w-3 h-3" />
          视图同步已开启
        </span>
        <span>数据速率: {{ dataRate }} 条/秒</span>
      </div>
    </div>
  </div>
</template>
