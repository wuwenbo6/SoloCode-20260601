<template>
  <el-card class="control-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" :color="store.acStatus.is_on ? '#E6A23C' : '#909399'"><ColdDrink /></el-icon>
        <span>空调控制</span>
        <el-switch
          v-model="acOn"
          @change="toggleAC"
          active-color="#67C23A"
          inactive-color="#C0C4CC"
          style="margin-left: auto"
        />
      </div>
    </template>
    <div class="control-content">
      <div class="ac-icon-large" :class="{ active: store.acStatus.is_on }">
        <el-icon :size="60"><Snowflake /></el-icon>
      </div>
      <div class="temp-display">
        <span class="label">目标温度</span>
        <span class="value">{{ store.acStatus.target_temperature }}°C</span>
      </div>
      <div class="slider-container">
        <el-slider
          v-model="targetTemp"
          :min="16"
          :max="30"
          :step="1"
          :disabled="!store.acStatus.is_on"
          @change="setTargetTemp"
          :marks="tempMarks"
          show-tooltip
          tooltip-format="值"
        />
        <div class="slider-labels">
          <span>16°C</span>
          <span>30°C</span>
        </div>
      </div>
      <div class="quick-buttons">
        <el-button size="small" :disabled="!store.acStatus.is_on" @click="quickSet(22)">22°C</el-button>
        <el-button size="small" :disabled="!store.acStatus.is_on" @click="quickSet(24)">24°C</el-button>
        <el-button size="small" :disabled="!store.acStatus.is_on" @click="quickSet(26)">26°C</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()

const acOn = computed({
  get: () => store.acStatus.is_on,
  set: (val) => val
})

const targetTemp = computed({
  get: () => store.acStatus.target_temperature,
  set: (val) => val
})

const tempMarks = {
  16: '16',
  20: '20',
  24: '24',
  28: '28',
  30: '30'
}

const toggleAC = async (value) => {
  try {
    await store.controlAC({ is_on: value, target_temperature: store.acStatus.target_temperature })
    ElMessage.success(`空调已${value ? '开启' : '关闭'}`)
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const setTargetTemp = async (value) => {
  try {
    await store.controlAC({ is_on: store.acStatus.is_on, target_temperature: value })
    ElMessage.success(`目标温度已设置为 ${value}°C`)
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const quickSet = async (value) => {
  try {
    await store.controlAC({ is_on: store.acStatus.is_on, target_temperature: value })
    ElMessage.success(`目标温度已设置为 ${value}°C`)
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

.ac-icon-large {
  color: #909399;
  margin-bottom: 15px;
  transition: all 0.3s ease;
}

.ac-icon-large.active {
  color: #409EFF;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.temp-display {
  margin-bottom: 20px;
}

.temp-display .label {
  display: block;
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.temp-display .value {
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
}

.quick-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
