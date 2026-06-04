<script setup lang="ts">
import { Play, Pause, Square, FastForward } from 'lucide-vue-next'

defineProps<{
  isPlaying: boolean
  speed: number
  progress: number
  currentTime: string
  totalTime: string
}>()

const emit = defineEmits<{
  togglePlayPause: []
  setSpeed: [speed: number]
  stop: []
}>()

const speeds = [1, 2, 5, 10]
</script>

<template>
  <div class="flex items-center gap-4">
    <button
      class="w-10 h-10 rounded-full flex items-center justify-center transition-all"
      :class="isPlaying ? 'bg-cyber-orange/20 border border-cyber-orange/40 text-cyber-orange hover:bg-cyber-orange/30' : 'bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/30'"
      @click="emit('togglePlayPause')"
    >
      <Pause v-if="isPlaying" class="w-5 h-5" />
      <Play v-else class="w-5 h-5" />
    </button>

    <button
      class="w-8 h-8 rounded-lg flex items-center justify-center bg-cyber-red/10 border border-cyber-red/30 text-cyber-red hover:bg-cyber-red/20 transition-colors"
      @click="emit('stop')"
    >
      <Square class="w-4 h-4" />
    </button>

    <div class="flex items-center gap-1">
      <FastForward class="w-3 h-3 text-gray-500" />
      <div class="flex gap-1">
        <button
          v-for="s in speeds"
          :key="s"
          class="px-2 py-1 rounded text-xs border transition-all"
          :class="[
            speed === s
              ? 'bg-cyber-cyan/20 border-cyber-cyan/40 text-cyber-cyan'
              : 'bg-cyber-bg border-gray-700 text-gray-400 hover:border-gray-500'
          ]"
          @click="emit('setSpeed', s)"
        >
          {{ s }}x
        </button>
      </div>
    </div>

    <div class="flex-1 flex items-center gap-3">
      <span class="text-xs text-gray-400 font-mono w-20 text-right">{{ currentTime }}</span>
      <div class="flex-1 h-1.5 bg-cyber-bg rounded-full overflow-hidden">
        <div
          class="h-full bg-cyber-cyan/50 rounded-full transition-all duration-300"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>
      <span class="text-xs text-gray-500 font-mono w-20">{{ totalTime }}</span>
    </div>
  </div>
</template>
