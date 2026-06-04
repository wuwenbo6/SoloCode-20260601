<script setup lang="ts">
import type { ConnectionState } from '@/types'
import { Loader2 } from 'lucide-vue-next'

defineProps<{
  state: ConnectionState
}>()

const stateConfig: Record<ConnectionState, { dot: string; label: string; extra?: string }> = {
  connected: { dot: 'bg-cyber-green', label: '已连接' },
  connecting: { dot: 'bg-yellow-400', label: '连接中...' },
  reconnecting: { dot: 'bg-yellow-400', label: '重连中...', extra: 'animate-spin' },
  disconnected: { dot: 'bg-cyber-red', label: '已断开' },
}
</script>

<template>
  <div class="glass-panel rounded-lg px-3 py-1.5 flex items-center gap-2">
    <div class="relative">
      <span :class="['w-2 h-2 rounded-full block', stateConfig[state].dot]" />
      <span
        v-if="state === 'connected'"
        class="absolute inset-0 w-2 h-2 rounded-full bg-cyber-green animate-ping opacity-75"
      />
    </div>
    <Loader2 v-if="state === 'reconnecting'" class="w-3 h-3 text-yellow-400 animate-spin" />
    <span class="text-xs text-gray-400 font-source-sans">{{ stateConfig[state].label }}</span>
  </div>
</template>
