import { ref, computed } from 'vue'
import type { AlertRecord, ThresholdConfig, AlertPayload } from '@/types'

const API_BASE = `https://${window.location.hostname}:4433`

export function useAlert() {
  const alertHistory = ref<AlertRecord[]>([])
  const activeAlerts = ref<AlertPayload[]>([])
  const thresholds = ref<ThresholdConfig[]>([
    { metric: 'temperature', minValue: -20, maxValue: 120, warningPercent: 80 },
    { metric: 'pressure', minValue: 0, maxValue: 10, warningPercent: 85 },
    { metric: 'vibration', minValue: 0, maxValue: 50, warningPercent: 80 },
  ])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalAlerts = ref(0)
  const currentPage = ref(1)

  async function fetchAlerts(params?: {
    sensor_id?: number
    level?: string
    start?: string
    end?: string
    page?: number
    limit?: number
  }) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams()
      if (params?.sensor_id) query.set('sensor_id', String(params.sensor_id))
      if (params?.level) query.set('level', params.level)
      if (params?.start) query.set('start', params.start)
      if (params?.end) query.set('end', params.end)
      if (params?.page) query.set('page', String(params.page))
      if (params?.limit) query.set('limit', String(params.limit))
      const res = await fetch(`${API_BASE}/api/alerts?${query.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      alertHistory.value = data.alerts || []
      totalAlerts.value = data.total || 0
      currentPage.value = data.page || 1
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function acknowledgeAlert(alertId: number) {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/acknowledge?id=${alertId}`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const idx = alertHistory.value.findIndex(a => a.id === alertId)
      if (idx !== -1) alertHistory.value[idx].acknowledged = true
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function fetchThresholds() {
    try {
      const res = await fetch(`${API_BASE}/api/thresholds`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      thresholds.value = await res.json()
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function updateThreshold(metric: string, min: number, max: number, warningPercent: number) {
    try {
      const res = await fetch(`${API_BASE}/api/thresholds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric, min, max, warningPercent }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const idx = thresholds.value.findIndex(t => t.metric === metric)
      if (idx !== -1) {
        thresholds.value[idx] = { metric: metric as ThresholdConfig['metric'], minValue: min, maxValue: max, warningPercent }
      }
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function addActiveAlert(alert: AlertPayload) {
    const exists = activeAlerts.value.find(
      a => a.sensorId === alert.sensorId && a.metric === alert.metric
    )
    if (!exists) {
      activeAlerts.value.push(alert)
    } else {
      const idx = activeAlerts.value.indexOf(exists)
      activeAlerts.value[idx] = alert
    }
  }

  function dismissActiveAlert(sensorId: number, metric?: string) {
    if (metric) {
      activeAlerts.value = activeAlerts.value.filter(a => !(a.sensorId === sensorId && a.metric === metric))
    } else {
      activeAlerts.value = activeAlerts.value.filter(a => a.sensorId !== sensorId)
    }
  }

  const criticalCount = computed(() => alertHistory.value.filter(a => a.level === 'critical').length)
  const warningCount = computed(() => alertHistory.value.filter(a => a.level === 'warning').length)

  return {
    alertHistory,
    activeAlerts,
    thresholds,
    loading,
    error,
    totalAlerts,
    currentPage,
    criticalCount,
    warningCount,
    fetchAlerts,
    acknowledgeAlert,
    fetchThresholds,
    updateThreshold,
    addActiveAlert,
    dismissActiveAlert,
  }
}
