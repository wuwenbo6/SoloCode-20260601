<template>
  <div class="app-container">
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h1><el-icon :size="30"><Monitor /></el-icon> IoT 智能家居控制面板</h1>
          <div class="ws-status">
            <el-tag :type="store.wsConnected ? 'success' : 'danger'" effect="dark">
              <el-icon><Connection /></el-icon>
              {{ store.wsConnected ? 'WebSocket 已连接' : 'WebSocket 未连接' }}
            </el-tag>
          </div>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <el-row :gutter="20">
          <el-col :span="12">
            <TemperatureDisplay />
          </el-col>
          <el-col :span="12">
            <TemperatureChart />
          </el-col>
        </el-row>
        
        <el-row :gutter="20" class="scene-row">
          <el-col :span="16">
            <SceneQuickPanel />
          </el-col>
          <el-col :span="8">
            <VoiceControl />
          </el-col>
        </el-row>
        
        <el-row :gutter="20" class="control-row">
          <el-col :span="12">
            <ACControl />
          </el-col>
          <el-col :span="12">
            <LightControl />
          </el-col>
        </el-row>
        
        <el-row class="rules-row">
          <el-col :span="24">
            <RulesManagement />
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useIotStore } from './stores/iotStore'
import TemperatureDisplay from './components/TemperatureDisplay.vue'
import TemperatureChart from './components/TemperatureChart.vue'
import ACControl from './components/ACControl.vue'
import LightControl from './components/LightControl.vue'
import RulesManagement from './components/RulesManagement.vue'
import SceneQuickPanel from './components/SceneQuickPanel.vue'
import VoiceControl from './components/VoiceControl.vue'

const store = useIotStore()

onMounted(() => {
  store.connectWebSocket()
  store.fetchTemperatureHistory()
  store.fetchDeviceStatus()
  store.fetchRules()
  store.fetchScenes()
  store.fetchGroups()
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-content h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 10px;
}

.main-content {
  padding: 20px;
}

.scene-row {
  margin-top: 20px;
}

.control-row {
  margin-top: 20px;
}

.rules-row {
  margin-top: 20px;
}

.ws-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
