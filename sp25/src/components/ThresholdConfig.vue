<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ThresholdConfig } from '@/types'
import { Thermometer, Gauge, Activity, Save } from 'lucide-vue-next'

const props = defineProps<{
  thresholds: ThresholdConfig[]
}>()

const emit = defineEmits<{
  update: [metric: string, min: number, max: number, warningPercent: number]
}>()

const editingThresholds = ref<ThresholdConfig[]>(
  props.thresholds.map(t => ({ ...t }))
)

watch(() => props.thresholds, (val) => {
  editingThresholds.value = val.map(t => ({ ...t }))
}, { deep: true })

const metricIcons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  pressure: Gauge,
  vibration: Activity,
}

const metricLabels: Record<string, string> = {
  temperature: '温度',
  pressure: '压力',
  vibration: '振动',
}

const metricUnits: Record<string, string> = {
  temperature: '°C',
  pressure: 'MPa',
  vibration: 'mm/s',
}

const metricColors: Record<string, string> = {
  temperature: 'cyber-cyan',
  pressure: 'cyber-green',
  vibration: 'cyber-orange',
}

function handleSave(metric: string) {
  const config = editingThresholds.value.find(t => t.metric === metric)
  if (config) {
    emit('update', config.metric, config.minValue, config.maxValue, config.warningPercent)
  }
}

function warningValue(metric: string): number {
  const config = editingThresholds.value.find(t => t.metric === metric)
  if (!config) return 0
  const range = config.maxValue - config.minValue
  return config.minValue + range * (config.warningPercent / 100)
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div
      v-for="threshold in editingThresholds"
      :key="threshold.metric"
      class="glass-panel rounded-xl p-4 glass-panel-hover transition-all"
    >
      <div class="flex items-center gap-2 mb-4">
        <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', `bg-${metricColors[threshold.metric]}/10`]">
          <component :is="metricIcons[threshold.metric]" :class="['w-4 h-4', `text-${metricColors[threshold.metric]}`]" />
        </div>
        <span class="font-orbitron text-sm text-gray-200">{{ metricLabels[threshold.metric] }}</span>
        <span class="text-xs text-gray-500">({{ metricUnits[threshold.metric] }})</span>
      </div>

      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500 w-16">最小值</label>
          <input
            v-model.number="threshold.minValue"
            type="number"
            class="flex-1 bg-cyber-bg border border-cyber-cyan/20 rounded px-2 py-1 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500 w-16">最大值</label>
          <input
            v-model.number="threshold.maxValue"
            type="number"
            class="flex-1 bg-cyber-bg border border-cyber-cyan/20 rounded px-2 py-1 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500 w-16">警告%</label>
          <input
            v-model.number="threshold.warningPercent"
            type="number"
            min="0"
            max="100"
            class="flex-1 bg-cyber-bg border border-cyber-cyan/20 rounded px-2 py-1 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
          />
        </div>
      </div>

      <div class="mt-4 h-2 rounded-full bg-cyber-bg overflow-hidden relative">
        <div
          class="h-full rounded-full transition-all"
          :class="`bg-${metricColors[threshold.metric]}/50`"
          :style="{ width: `${threshold.warningPercent}%` }"
        />
        <div
          class="absolute top-0 h-full w-0.5 bg-cyber-orange"
          :style="{ left: `${threshold.warningPercent}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-gray-600 mt-1">
        <span>{{ threshold.minValue }}</span>
        <span class="text-cyber-orange">{{ warningValue(threshold.metric).toFixed(1) }} 警告</span>
        <span>{{ threshold.maxValue }}</span>
      </div>

      <button
        class="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-colors"
        @click="handleSave(threshold.metric)"
      >
        <Save class="w-3.5 h-3.5" />
        保存
      </button>
    </div>
  </div>
</template>
