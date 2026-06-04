<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSensorStore } from '@/composables/useSensorStore'
import { Search, ChevronDown, ChevronRight } from 'lucide-vue-next'

const emit = defineEmits<{
  subscribe: [sensorIds: number[]]
  unsubscribe: [sensorIds: number[]]
}>()

const sensorStore = useSensorStore()
const searchQuery = ref('')
const expandedAreas = ref<Set<string>>(new Set(['Area-1']))

function toggleArea(area: string) {
  if (expandedAreas.value.has(area)) {
    expandedAreas.value.delete(area)
  } else {
    expandedAreas.value.add(area)
  }
}

function isAreaAllSelected(area: string): boolean {
  const ids = sensorStore.sensorsByArea.value.get(area)
  if (!ids || ids.length === 0) return false
  return ids.every(id => sensorStore.state.selectedSensors.has(id))
}

function toggleAreaSelection(area: string) {
  const ids = sensorStore.sensorsByArea.value.get(area) || []
  if (isAreaAllSelected(area)) {
    sensorStore.deselectAllInArea(area)
    emit('unsubscribe', ids)
  } else {
    sensorStore.selectAllInArea(area)
    emit('subscribe', ids)
  }
}

function toggleSensor(sensorId: number) {
  const wasSelected = sensorStore.state.selectedSensors.has(sensorId)
  sensorStore.toggleSensor(sensorId)
  if (wasSelected) {
    emit('unsubscribe', [sensorId])
  } else {
    emit('subscribe', [sensorId])
  }
}

const allAreas = computed(() => {
  return Array.from(sensorStore.sensorsByArea.value.entries())
})

const filteredAreas = computed(() => {
  const areas = allAreas.value
  if (!searchQuery.value) return areas
  return areas
    .map(([area, ids]) => {
      const filtered = ids.filter(id => {
        const name = `Sensor-${id}`
        return name.toLowerCase().includes(searchQuery.value.toLowerCase()) || String(id).includes(searchQuery.value)
      })
      return [area, filtered] as [string, number[]]
    })
    .filter(([, ids]) => ids.length > 0)
})

function statusColor(status: string) {
  switch (status) {
    case 'normal': return 'bg-cyber-green'
    case 'warning': return 'bg-cyber-orange'
    case 'critical': return 'bg-cyber-red'
    default: return 'bg-gray-600'
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-cyber-panel/50">
    <div class="p-3 border-b border-cyber-cyan/10">
      <div class="relative">
        <Search class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          placeholder="搜索传感器..."
          class="w-full bg-cyber-bg border border-cyber-cyan/20 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none placeholder-gray-600"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div v-for="[area, ids] in filteredAreas" :key="area" class="rounded-lg overflow-hidden">
        <div
          class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cyber-cyan/5 transition-colors"
          @click="toggleArea(area)"
        >
          <component :is="expandedAreas.has(area) ? ChevronDown : ChevronRight" class="w-3 h-3 text-gray-500" />
          <input
            type="checkbox"
            :checked="isAreaAllSelected(area)"
            class="rounded border-gray-600 bg-cyber-bg text-cyber-cyan focus:ring-cyber-cyan/30"
            @click.stop="toggleAreaSelection(area)"
          />
          <span class="text-xs font-orbitron text-cyber-cyan/70 tracking-wider flex-1">{{ area }}</span>
          <span class="text-xs text-gray-600">{{ ids.length }}</span>
        </div>

        <div v-if="expandedAreas.has(area)" class="pl-6 space-y-0.5">
          <div
            v-for="id in ids"
            :key="id"
            class="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all"
            :class="[
              sensorStore.state.selectedSensors.has(id)
                ? 'bg-cyber-cyan/10 border border-cyber-cyan/20'
                : 'hover:bg-white/5 border border-transparent'
            ]"
            @click="toggleSensor(id)"
          >
            <span :class="['w-2 h-2 rounded-full flex-shrink-0', statusColor(sensorStore.getSensorStatus(id))]" />
            <span class="text-xs text-gray-300 flex-1 truncate">Sensor-{{ id }}</span>
            <span v-if="sensorStore.state.data.has(id)" class="text-xs text-gray-600">
              {{ sensorStore.state.data.get(id)!.temperature.toFixed(0) }}°
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
