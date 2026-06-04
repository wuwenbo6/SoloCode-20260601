<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AlertRecord } from '@/types'
import { RefreshCw, Check, Filter } from 'lucide-vue-next'

const props = defineProps<{
  alerts: AlertRecord[]
  loading: boolean
}>()

const emit = defineEmits<{
  acknowledge: [alertId: number]
  refresh: []
  jumpToReplay: [alert: AlertRecord]
}>()

const filterSensorId = ref('')
const filterLevel = ref<'' | 'warning' | 'critical'>('')
const currentPage = ref(1)
const pageSize = 15

const filteredAlerts = computed(() => {
  let result = [...props.alerts]
  if (filterSensorId.value) {
    const sid = parseInt(filterSensorId.value)
    if (!isNaN(sid)) {
      result = result.filter(a => a.sensorId === sid)
    } else {
      result = result.filter(a => String(a.sensorId).includes(filterSensorId.value))
    }
  }
  if (filterLevel.value) {
    result = result.filter(a => a.level === filterLevel.value)
  }
  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredAlerts.value.length / pageSize)))

const paginatedAlerts = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredAlerts.value.slice(start, start + pageSize)
})

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString('zh-CN')
}

function metricLabel(metric: string): string {
  switch (metric) {
    case 'temperature': return '温度'
    case 'pressure': return '压力'
    case 'vibration': return '振动'
    default: return metric
  }
}

function levelClass(level: string): string {
  return level === 'critical' ? 'border-l-2 border-l-cyber-red' : 'border-l-2 border-l-cyber-orange'
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <div class="flex items-center gap-2">
        <Filter class="w-4 h-4 text-gray-500" />
        <input
          v-model="filterSensorId"
          placeholder="传感器ID"
          class="bg-cyber-bg border border-cyber-cyan/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none w-40"
        />
      </div>
      <select
        v-model="filterLevel"
        class="bg-cyber-bg border border-cyber-cyan/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cyber-cyan/50 focus:outline-none"
      >
        <option value="">所有级别</option>
        <option value="warning">警告</option>
        <option value="critical">严重</option>
      </select>
      <button
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-colors"
        @click="emit('refresh')"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        刷新
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-cyber-cyan/10">
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">ID</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">传感器</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">指标</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">数值</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">阈值</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">级别</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">时间</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">状态</th>
            <th class="text-left px-3 py-2 text-xs font-orbitron text-gray-500 tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="alert in paginatedAlerts"
            :key="alert.id"
            :class="[levelClass(alert.level), 'border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors']"
          >
            <td class="px-3 py-2 text-gray-400 text-xs">{{ alert.id }}</td>
            <td class="px-3 py-2 text-gray-300">Sensor-{{ alert.sensorId }}</td>
            <td class="px-3 py-2 text-gray-400">{{ metricLabel(alert.metric) }}</td>
            <td class="px-3 py-2" :class="alert.level === 'critical' ? 'text-cyber-red' : 'text-cyber-orange'">
              {{ alert.value.toFixed(1) }}
            </td>
            <td class="px-3 py-2 text-gray-400">{{ alert.threshold.toFixed(1) }}</td>
            <td class="px-3 py-2">
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="alert.level === 'critical' ? 'bg-cyber-red/20 text-cyber-red' : 'bg-cyber-orange/20 text-cyber-orange'"
              >
                {{ alert.level === 'critical' ? '严重' : '警告' }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-400 text-xs">{{ formatTime(alert.createdAt) }}</td>
            <td class="px-3 py-2">
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="alert.acknowledged ? 'bg-cyber-green/20 text-cyber-green' : 'bg-gray-700/50 text-gray-400'"
              >
                {{ alert.acknowledged ? '已确认' : '待处理' }}
              </span>
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1">
                <button
                  v-if="!alert.acknowledged"
                  class="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 hover:bg-cyber-cyan/20 transition-colors"
                  @click="emit('acknowledge', alert.id)"
                >
                  <Check class="w-3 h-3" />
                  确认
                </button>
                <button
                  class="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/20 hover:bg-cyber-orange/20 transition-colors"
                  @click="emit('jumpToReplay', alert)"
                >
                  回放
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredAlerts.length === 0">
            <td colspan="9" class="text-center py-8 text-gray-600">暂无告警记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between mt-4">
      <span class="text-xs text-gray-500">共 {{ filteredAlerts.length }} 条记录</span>
      <div class="flex items-center gap-2">
        <button
          :disabled="currentPage <= 1"
          class="px-3 py-1 rounded text-xs bg-cyber-bg border border-gray-700 text-gray-400 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          @click="currentPage--"
        >
          上一页
        </button>
        <span class="text-xs text-gray-500">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage >= totalPages"
          class="px-3 py-1 rounded text-xs bg-cyber-bg border border-gray-700 text-gray-400 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          @click="currentPage++"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
