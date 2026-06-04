<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useSensorStore } from '@/composables/useSensorStore'
import { predictSensorMetric } from '@/utils/prediction'

use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const sensorStore = useSensorStore()
const showPrediction = ref(true)
const predictAhead = ref(10)

const option = computed(() => {
  const selectedIds = sensorStore.selectedSensorIds.value
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000
  const predictEnd = now + predictAhead.value * 100

  const tempSeries: number[][] = []
  const pressureSeries: number[][] = []
  const vibrationSeries: number[][] = []
  const tempPredSeries: number[][] = []
  const pressurePredSeries: number[][] = []
  const vibrationPredSeries: number[][] = []

  for (const id of selectedIds.slice(0, 5)) {
    const series = sensorStore.getSensorTimeSeries(id)
    
    series.temperature.forEach(p => {
      if (p.timestamp > fiveMinAgo) tempSeries.push([p.timestamp, p.value])
    })
    series.pressure.forEach(p => {
      if (p.timestamp > fiveMinAgo) pressureSeries.push([p.timestamp, p.value])
    })
    series.vibration.forEach(p => {
      if (p.timestamp > fiveMinAgo) vibrationSeries.push([p.timestamp, p.value])
    })

    if (showPrediction.value) {
      const tempPred = predictSensorMetric(series.temperature, predictAhead.value)
      const pressPred = predictSensorMetric(series.pressure, predictAhead.value)
      const vibPred = predictSensorMetric(series.vibration, predictAhead.value)

      tempPred.forEach(p => tempPredSeries.push([p.timestamp, p.value]))
      pressPred.forEach(p => pressurePredSeries.push([p.timestamp, p.value]))
      vibPred.forEach(p => vibrationPredSeries.push([p.timestamp, p.value]))
    }
  }

  const series: any[] = [
    {
      name: '温度',
      type: 'line',
      data: tempSeries,
      yAxisIndex: 0,
      symbol: 'none',
      lineStyle: { color: '#00f0ff', width: 2 },
      itemStyle: { color: '#00f0ff' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,240,255,0.15)' }, { offset: 1, color: 'rgba(0,240,255,0)' }] } },
    },
    {
      name: '压力',
      type: 'line',
      data: pressureSeries,
      yAxisIndex: 1,
      symbol: 'none',
      lineStyle: { color: '#00e676', width: 2 },
      itemStyle: { color: '#00e676' },
    },
    {
      name: '振动',
      type: 'line',
      data: vibrationSeries,
      yAxisIndex: 1,
      symbol: 'none',
      lineStyle: { color: '#ff9100', width: 2 },
      itemStyle: { color: '#ff9100' },
    },
  ]

  if (showPrediction.value && tempPredSeries.length > 0) {
    series.push({
      name: '温度预测',
      type: 'line',
      data: tempPredSeries,
      yAxisIndex: 0,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#00f0ff', width: 1, type: 'dashed', opacity: 0.7 },
      itemStyle: { color: '#00f0ff', opacity: 0.7 },
    })
  }
  if (showPrediction.value && pressurePredSeries.length > 0) {
    series.push({
      name: '压力预测',
      type: 'line',
      data: pressurePredSeries,
      yAxisIndex: 1,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#00e676', width: 1, type: 'dashed', opacity: 0.7 },
      itemStyle: { color: '#00e676', opacity: 0.7 },
    })
  }
  if (showPrediction.value && vibrationPredSeries.length > 0) {
    series.push({
      name: '振动预测',
      type: 'line',
      data: vibrationPredSeries,
      yAxisIndex: 1,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#ff9100', width: 1, type: 'dashed', opacity: 0.7 },
      itemStyle: { color: '#ff9100', opacity: 0.7 },
    })
  }

  const legendData = ['温度', '压力', '振动']
  if (showPrediction.value) {
    legendData.push('温度预测', '压力预测', '振动预测')
  }

  return {
    backgroundColor: 'transparent',
    grid: { top: 60, right: 80, bottom: 60, left: 80 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.9)',
      borderColor: 'rgba(0, 240, 255, 0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: legendData,
      top: 10,
      textStyle: { color: '#9ca3af', fontSize: 12 },
    },
    xAxis: {
      type: 'time',
      min: fiveMinAgo,
      max: predictEnd,
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
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter',
      },
    ],
    series,
  }
})

const chartRef = shallowRef<InstanceType<typeof VChart>>()

watch(() => sensorStore.selectedSensorIds.value, () => {
  chartRef.value?.setOption(option.value, { notMerge: false })
}, { deep: true })
</script>

<template>
  <div class="h-full w-full glass-panel rounded-xl overflow-hidden flex flex-col">
    <div class="px-4 py-2 border-b border-cyber-cyan/10 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
        <span class="font-orbitron text-xs text-cyber-cyan/70 tracking-wider">实时数据</span>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-cyber-cyan transition-colors">
          <input
            type="checkbox"
            v-model="showPrediction"
            class="rounded border-gray-600 bg-cyber-bg text-cyber-cyan focus:ring-cyber-cyan/30"
          />
          预测
        </label>
        <select
          v-model="predictAhead"
          class="bg-cyber-bg border border-cyber-cyan/20 rounded px-2 py-0.5 text-xs text-gray-400 focus:border-cyber-cyan/50 focus:outline-none"
        >
          <option :value="5">5点</option>
          <option :value="10">10点</option>
          <option :value="20">20点</option>
          <option :value="30">30点</option>
        </select>
      </div>
    </div>
    <VChart ref="chartRef" :option="option" autoresize class="w-full flex-1" />
  </div>
</template>
