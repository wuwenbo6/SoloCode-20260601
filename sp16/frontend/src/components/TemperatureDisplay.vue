<template>
  <el-card class="temperature-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" color="#409EFF"><Thermometer /></el-icon>
        <span>当前温度</span>
      </div>
    </template>
    <div class="temperature-content">
      <div class="temperature-value">
        <span class="value">{{ displayTemp }}</span>
        <span class="unit">°C</span>
      </div>
      <div class="temperature-status">
        <el-tag :type="tempStatusType" effect="light" size="large">
          {{ tempStatusText }}
        </el-tag>
      </div>
      <div class="temperature-time">
        <el-icon><Clock /></el-icon>
        <span>实时更新中</span>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()

const displayTemp = computed(() => {
  return store.temperature !== null ? store.temperature.toFixed(1) : '--'
})

const tempStatusType = computed(() => {
  if (store.temperature === null) return 'info'
  if (store.temperature < 18) return 'primary'
  if (store.temperature < 25) return 'success'
  if (store.temperature < 30) return 'warning'
  return 'danger'
})

const tempStatusText = computed(() => {
  if (store.temperature === null) return '等待数据...'
  if (store.temperature < 18) return '寒冷'
  if (store.temperature < 25) return '舒适'
  if (store.temperature < 30) return '温暖'
  return '炎热'
})
</script>

<style scoped>
.temperature-card {
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

.temperature-content {
  text-align: center;
  padding: 20px 0;
}

.temperature-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 20px;
}

.value {
  font-size: 72px;
  font-weight: 700;
  color: #409EFF;
  line-height: 1;
}

.unit {
  font-size: 24px;
  color: #666;
  margin-left: 5px;
}

.temperature-status {
  margin-bottom: 15px;
}

.temperature-time {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #909399;
  font-size: 14px;
}
</style>
