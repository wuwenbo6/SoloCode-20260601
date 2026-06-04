<template>
  <div class="node-monitor">
    <div v-if="nodes.length === 0" class="empty-state">
      暂无节点连接
    </div>
    <div class="nodes-grid">
      <div 
        v-for="node in sortedNodes" 
        :key="node.node_id"
        :class="['node-card', node.status]"
      >
        <div class="node-header">
          <span :class="['status-indicator', node.status]"></span>
          <span class="node-name">{{ node.node_id }}</span>
        </div>
        <div class="node-hostname">{{ node.hostname }}</div>
        <div class="node-metrics">
          <div class="metric">
            <div class="metric-label">CPU</div>
            <div class="metric-bar">
              <div 
                class="metric-fill cpu" 
                :style="{ width: node.cpu_usage + '%' }"
              ></div>
            </div>
            <div class="metric-value">{{ node.cpu_usage.toFixed(1) }}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">内存</div>
            <div class="metric-bar">
              <div 
                class="metric-fill mem" 
                :style="{ width: node.mem_usage + '%' }"
              ></div>
            </div>
            <div class="metric-value">{{ node.mem_usage.toFixed(1) }}%</div>
          </div>
        </div>
        <div class="node-tasks">
          <span class="tasks-label">任务数:</span>
          <span class="tasks-value">{{ node.task_count }}</span>
        </div>
        <div v-if="node.tags && node.tags.length > 0" class="node-tags">
          <span 
            v-for="tag in node.tags" 
            :key="tag" 
            class="tag"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  }
})

const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => {
    if (a.status === b.status) {
      return a.node_id.localeCompare(b.node_id)
    }
    return a.status === 'online' ? -1 : 1
  })
})
</script>

<style scoped>
.node-monitor {
  max-height: 400px;
  overflow-y: auto;
}

.nodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.node-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.875rem;
  transition: all 0.2s;
}

.node-card.online {
  border-color: #22c55e40;
}

.node-card.offline {
  border-color: #ef444440;
  opacity: 0.6;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.status-indicator.offline {
  background: #ef4444;
}

.node-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: #e2e8f0;
}

.node-hostname {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.75rem;
}

.node-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.metric {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.metric-label {
  width: 40px;
  font-size: 0.75rem;
  color: #64748b;
}

.metric-bar {
  flex: 1;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.metric-fill.cpu {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.metric-fill.mem {
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}

.metric-value {
  width: 45px;
  font-size: 0.75rem;
  text-align: right;
  color: #94a3b8;
}

.node-tasks {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  justify-content: space-between;
}

.tasks-value {
  font-weight: 600;
  color: #60a5fa;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.node-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.tag {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
  font-size: 0.65rem;
  color: #94a3b8;
}
</style>
