<template>
  <el-card class="control-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" :color="store.lightStatus.is_on ? '#E6A23C' : '#909399'"><LightBulb /></el-icon>
        <span>灯光控制</span>
        <el-switch
          v-model="lightOn"
          @change="toggleLight"
          active-color="#67C23A"
          inactive-color="#C0C4CC"
          style="margin-left: auto"
        />
      </div>
    </template>
    <div class="control-content">
      <div class="light-icon-large" :class="{ active: store.lightStatus.is_on }" :style="lightStyle">
        <el-icon :size="60"><LightBulb /></el-icon>
      </div>
      <div class="brightness-display">
        <span class="label">亮度</span>
        <span class="value">{{ store.lightStatus.brightness }}%</span>
      </div>
      <div class="slider-container">
        <el-slider
          v-model="brightness"
          :min="0"
          :max="100"
          :step="5"
          :disabled="!store.lightStatus.is_on"
          @change="setBrightness"
          show-tooltip
          tooltip-format="值"
        />
        <div class="slider-labels">
          <span><el-icon><MoonNight /></el-icon> 暗</span>
          <span><el-icon><Sunny /></el-icon> 亮</span>
        </div>
      </div>
      <div class="quick-buttons">
        <el-button size="small" :disabled="!store.lightStatus.is_on" @click="quickSet(25)">25%</el-button>
        <el-button size="small" :disabled="!store.lightStatus.is_on" @click="quickSet(50)">50%</el-button>
        <el-button size="small" :disabled="!store.lightStatus.is_on" @click="quickSet(75)">75%</el-button>
        <el-button size="small" :disabled="!store.lightStatus.is_on" @click="quickSet(100)">100%</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()

const lightOn = computed({
  get: () => store.lightStatus.is_on,
  set: (val) => val
})

const brightness = computed({
  get: () => store.lightStatus.brightness,
  set: (val) => val
})

const lightStyle = computed(() => {
  if (!store.lightStatus.is_on) {
    return { opacity: 0.3 }
  }
  return {
    opacity: 0.3 + (store.lightStatus.brightness / 100) * 0.7,
    filter: `drop-shadow(0 0 ${store.lightStatus.brightness / 3}px #E6A23C)`
  }
})

const toggleLight = async (value) => {
  try {
    await store.controlLight({ is_on: value, brightness: store.lightStatus.brightness })
    ElMessage.success(`灯光已${value ? '开启' : '关闭'}`)
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const setBrightness = async (value) => {
  try {
    await store.controlLight({ is_on: store.lightStatus.is_on, brightness: value })
    ElMessage.success(`亮度已设置为 ${value}%`)
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const quickSet = async (value) => {
  try {
    await store.controlLight({ is_on: store.lightStatus.is_on, brightness: value })
    ElMessage.success(`亮度已设置为 ${value}%`)
  } catch (e) {
    ElMessage.error('操作失败')
  }
}
</script>

<style scoped>
.control-card {
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.control-content {
  text-align: center;
  padding: 10px 0;
}

.light-icon-large {
  color: #E6A23C;
  margin-bottom: 15px;
  transition: all 0.3s ease;
}

.light-icon-large.active {
  animation: glow 2s infinite;
}

@keyframes glow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.brightness-display {
  margin-bottom: 20px;
}

.brightness-display .label {
  display: block;
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.brightness-display .value {
  font-size: 36px;
  font-weight: 700;
  color: #E6A23C;
}

.slider-container {
  padding: 0 20px;
  margin-bottom: 15px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  align-items: center;
}

.quick-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
