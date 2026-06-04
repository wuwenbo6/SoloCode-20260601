import { defineStore } from 'pinia'
import axios from 'axios'

const API_BASE = '/api'

export const useIotStore = defineStore('iot', {
  state: () => ({
    temperature: null,
    temperatureHistory: [],
    acStatus: {
      is_on: false,
      target_temperature: 24
    },
    lightStatus: {
      is_on: false,
      brightness: 50
    },
    rules: [],
    scenes: [],
    groups: [],
    wsConnected: false,
    ws: null,
    _reconnectTimer: null
  }),
  actions: {
    _applyFullState(data) {
      if (data.temperature !== undefined) {
        this.temperature = data.temperature
      }
      if (data.devices) {
        data.devices.forEach(dev => {
          if (dev.device_type === 'ac') {
            this.acStatus = {
              is_on: dev.is_on,
              target_temperature: dev.target_temperature || 24
            }
          } else if (dev.device_type === 'light') {
            this.lightStatus = {
              is_on: dev.is_on,
              brightness: dev.brightness || 50
            }
          }
        })
      }
    },
    connectWebSocket() {
      if (this.ws) {
        this.ws.onopen = null
        this.ws.onmessage = null
        this.ws.onclose = null
        this.ws.onerror = null
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close()
        }
        this.ws = null
      }

      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer)
        this._reconnectTimer = null
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.wsConnected = true
        console.log('WebSocket connected, syncing state...')
        this.syncFullState()
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'state' || msg.type === 'full_state_sync') {
            this._applyFullState(msg.data)
          } else if (msg.type === 'temperature_update') {
            this.temperature = msg.data.temperature
            if (this.temperatureHistory.length > 0) {
              this.temperatureHistory.push({
                temperature: msg.data.temperature,
                timestamp: new Date().toISOString()
              })
              if (this.temperatureHistory.length > 100) {
                this.temperatureHistory.shift()
              }
            }
          } else if (msg.type === 'device_update') {
            const data = msg.data
            if (data.device_type === 'ac') {
              this.acStatus = {
                is_on: data.is_on,
                target_temperature: data.target_temperature !== undefined ? data.target_temperature : this.acStatus.target_temperature
              }
            } else if (data.device_type === 'light') {
              this.lightStatus = {
                is_on: data.is_on,
                brightness: data.brightness !== undefined ? data.brightness : this.lightStatus.brightness
              }
            }
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e)
        }
      }

      this.ws.onclose = () => {
        this.wsConnected = false
        console.log('WebSocket disconnected, will retry in 3s...')
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = null
          this.connectWebSocket()
        }, 3000)
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    },
    async syncFullState() {
      try {
        const response = await axios.get(`${API_BASE}/devices/sync`)
        this._applyFullState(response.data)
        console.log('Full state synced from server')
      } catch (error) {
        console.error('Failed to sync full state:', error)
      }
    },
    async fetchTemperatureHistory(hours = 24) {
      try {
        const response = await axios.get(`${API_BASE}/devices/temperature/history?hours=${hours}`)
        this.temperatureHistory = response.data
      } catch (error) {
        console.error('Failed to fetch temperature history:', error)
      }
    },
    async fetchDeviceStatus() {
      try {
        const response = await axios.get(`${API_BASE}/devices/status`)
        const devices = response.data
        devices.forEach(dev => {
          if (dev.device_type === 'ac') {
            this.acStatus = {
              is_on: dev.is_on,
              target_temperature: dev.target_temperature || 24
            }
          } else if (dev.device_type === 'light') {
            this.lightStatus = {
              is_on: dev.is_on,
              brightness: dev.brightness || 50
            }
          }
        })
      } catch (error) {
        console.error('Failed to fetch device status:', error)
      }
    },
    async controlAC(payload) {
      try {
        const response = await axios.post(`${API_BASE}/devices/ac/control`, payload)
        return response.data
      } catch (error) {
        console.error('Failed to control AC:', error)
        throw error
      }
    },
    async controlLight(payload) {
      try {
        const response = await axios.post(`${API_BASE}/devices/light/control`, payload)
        return response.data
      } catch (error) {
        console.error('Failed to control light:', error)
        throw error
      }
    },
    async fetchRules() {
      try {
        const response = await axios.get(`${API_BASE}/rules`)
        this.rules = response.data
      } catch (error) {
        console.error('Failed to fetch rules:', error)
      }
    },
    async createRule(rule) {
      try {
        const response = await axios.post(`${API_BASE}/rules`, rule)
        this.rules.push(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create rule:', error)
        throw error
      }
    },
    async updateRule(id, rule) {
      try {
        const response = await axios.put(`${API_BASE}/rules/${id}`, rule)
        const index = this.rules.findIndex(r => r.id === id)
        if (index !== -1) {
          this.rules[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Failed to update rule:', error)
        throw error
      }
    },
    async deleteRule(id) {
      try {
        await axios.delete(`${API_BASE}/rules/${id}`)
        this.rules = this.rules.filter(r => r.id !== id)
      } catch (error) {
        console.error('Failed to delete rule:', error)
        throw error
      }
    },
    async evaluateRules() {
      try {
        const response = await axios.post(`${API_BASE}/rules/evaluate`)
        return response.data
      } catch (error) {
        console.error('Failed to evaluate rules:', error)
        throw error
      }
    },
    async fetchScenes() {
      try {
        const response = await axios.get(`${API_BASE}/scenes`)
        this.scenes = response.data
      } catch (error) {
        console.error('Failed to fetch scenes:', error)
      }
    },
    async createScene(scene) {
      try {
        const response = await axios.post(`${API_BASE}/scenes`, scene)
        this.scenes.push(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create scene:', error)
        throw error
      }
    },
    async updateScene(id, scene) {
      try {
        const response = await axios.put(`${API_BASE}/scenes/${id}`, scene)
        const index = this.scenes.findIndex(s => s.id === id)
        if (index !== -1) {
          this.scenes[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Failed to update scene:', error)
        throw error
      }
    },
    async deleteScene(id) {
      try {
        await axios.delete(`${API_BASE}/scenes/${id}`)
        this.scenes = this.scenes.filter(s => s.id !== id)
      } catch (error) {
        console.error('Failed to delete scene:', error)
        throw error
      }
    },
    async executeScene(id) {
      try {
        const response = await axios.post(`${API_BASE}/scenes/${id}/execute`)
        await this.fetchScenes()
        return response.data
      } catch (error) {
        console.error('Failed to execute scene:', error)
        throw error
      }
    },
    async executeSceneByName(name) {
      try {
        const response = await axios.post(`${API_BASE}/scenes/execute-by-name?name=${encodeURIComponent(name)}`)
        await this.fetchScenes()
        return response.data
      } catch (error) {
        console.error('Failed to execute scene by name:', error)
        throw error
      }
    },
    async fetchGroups() {
      try {
        const response = await axios.get(`${API_BASE}/groups`)
        this.groups = response.data
      } catch (error) {
        console.error('Failed to fetch groups:', error)
      }
    },
    async createGroup(group) {
      try {
        const response = await axios.post(`${API_BASE}/groups`, group)
        this.groups.push(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create group:', error)
        throw error
      }
    },
    async updateGroup(id, group) {
      try {
        const response = await axios.put(`${API_BASE}/groups/${id}`, group)
        const index = this.groups.findIndex(g => g.id === id)
        if (index !== -1) {
          this.groups[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Failed to update group:', error)
        throw error
      }
    },
    async deleteGroup(id) {
      try {
        await axios.delete(`${API_BASE}/groups/${id}`)
        this.groups = this.groups.filter(g => g.id !== id)
      } catch (error) {
        console.error('Failed to delete group:', error)
        throw error
      }
    },
    async controlGroup(groupId, payload) {
      try {
        const response = await axios.post(`${API_BASE}/groups/${groupId}/control`, {
          group_id: groupId,
          ...payload
        })
        return response.data
      } catch (error) {
        console.error('Failed to control group:', error)
        throw error
      }
    },
    async controlAllDevices(payload) {
      try {
        const response = await axios.post(`${API_BASE}/groups/all/control`, {
          group_id: 0,
          ...payload
        })
        return response.data
      } catch (error) {
        console.error('Failed to control all devices:', error)
        throw error
      }
    },
    async parseVoiceCommand(text) {
      try {
        const response = await axios.post(`${API_BASE}/voice/parse`, { text })
        return response.data
      } catch (error) {
        console.error('Failed to parse voice command:', error)
        throw error
      }
    },
    async executeVoiceCommand(text) {
      try {
        const response = await axios.post(`${API_BASE}/voice/execute`, { text })
        if (response.data.success) {
          setTimeout(() => this.syncFullState(), 500)
        }
        return response.data
      } catch (error) {
        console.error('Failed to execute voice command:', error)
        throw error
      }
    }
  }
})
