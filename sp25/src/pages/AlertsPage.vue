<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAlert } from '@/composables/useAlert'
import ThresholdConfig from '@/components/ThresholdConfig.vue'
import AlertTable from '@/components/AlertTable.vue'
import type { AlertRecord } from '@/types'

const router = useRouter()
const alertStore = useAlert()

onMounted(() => {
  alertStore.fetchAlerts()
  alertStore.fetchThresholds()
})

function handleUpdateThreshold(metric: string, min: number, max: number, warningPercent: number) {
  alertStore.updateThreshold(metric, min, max, warningPercent)
}

function handleJumpToReplay(alert: AlertRecord) {
  const alertTime = new Date(alert.createdAt).getTime()
  const startTime = new Date(alertTime - 5 * 60 * 1000).toISOString().slice(0, 16)
  const endTime = new Date(alertTime + 5 * 60 * 1000).toISOString().slice(0, 16)
  
  router.push({
    path: '/replay',
    query: {
      sensorId: alert.sensorId,
      startTime,
      endTime,
      highlight: alert.id,
    },
  })
}
</script>

<template>
  <div class="p-6 max-w-[1400px] mx-auto space-y-6">
    <div class="flex items-center gap-3 mb-2">
      <h1 class="font-orbitron text-xl text-cyber-cyan text-glow-cyan tracking-wide">告警管理</h1>
    </div>

    <ThresholdConfig
      :thresholds="alertStore.thresholds.value"
      @update="handleUpdateThreshold"
    />

    <div class="glass-panel rounded-xl p-4">
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/30">
          <span class="w-2 h-2 rounded-full bg-cyber-red animate-pulse-alert" />
          <span class="text-cyber-red text-sm font-medium">{{ alertStore.criticalCount.value }} 严重</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyber-orange/10 border border-cyber-orange/30">
          <span class="w-2 h-2 rounded-full bg-cyber-orange animate-pulse-alert" />
          <span class="text-cyber-orange text-sm font-medium">{{ alertStore.warningCount.value }} 警告</span>
        </div>
      </div>

      <AlertTable
        :alerts="alertStore.alertHistory.value"
        :loading="alertStore.loading.value"
        @acknowledge="alertStore.acknowledgeAlert"
        @refresh="() => alertStore.fetchAlerts()"
        @jump-to-replay="handleJumpToReplay"
      />
    </div>
  </div>
</template>
