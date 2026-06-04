<template>
  <div class="task-submit">
    <div class="form-group">
      <label>任务类型</label>
      <select v-model="taskType" :disabled="!connected">
        <option value="compute_pi">计算 PI</option>
      </select>
    </div>

    <div class="form-group">
      <label>计算精度 (位数)</label>
      <input 
        type="number" 
        v-model.number="digits" 
        min="100" 
        max="10000"
        :disabled="!connected"
      />
    </div>

    <div class="form-group">
      <label>任务优先级</label>
      <select v-model="priority" :disabled="!connected">
        <option :value="0">低 (Low)</option>
        <option :value="1">普通 (Normal)</option>
        <option :value="2">高 (High)</option>
        <option :value="3">紧急 (Urgent)</option>
      </select>
    </div>

    <div class="form-group">
      <label>亲和性标签 (用逗号分隔)</label>
      <input 
        type="text" 
        v-model="affinityTags" 
        placeholder="例如: high-mem, zone-a"
        :disabled="!connected"
      />
      <span class="hint">可用标签: all, compute, high-mem, zone-a, zone-b, zone-c</span>
    </div>

    <div class="form-group">
      <label>反亲和性标签 (用逗号分隔)</label>
      <input 
        type="text" 
        v-model="antiAffinity" 
        placeholder="例如: zone-b"
        :disabled="!connected"
      />
    </div>

    <div class="form-group">
      <label>首选节点 ID (用逗号分隔, 可选)</label>
      <input 
        type="text" 
        v-model="preferredNodes" 
        placeholder="指定节点ID优先执行"
        :disabled="!connected"
      />
    </div>

    <button 
      class="submit-btn" 
      :disabled="!connected || submitting"
      @click="handleSubmit"
    >
      {{ submitting ? '提交中...' : '提交任务' }}
    </button>

    <div v-if="!connected" class="warning">
      ⚠️ 请先连接到服务器
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  connected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit'])

const taskType = ref('compute_pi')
const digits = ref(1000)
const priority = ref(1)
const affinityTags = ref('')
const antiAffinity = ref('')
const preferredNodes = ref('')
const submitting = ref(false)

function parseTags(input) {
  if (!input || input.trim() === '') return []
  return input.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

async function handleSubmit() {
  if (!props.connected) return

  submitting.value = true
  
  const params = {
    digits: digits.value
  }

  const options = {
    priority: priority.value,
    affinityTags: parseTags(affinityTags.value),
    antiAffinity: parseTags(antiAffinity.value),
    preferredNodes: parseTags(preferredNodes.value)
  }

  emit('submit', taskType.value, params, options)

  setTimeout(() => {
    submitting.value = false
  }, 500)
}
</script>

<style scoped>
.task-submit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  color: #94a3b8;
  font-weight: 500;
}

.form-group select,
.form-group input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: #e2e8f0;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  border-color: #3b82f6;
}

.form-group select:disabled,
.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.submit-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border: none;
  border-radius: 8px;
  padding: 0.875rem 1.5rem;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.warning {
  text-align: center;
  padding: 0.75rem;
  background: #f59e0b20;
  border: 1px solid #f59e0b40;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #f59e0b;
}
</style>
