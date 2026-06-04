<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <h1>🧮 分布式计算集群管理面板</h1>
        <div class="connection-status">
          <span :class="['status-dot', connected ? 'online' : 'offline']"></span>
          <span>{{ connected ? '已连接' : '未连接' }}</span>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">{{ onlineNodes }}/{{ totalNodes }}</div>
          <div class="stat-label">在线节点</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ runningTasks }}</div>
          <div class="stat-label">运行中任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ completedTasks }}</div>
          <div class="stat-label">已完成任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ avgCpu.toFixed(1) }}%</div>
          <div class="stat-label">平均 CPU</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="panel">
          <h2>节点监控</h2>
          <NodeMonitor :nodes="nodes" />
        </div>

        <div class="panel">
          <h2>任务提交</h2>
          <TaskSubmit :connected="connected" @submit="handleSubmitTask" />
        </div>
      </div>

      <div class="panel tasks-panel">
        <h2>任务列表</h2>
        <TaskList 
          :tasks="tasks" 
          :taskDetails="taskDetails"
          @select="selectTask"
        />
      </div>

      <div v-if="selectedTask" class="panel task-detail-panel">
        <div class="task-detail-header">
          <h2>任务详情 - {{ selectedTaskId }}</h2>
          <button class="close-btn" @click="selectedTask = null">×</button>
        </div>
        <TaskDetail 
          :task="selectedTask" 
          :ws="wsInstance"
          ref="taskDetailRef"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useClusterWebSocket } from './utils/websocket'
import NodeMonitor from './components/NodeMonitor.vue'
import TaskSubmit from './components/TaskSubmit.vue'
import TaskList from './components/TaskList.vue'
import TaskDetail from './components/TaskDetail.vue'

const {
  connected,
  nodes,
  tasks,
  taskDetails,
  connect,
  disconnect,
  submitTask,
  getInstance,
  registerLogHandler
} = useClusterWebSocket()

const wsInstance = computed(() => getInstance())
const taskDetailRef = ref(null)

const selectedTaskId = ref(null)
const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null
  return taskDetails[selectedTaskId.value]
})

const totalNodes = computed(() => nodes.value.length)
const onlineNodes = computed(() => nodes.value.filter(n => n.status === 'online').length)
const runningTasks = computed(() => tasks.value.filter(t => t.status === 'running' || t.status === 'pending').length)
const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed').length)
const avgCpu = computed(() => {
  const online = nodes.value.filter(n => n.status === 'online')
  if (online.length === 0) return 0
  return online.reduce((sum, n) => sum + n.cpu_usage, 0) / online.length
})

function handleSubmitTask(type, params, options) {
  submitTask(type, params, options)
}

function selectTask(taskId) {
  selectedTaskId.value = taskId
}

let unregisterLogHandler = null

onMounted(() => {
  connect()
  unregisterLogHandler = registerLogHandler((logData) => {
    if (taskDetailRef.value && logData.task_id === selectedTaskId.value) {
      taskDetailRef.value.handleLogResponse(logData)
    }
  })
})

onUnmounted(() => {
  if (unregisterLogHandler) {
    unregisterLogHandler()
  }
  disconnect()
})
</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid #334155;
  padding: 1rem 2rem;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
}

.status-dot.offline {
  background: #ef4444;
}

.main {
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
  width: 100%;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #60a5fa;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #94a3b8;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.5rem;
}

.panel h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.tasks-panel {
  margin-bottom: 1.5rem;
}

.task-detail-panel {
  position: relative;
}

.task-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.task-detail-header h2 {
  margin-bottom: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 0.5rem;
}

.close-btn:hover {
  color: #e2e8f0;
}
</style>
