<template>
  <div class="task-list">
    <div v-if="tasks.length === 0" class="empty-state">
      暂无任务，提交一个任务开始计算
    </div>
    <div class="task-table">
      <div class="table-header">
        <div class="col-id">任务ID</div>
        <div class="col-priority">优先级</div>
        <div class="col-type">类型</div>
        <div class="col-status">状态</div>
        <div class="col-progress">进度</div>
        <div class="col-time">创建时间</div>
      </div>
      <div 
        v-for="task in tasks" 
        :key="task.id"
        class="table-row"
        @click="$emit('select', task.id)"
      >
        <div class="col-id">{{ task.id.slice(0, 8) }}...</div>
        <div class="col-priority">
          <span :class="['priority-tag', 'priority-' + task.priority]">
            {{ getPriorityText(task.priority) }}
          </span>
        </div>
        <div class="col-type">{{ getTaskTypeName(task.type) }}</div>
        <div class="col-status">
          <span :class="['status-badge', task.status]">
            {{ getStatusText(task.status) }}
          </span>
        </div>
        <div class="col-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :class="task.status"
              :style="{ width: task.progress + '%' }"
            ></div>
          </div>
          <span class="progress-text">{{ task.progress.toFixed(1) }}%</span>
        </div>
        <div class="col-time">{{ formatTime(task.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  taskDetails: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['select'])

function getTaskTypeName(type) {
  const names = {
    'compute_pi': '计算 PI'
  }
  return names[type] || type
}

function getStatusText(status) {
  const texts = {
    'pending': '等待中',
    'running': '运行中',
    'completed': '已完成',
    'failed': '失败'
  }
  return texts[status] || status
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('zh-CN')
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
</script>

<style scoped>
.task-list {
  max-height: 300px;
  overflow-y: auto;
}

.task-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 80px 100px 100px 1.5fr 120px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #334155;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 80px 100px 100px 1.5fr 120px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  align-items: center;
}

.priority-tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  width: 100%;
}

.priority-tag.priority-0 {
  background: #64748b20;
  color: #94a3b8;
}

.priority-tag.priority-1 {
  background: #3b82f620;
  color: #60a5fa;
}

.priority-tag.priority-2 {
  background: #f59e0b20;
  color: #f59e0b;
}

.priority-tag.priority-3 {
  background: #ef444420;
  color: #ef4444;
}

.table-row:hover {
  border-color: #3b82f6;
  background: #1e293b;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
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

.col-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #334155;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-fill.pending {
  background: #f59e0b;
}

.progress-fill.running {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.progress-fill.completed {
  background: #22c55e;
}

.progress-fill.failed {
  background: #ef4444;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  min-width: 50px;
  text-align: right;
}

.col-time {
  font-size: 0.875rem;
  color: #64748b;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}
</style>
