<template>
  <el-card class="chart-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" color="#67C23A"><TrendCharts /></el-icon>
        <span>温度历史记录</span>
        <el-button type="primary" size="small" @click="refreshData" style="margin-left: auto">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </template>
    <div class="chart-container">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
      <el-empty v-else description="暂无数据" />
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useIotStore } from '../stores/iotStore'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const store = useIotStore()
const loading = ref(false)

const chartData = computed(() => {
  if (!store.temperatureHistory || store.temperatureHistory.length === 0) {
    return null
  }
  
  const labels = store.temperatureHistory.map(item => {
    const date = new Date(item.timestamp || item.time || item.created_at)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  })
  
  const data = store.temperatureHistory.map(item => item.temperature || item.value)
  
  return {
    labels,
    datasets: [
      {
        label: '温度 (°C)',
        data,
        borderColor: '#409EFF',
        backgroundColor: 'rgba(64, 158, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      },
      ticks: {
        callback: (value) => value + '°C'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}

const refreshData = async () => {
  loading.value = true
  await store.fetchTemperatureHistory()
  loading.value = false
}

watch(() => store.temperature, () => {
  if (store.temperatureHistory.length > 0) {
    const lastItem = store.temperatureHistory[store.temperatureHistory.length - 1]
    if (!lastItem || lastItem.temperature !== store.temperature) {
      store.temperatureHistory.push({
        timestamp: new Date().toISOString(),
        temperature: store.temperature
      })
      if (store.temperatureHistory.length > 50) {
        store.temperatureHistory.shift()
      }
    }
  }
})
</script>

<style scoped>
.chart-card {
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

.chart-container {
  height: 280px;
}
</style>
