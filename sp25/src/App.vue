<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Activity, Bell, History } from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { path: '/', label: '实时监控', icon: Activity },
  { path: '/alerts', label: '告警管理', icon: Bell },
  { path: '/replay', label: '历史回放', icon: History },
]
</script>

<template>
  <div class="min-h-screen bg-cyber-bg font-source-sans">
    <nav class="glass-panel border-b border-cyber-cyan/10 sticky top-0 z-50">
      <div class="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center">
            <Activity class="w-4 h-4 text-cyber-cyan" />
          </div>
          <span class="font-orbitron font-bold text-cyber-cyan text-glow-cyan text-sm tracking-wider">
            工业设备监控系统
          </span>
        </div>
        <div class="flex items-center gap-1">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            :class="[
              route.path === item.path
                ? 'bg-cyber-cyan/10 text-cyber-cyan glow-cyan border border-cyber-cyan/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
            ]"
          >
            <component :is="item.icon" class="w-4 h-4" />
            {{ item.label }}
          </router-link>
        </div>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>
