<script setup lang="ts">
import { computed } from 'vue'
import { useSensorStore } from '@/composables/useSensorStore'

const sensorStore = useSensorStore()

const gridSensors = computed(() => {
  const result: { id: number; status: string; selected: boolean }[] = []
  for (let i = 1; i <= 100; i++) {
    result.push({
      id: i,
      status: sensorStore.getSensorStatus(i),
      selected: sensorStore.state.selectedSensors.has(i),
    })
  }
  return result
})

function statusClasses(status: string) {
  switch (status) {
    case 'normal': return 'bg-cyber-green/20 border-cyber-green/40 hover:border-cyber-green'
    case 'warning': return 'bg-cyber-orange/20 border-cyber-orange/40 animate-pulse-alert hover:border-cyber-orange'
    case 'critical': return 'bg-cyber-red/20 border-cyber-red/40 animate-pulse-alert hover:border-cyber-red'
    default: return 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
  }
}

function dotColor(status: string) {
  switch (status) {
    case 'normal': return 'bg-cyber-green'
    case 'warning': return 'bg-cyber-orange'
    case 'critical': return 'bg-cyber-red'
    default: return 'bg-gray-600'
  }
}

function handleClick(id: number) {
  sensorStore.toggleSensor(id)
}
</script>

<template>
  <div class="grid grid-cols-10 gap-1">
    <div
      v-for="sensor in gridSensors"
      :key="sensor.id"
      class="aspect-square rounded border p-1 cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5"
      :class="[
        statusClasses(sensor.status),
        sensor.selected ? 'ring-1 ring-cyber-cyan/50' : '',
      ]"
      @click="handleClick(sensor.id)"
    >
      <span :class="['w-1.5 h-1.5 rounded-full', dotColor(sensor.status)]" />
      <span class="text-[8px] text-gray-400 leading-none truncate w-full text-center">
        S{{ sensor.id }}
      </span>
    </div>
  </div>
</template>
