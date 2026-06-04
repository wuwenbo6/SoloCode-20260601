<template>
  <div class="task-detail">
    <div class="task-info">
      <div class="info-row">
        <div class="info-item">
          <label>状态</label>
          <span :class="['status-badge', task.status]">{{ getStatusText(task.status) }}</span>
        </div>
        <div class="info-item">
          <label>总进度</label>
          <span class="progress-value">{{ task.progress.toFixed(1) }}%</span>
        </div>
        <div class="info-item">
          <label>优先级</label>
          <span :class="['priority-badge', getPriorityClass(task.priority)]">
            {{ getPriorityText(task.priority) }}
          </span>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button 
        :class="['tab-btn', activeTab === 'shards' ? 'active' : '']"
        @click="activeTab = 'shards'"
      >
        分片详情
      </button>
      <button 
        :class="['tab-btn', activeTab === 'logs' ? 'active' : '']"
        @click="activeTab = 'logs'; fetchLogs()"
      >
        执行日志
      </button>
    </div>

    <div v-if="activeTab === 'shards'" class="shards-section">
      <label>分片详情 ({{ task.shards?.length || 0 }})</label>
      <div class="shards-grid">
        <div 
          v-for="shard in task.shards" 
          :key="shard.index"
          :class="['shard-card', shard.status]"
        >
          <div class="shard-header">
            <span class="shard-index">#{{ shard.index + 1 }}</span>
            <span :class="['shard-status', shard.status]">
              {{ getShardStatusText(shard.status) }}
            </span>
          </div>
          <div class="shard-node">
            {{ shard.node_id || '未分配' }}
          </div>
          <div class="shard-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill"
                :class="shard.status"
                :style="{ width: shard.progress + '%' }"
              ></div>
            </div>
            <span class="progress-text">{{ shard.progress.toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="task.result" class="result-section">
      <label>计算结果</label>
      <div class="result-box">
        {{ task.result }}
      </div>
    </div>

    <div v-if="activeTab === 'logs'" class="logs-section">
      <div class="logs-header">
        <label>执行日志</label>
        <label class="auto-scroll">
          <input type="checkbox" v-model="autoScroll" />
          自动滚动
        </label>
      </div>
      <div class="logs-container" ref="logsContainer">
        <div v-if="logs.length === 0" class="no-logs">
          暂无日志
        </div>
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          :class="['log-entry', 'level-' + log.level]"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span :class="['log-level', 'level-' + log.level]">{{ log.level.toUpperCase() }}</span>
          <span class="log-node">[{{ log.node_id }}]</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, defineProps } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  ws: {
    type: Object,
    default: null
  }
})

const activeTab = ref('shards')
const logs = ref([])
const autoScroll = ref(true)
const logsContainer = ref(null)
const logStreamActive = ref(false)

function getStatusText(status) {
  const texts = {
    'pending': '等待中',
    'running': '运行中',
    'completed': '已完成',
    'failed': '失败'
  }
  return texts[status] || status
}

function getShardStatusText(status) {
  const texts = {
    'pending': '等待',
    'running': '运行',
    'completed': '完成',
    'failed': '失败'
  }
  return texts[status] || status
}

function getPriorityText(priority) {
  const texts = {
    0: '低',
    1: '普通',
    2: '高',
    3: '紧急'
  }
  return texts[priority] || '普通'
}

function getPriorityClass(priority) {
  const classes = {
    0: 'priority-low',
    1: 'priority-normal',
    2: 'priority-high',
    3: 'priority-urgent'
  }
  return classes[priority] || 'priority-normal'
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function scrollToBottom() {
  if (autoScroll.value && logsContainer.value) {
    nextTick(() => {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    })
  }
}

function fetchLogs() {
  if (!props.ws || !props.task?.task_id) return
  
  logs.value = []
  
  const request = {
    type: 'task_log_request',
    payload: {
      task_id: props.task.task_id,
      follow: true,
      since_time: 0
    }
  }
  
  props.ws.send(JSON.stringify(request))
}

function handleLogResponse(response) {
  if (response.task_id === props.task?.task_id) {
    if (response.entries) {
      logs.value = [...logs.value, ...response.entries]
      scrollToBottom()
    }
    if (response.done) {
      logStreamActive.value = false
    }
  }
}

watch(() => props.task?.task_id, (newId, oldId) => {
  if (newId !== oldId) {
    logs.value = []
    if (activeTab.value === 'logs') {
      fetchLogs()
    }
  }
})

onBeforeUnmount(() => {
  logs.value = []
})

defineExpose({
  handleLogResponse
})
</script>

<style scoped>
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.task-info {
  display: flex;
  gap: 2rem;
}

.info-row {
  display: flex;
  gap: 2rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #60a5fa;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.pending {
  background: #f59e0b20;
  color: #f59e0b;
}

.status-badge.running {
  background: #3b82f620;
  color: #60a5fa;
}

.status-badge.completed {
  background: #22c55e20;
  color: #22c55e;
}

.status-badge.failed {
  background: #ef444420;
  color: #ef4444;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-section label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.result-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 1rem;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
  color: #a78bfa;
  word-break: break-all;
  line-height: 1.6;
  max-height: 100px;
  overflow-y: auto;
}

.shards-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shards-section label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.shards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.shard-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.75rem;
}

.shard-card.pending {
  border-color: #f59e0b40;
}

.shard-card.running {
  border-color: #3b82f640;
}

.shard-card.completed {
  border-color: #22c55e40;
}

.shard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.shard-index {
  font-weight: 600;
  font-size: 0.875rem;
  color: #e2e8f0;
}

.shard-status {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.shard-status.pending {
  background: #f59e0b20;
  color: #f59e0b;
}

.shard-status.running {
  background: #3b82f620;
  color: #60a5fa;
}

.shard-status.completed {
  background: #22c55e20;
  color: #22c55e;
}

.shard-node {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.shard-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shard-progress .progress-bar {
  flex: 1;
  height: 4px;
  background: #334155;
  border-radius: 2px;
  overflow: hidden;
}

.shard-progress .progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.shard-progress .progress-fill.pending {
  background: #f59e0b;
}

.shard-progress .progress-fill.running {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.shard-progress .progress-fill.completed {
  background: #22c55e;
}

.shard-progress .progress-text {
  font-size: 0.75rem;
  color: #94a3b8;
  min-width: 30px;
  text-align: right;
}

.priority-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

.priority-badge.priority-low {
  background: #64748b20;
  color: #94a3b8;
}

.priority-badge.priority-normal {
  background: #3b82f620;
  color: #60a5fa;
}

.priority-badge.priority-high {
  background: #f59e0b20;
  color: #f59e0b;
}

.priority-badge.priority-urgent {
  background: #ef444420;
  color: #ef4444;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #334155;
  padding-bottom: 0.5rem;
}

.tab-btn {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #e2e8f0;
  background: #1e293b;
}

.tab-btn.active {
  color: #60a5fa;
  background: #1e293b;
  border-bottom: 2px solid #60a5fa;
}

.logs-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs-header label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.auto-scroll {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #94a3b8;
  cursor: pointer;
}

.auto-scroll input {
  cursor: pointer;
}

.logs-container {
  background: #020617;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}

.no-logs {
  text-align: center;
  color: #475569;
  padding: 2rem;
}

.log-entry {
  display: flex;
  gap: 0.5rem;
  padding: 0.125rem 0;
  border-bottom: 1px solid #0f172a;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #475569;
  flex-shrink: 0;
}

.log-level {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 50px;
}

.log-level.level-info {
  color: #60a5fa;
}

.log-level.level-warn {
  color: #f59e0b;
}

.log-level.level-error {
  color: #ef4444;
}

.log-level.level-debug {
  color: #64748b;
}

.log-node {
  color: #a78bfa;
  flex-shrink: 0;
}

.log-message {
  color: #cbd5e1;
  word-break: break-all;
}

.log-entry.level-warn {
  background: #f59e0b08;
}

.log-entry.level-error {
  background: #ef444408;
}
</style>
