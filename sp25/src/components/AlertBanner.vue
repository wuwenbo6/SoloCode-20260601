<script setup lang="ts">
import { computed } from 'vue'
import { useAlert } from '@/composables/useAlert'
import { X } from 'lucide-vue-next'

const alertStore = useAlert()

const visibleAlerts = computed(() => alertStore.activeAlerts.value.slice(0, 5))

function metricLabel(metric: string) {
  switch (metric) {
    case 'temperature': return '温度'
    case 'pressure': return '压力'
    case 'vibration': return '振动'
    default: return metric
  }
}

function metricUnit(metric: string) {
  switch (metric) {
    case 'temperature': return '°C'
    case 'pressure': return 'MPa'
    case 'vibration': return 'mm/s'
    default: return ''
  }
}

function alertKey(alert: { sensorId: number; metric: string }) {
  return `${alert.sensorId}-${alert.metric}`
}

function dismiss(sensorId: number, metric: string) {
  alertStore.dismissActiveAlert(sensorId, metric)
}
</script>

<template>
  <div v-if="visibleAlerts.length > 0" class="w-full animate-pulse-alert">
    <div class="bg-cyber-red/15 border-b border-cyber-red/30 backdrop-blur-sm">
      <div class="flex items-center gap-4 px-4 py-2 overflow-x-auto">
        <span class="text-cyber-red font-bold text-sm flex-shrink-0">⚠ 告警</span>
        <div class="flex items-center gap-4 flex-shrink-0">
          <div
            v-for="alert in visibleAlerts"
            :key="alertKey(alert)"
            class="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/20 flex-shrink-0"
          >
            <span class="text-cyber-red text-xs font-medium">
              Sensor-{{ alert.sensorId }} {{ metricLabel(alert.metric) }}超限 {{ alert.value.toFixed(1) }}{{ metricUnit(alert.metric) }}
            </span>
            <span class="text-gray-400 text-xs">(阈值: {{ alert.threshold.toFixed(1) }}{{ metricUnit(alert.metric) }})</span>
            <button class="text-gray-500 hover:text-gray-300 ml-1" @click="dismiss(alert.sensorId, alert.metric)">
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
