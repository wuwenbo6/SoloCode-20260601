import { reactive, computed } from 'vue'
import type { SensorData, TimeSeriesPoint, AlertPayload } from '@/types'

const FIVE_MINUTES = 5 * 60 * 1000

interface SensorState {
  data: Map<number, SensorData>
  timeSeries: Map<number, {
    temperature: TimeSeriesPoint[]
    pressure: TimeSeriesPoint[]
    vibration: TimeSeriesPoint[]
  }>
  alerts: Map<number, AlertPayload[]>
  selectedSensors: Set<number>
  sensorAreas: Map<number, string>
  sensorNames: Map<number, string>
}

const state = reactive<SensorState>({
  data: new Map(),
  timeSeries: new Map(),
  alerts: new Map(),
  selectedSensors: new Set(),
  sensorAreas: new Map(),
  sensorNames: new Map(),
})

export function useSensorStore() {
  function updateSensorData(data: SensorData) {
    state.data.set(data.id, data)

    if (!state.timeSeries.has(data.id)) {
      state.timeSeries.set(data.id, {
        temperature: [],
        pressure: [],
        vibration: [],
      })
    }

    const series = state.timeSeries.get(data.id)!
    const now = data.ts
    const cutoff = now - FIVE_MINUTES

    series.temperature.push({ timestamp: now, value: data.temperature })
    series.pressure.push({ timestamp: now, value: data.pressure })
    series.vibration.push({ timestamp: now, value: data.vibration })

    series.temperature = series.temperature.filter(p => p.timestamp > cutoff)
    series.pressure = series.pressure.filter(p => p.timestamp > cutoff)
    series.vibration = series.vibration.filter(p => p.timestamp > cutoff)
  }

  function addAlert(alert: AlertPayload) {
    if (!state.alerts.has(alert.sensorId)) {
      state.alerts.set(alert.sensorId, [])
    }
    const existing = state.alerts.get(alert.sensorId)!
    if (!existing.find(a => a.metric === alert.metric && a.level === alert.level)) {
      existing.push(alert)
    }
  }

  function clearAlerts(sensorId: number) {
    state.alerts.delete(sensorId)
  }

  function getSensorTimeSeries(sensorId: number) {
    return state.timeSeries.get(sensorId) || { temperature: [], pressure: [], vibration: [] }
  }

  function getSensorStatus(sensorId: number): string {
    if (state.alerts.has(sensorId)) {
      const alerts = state.alerts.get(sensorId)!
      if (alerts.some(a => a.level === 'critical')) return 'critical'
      if (alerts.some(a => a.level === 'warning')) return 'warning'
    }
    return state.data.has(sensorId) ? 'normal' : 'offline'
  }

  function registerSensorInfo(id: number, name: string, area: string) {
    state.sensorNames.set(id, name)
    state.sensorAreas.set(id, area)
  }

  const allSensors = computed(() => {
    const sensors: SensorData[] = []
    state.data.forEach((v) => sensors.push(v))
    return sensors.sort((a, b) => a.id - b.id)
  })

  const activeAlerts = computed(() => {
    const alerts: AlertPayload[] = []
    state.alerts.forEach((v) => alerts.push(...v))
    return alerts
  })

  function selectSensor(sensorId: number) {
    state.selectedSensors.add(sensorId)
  }

  function deselectSensor(sensorId: number) {
    state.selectedSensors.delete(sensorId)
  }

  function toggleSensor(sensorId: number) {
    if (state.selectedSensors.has(sensorId)) {
      state.selectedSensors.delete(sensorId)
    } else {
      state.selectedSensors.add(sensorId)
    }
  }

  function selectAllInArea(area: string) {
    state.sensorAreas.forEach((a, id) => {
      if (a === area) state.selectedSensors.add(id)
    })
  }

  function deselectAllInArea(area: string) {
    state.sensorAreas.forEach((a, id) => {
      if (a === area) state.selectedSensors.delete(id)
    })
  }

  function isSelected(sensorId: number): boolean {
    return state.selectedSensors.has(sensorId)
  }

  const selectedSensorIds = computed(() => Array.from(state.selectedSensors))

  const sensorsByArea = computed(() => {
    const map = new Map<string, number[]>()
    state.sensorAreas.forEach((area, id) => {
      if (!map.has(area)) map.set(area, [])
      map.get(area)!.push(id)
    })
    return map
  })

  return {
    state,
    allSensors,
    activeAlerts,
    selectedSensorIds,
    sensorsByArea,
    updateSensorData,
    addAlert,
    clearAlerts,
    getSensorTimeSeries,
    getSensorStatus,
    registerSensorInfo,
    selectSensor,
    deselectSensor,
    toggleSensor,
    isSelected,
    selectAllInArea,
    deselectAllInArea,
  }
}
