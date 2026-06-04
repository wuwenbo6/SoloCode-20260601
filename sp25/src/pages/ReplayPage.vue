<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWebTransport } from '@/composables/useWebTransport'
import { useSensorStore } from '@/composables/useSensorStore'
import ReplayChart from '@/components/ReplayChart.vue'
import ReplayControls from '@/components/ReplayControls.vue'
import { Search, AlertTriangle } from 'lucide-vue-next'
import type { SensorData } from '@/types'

const route = useRoute()
const { connect, disconnect, send, onMessage, connectionState } = useWebTransport()
const sensorStore = useSensorStore()

const startTime = ref('')
const endTime = ref('')
const speed = ref<1 | 2 | 5 | 10>(1)
const isPlaying = ref(false)
const progress = ref(0)
const selectedSensors = ref<number[]>([])
const searchQuery = ref('')
const highlightAlertId = ref<number | null>(null)
const autoJumpAlert = ref<number | null>(null)

onMounted(() => {
  if (route.query.startTime) {
    startTime.value = String(route.query.startTime)
  }
  if (route.query.endTime) {
    endTime.value = String(route.query.endTime)
  }
  if (route.query.sensorId) {
    const sid = parseInt(String(route.query.sensorId))
    if (!isNaN(sid)) {
      selectedSensors.value = [sid]
    }
  }
  if (route.query.highlight) {
    const aid = parseInt(String(route.query.highlight))
    if (!isNaN(aid)) {
      highlightAlertId.value = aid
      autoJumpAlert.value = aid
    }
  }
})

const replayRange = computed(() => {
  if (!startTime.value || !endTime.value) return null
  return {
    start: new Date(startTime.value).getTime(),
    end: new Date(endTime.value).getTime(),
  }
})

const sensorList = computed(() => {
  const ids: number[] = []
  for (let i = 1; i <= 100; i++) ids.push(i)
  return ids
})

const filteredSensors = computed(() => {
  if (!searchQuery.value) return sensorList.value
  return sensorList.value.filter(id => {
    const name = `Sensor-${id}`
    return name.toLowerCase().includes(searchQuery.value.toLowerCase()) || String(id).includes(searchQuery.value)
  })
})

function toggleSensorSelection(sensorId: number) {
  const idx = selectedSensors.value.indexOf(sensorId)
  if (idx === -1) {
    selectedSensors.value.push(sensorId)
  } else {
    selectedSensors.value.splice(idx, 1)
  }
}

function startReplay() {
  if (!replayRange.value || selectedSensors.value.length === 0) return
  isPlaying.value = true
  connect()
  send({
    type: 'replay_start',
    payload: {
      startTime: new Date(replayRange.value.start).toISOString(),
      endTime: new Date(replayRange.value.end).toISOString(),
      speed: speed.value,
      sensorIds: selectedSensors.value,
    },
  })
}

function stopReplay() {
  isPlaying.value = false
  send({
    type: 'replay_stop',
    payload: { sensorIds: [] },
  })
}

function togglePlayPause() {
  if (isPlaying.value) {
    stopReplay()
  } else {
    startReplay()
  }
}

function setSpeed(s: 1 | 2 | 5 | 10) {
  speed.value = s
  if (isPlaying.value) {
    startReplay()
  }
}

const totalDuration = computed(() => {
  if (!replayRange.value) return 0
  return replayRange.value.end - replayRange.value.start
})

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

onMessage((msg) => {
  if (msg.type === 'replay_data') {
    const data = msg.payload as SensorData
    sensorStore.updateSensorData(data)
    if (replayRange.value) {
      const elapsed = data.ts - replayRange.value.start
      progress.value = Math.min(elapsed / totalDuration.value, 1)
    }
  }
  if (msg.type === 'replay_end') {
    isPlaying.value = false
    progress.value = 1
  }
})
</script>

<template>
  <div class="p-6 max-w-[1400px] mx-auto space-y-6">
    <div class="flex items-center gap-3 mb-2">
      <h1 class="font-orbitron text-xl text-cyber-cyan text-glow-cyan tracking-wide">历史回放</h1>
      <div
        v-if="highlightAlertId"
        class="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/30"
      >
        <AlertTriangle class="w-4 h-4 text-cyber-red" />
        <span class="text-cyber-red text-sm">定位告警 #{{ highlightAlertId }}</span>
        <button
          class="ml-2 text-gray-400 hover:text-white"
          @click="highlightAlertId = null"
        >
          ✕
        </button>
      </div>
    </div>

    <div class="glass-panel rounded-xl p-4 space-y-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400">开始时间</label>
          <input
            v-model="startTime"
            type="datetime-local"
            class="bg-cyber-bg border border-cyber-cyan/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400">结束时间</label>
          <input
            v-model="endTime"
            type="datetime-local"
            class="bg-cyber-bg border border-cyber-cyan/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
          />
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Search class="w-4 h-4 text-gray-500" />
          <input
            v-model="searchQuery"
            placeholder="搜索传感器..."
            class="bg-cyber-bg border border-cyber-cyan/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none w-64"
          />
        </div>
        <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          <button
            v-for="id in filteredSensors"
            :key="id"
            class="px-3 py-1 rounded-lg text-xs border transition-all"
            :class="[
              selectedSensors.includes(id)
                ? 'bg-cyber-cyan/20 border-cyber-cyan/50 text-cyber-cyan'
                : 'bg-cyber-bg border-gray-700 text-gray-400 hover:border-gray-500'
            ]"
            @click="toggleSensorSelection(id)"
          >
            S-{{ id }}
          </button>
        </div>
      </div>
    </div>

    <div class="glass-panel rounded-xl p-4">
      <ReplayChart :sensor-ids="selectedSensors" />
    </div>

    <div class="glass-panel rounded-xl p-4">
      <ReplayControls
        :is-playing="isPlaying"
        :speed="speed"
        :progress="progress"
        :current-time="formatDuration(progress * totalDuration)"
        :total-time="formatDuration(totalDuration)"
        @toggle-play-pause="togglePlayPause"
        @set-speed="setSpeed"
        @stop="stopReplay"
      />
    </div>
  </div>
</template>
