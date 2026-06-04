<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useSensorStore } from '@/composables/useSensorStore'

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  sensorIds: number[]
}>()

const sensorStore = useSensorStore()

const option = computed(() => {
  const tempSeries: number[][] = []
  const pressureSeries: number[][] = []
  const vibrationSeries: number[][] = []

  for (const id of props.sensorIds) {
    const series = sensorStore.getSensorTimeSeries(id)
    series.temperature.forEach(p => tempSeries.push([p.timestamp, p.value]))
    series.pressure.forEach(p => pressureSeries.push([p.timestamp, p.value]))
    series.vibration.forEach(p => vibrationSeries.push([p.timestamp, p.value]))
  }

  return {
    backgroundColor: 'transparent',
    grid: { top: 60, right: 80, bottom: 40, left: 80 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.9)',
      borderColor: 'rgba(255, 145, 0, 0.3)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: ['温度', '压力', '振动'],
      top: 10,
      textStyle: { color: '#9ca3af', fontSize: 12 },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#1a1f2e' } },
      axisLabel: { color: '#6b7280', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1a1f2e' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 (°C)',
        nameTextStyle: { color: '#00f0ff', fontSize: 11 },
        axisLine: { lineStyle: { color: '#00f0ff33' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1a1f2e55' } },
      },
      {
        type: 'value',
        name: '压力/振动',
        nameTextStyle: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        data: tempSeries,
        yAxisIndex: 0,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#00f0ff', width: 2 },
        itemStyle: { color: '#00f0ff' },
      },
      {
        name: '压力',
        type: 'line',
        data: pressureSeries,
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#00e676', width: 2 },
        itemStyle: { color: '#00e676' },
      },
      {
        name: '振动',
        type: 'line',
        data: vibrationSeries,
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#ff9100', width: 2 },
        itemStyle: { color: '#ff9100' },
      },
    ],
  }
})

const chartRef = shallowRef<InstanceType<typeof VChart>>()
</script>

<template>
  <div class="relative">
    <div class="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-1 bg-cyber-orange/10 border-b border-cyber-orange/20">
      <span class="w-2 h-2 rounded-full bg-cyber-orange animate-pulse" />
      <span class="font-orbitron text-xs text-cyber-orange tracking-wider">回放模式</span>
    </div>
    <div class="pt-8">
      <VChart ref="chartRef" :option="option" autoresize style="height: 350px" />
    </div>
  </div>
</template>
