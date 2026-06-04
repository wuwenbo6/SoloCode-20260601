<template>
  <el-card class="rules-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" color="#909399"><Setting /></el-icon>
        <span>自动化规则管理</span>
        <div style="margin-left: auto; display: flex; gap: 10px;">
          <el-button type="warning" @click="handleEvaluateRules">
            <el-icon><VideoPlay /></el-icon>
            手动评估规则
          </el-button>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建规则
          </el-button>
        </div>
      </div>
    </template>

    <el-table :data="store.rules" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="规则名称" width="180" />
      <el-table-column label="条件" min-width="250">
        <template #default="{ row }">
          <div class="condition-display">
            <template v-if="row.condition_type === 'temperature'">
              <el-tag type="primary" size="small">温度</el-tag>
              <span class="operator">{{ getOperatorText(row.condition_operator) }}</span>
              <el-tag type="info" size="small">{{ row.condition_value }}°C</el-tag>
            </template>
            <template v-else-if="row.condition_type === 'time'">
              <el-tag type="success" size="small">时间</el-tag>
              <span class="operator">{{ row.time_start }} - {{ row.time_end }}</span>
            </template>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="动作" min-width="250">
        <template #default="{ row }">
          <div class="action-display">
            <el-tag :type="getActionType(row.action_type)" size="small">
              {{ getActionText(row.action_type) }}
            </el-tag>
            <span v-if="row.action_value !== undefined && row.action_value !== null" class="action-value">
              {{ row.action_value }}{{ row.action_type.includes('temp') ? '°C' : '%' }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="dark" size="small">
            {{ row.enabled ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="冷却时间" width="100">
        <template #default="{ row }">
          <span>{{ row.cooling_minutes }}分钟</span>
        </template>
      </el-table-column>
      <el-table-column label="最后触发" width="180">
        <template #default="{ row }">
          <span v-if="row.last_triggered">{{ formatTime(row.last_triggered) }}</span>
          <span v-else class="text-muted">未触发</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleEdit(row)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button size="small" type="danger" link @click="handleDelete(row)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="store.rules.length === 0 && !loading" description="暂无规则，点击新建按钮创建" />

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑规则' : '新建规则'" width="600px">
      <el-form :model="form" label-width="120px" ref="formRef">
        <el-form-item label="规则名称" prop="name" :rules="[{ required: true, message: '请输入规则名称', trigger: 'blur' }]">
          <el-input v-model="form.name" placeholder="请输入规则名称" />
        </el-form-item>

        <el-form-item label="规则描述">
          <el-input v-model="form.description" placeholder="请输入规则描述（可选）" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-form-item label="冷却时间">
          <el-input-number v-model="form.cooling_minutes" :min="0" :max="60" :step="1" />
          <span style="margin-left: 10px; color: #909399;">分钟（规则触发后的冷却期，防止高频重复执行）</span>
        </el-form-item>

        <el-divider content-position="left">条件设置</el-divider>

        <el-form-item label="条件类型" prop="condition_type" :rules="[{ required: true, message: '请选择条件类型', trigger: 'change' }]">
          <el-select v-model="form.condition_type" @change="handleConditionTypeChange">
            <el-option label="温度条件" value="temperature" />
            <el-option label="时间条件" value="time" />
          </el-select>
        </el-form-item>

        <template v-if="form.condition_type === 'temperature'">
          <el-form-item label="操作符" prop="condition_operator" :rules="[{ required: true, message: '请选择操作符', trigger: 'change' }]">
            <el-select v-model="form.condition_operator">
              <el-option label="大于 (>)" value=">" />
              <el-option label="大于等于 (>=)" value=">=" />
              <el-option label="小于 (<)" value="<" />
              <el-option label="小于等于 (<=)" value="<=" />
              <el-option label="等于 (==)" value="==" />
              <el-option label="不等于 (!=)" value="!=" />
            </el-select>
          </el-form-item>
          <el-form-item label="温度值" prop="condition_value" :rules="[{ required: true, message: '请输入温度值', trigger: 'blur' }]">
            <el-input-number v-model="form.condition_value" :min="-10" :max="50" :step="0.5" />
            <span style="margin-left: 10px; color: #909399;">°C</span>
          </el-form-item>
        </template>

        <template v-if="form.condition_type === 'time'">
          <el-form-item label="开始时间" prop="time_start" :rules="[{ required: true, message: '请选择开始时间', trigger: 'change' }]">
            <el-time-select
              v-model="form.time_start"
              start="00:00"
              step="00:30"
              end="23:59"
              placeholder="选择开始时间"
              format="HH:mm"
              value-format="HH:mm"
            />
          </el-form-item>
          <el-form-item label="结束时间" prop="time_end" :rules="[{ required: true, message: '请选择结束时间', trigger: 'change' }]">
            <el-time-select
              v-model="form.time_end"
              start="00:00"
              step="00:30"
              end="23:59"
              placeholder="选择结束时间"
              format="HH:mm"
              value-format="HH:mm"
            />
          </el-form-item>
        </template>

        <el-divider content-position="left">动作设置</el-divider>

        <el-form-item label="动作类型" prop="action_type" :rules="[{ required: true, message: '请选择动作类型', trigger: 'change' }]">
          <el-select v-model="form.action_type" @change="handleActionTypeChange">
            <el-option label="开启空调" value="ac_on" />
            <el-option label="关闭空调" value="ac_off" />
            <el-option label="设置空调温度" value="ac_set_temp" />
            <el-option label="开启灯光" value="light_on" />
            <el-option label="关闭灯光" value="light_off" />
            <el-option label="设置灯光亮度" value="light_set_brightness" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="showActionValue" label="动作值" prop="action_value" :rules="[{ required: true, message: '请输入动作值', trigger: 'blur' }]">
          <el-input-number
            v-model="form.action_value"
            :min="actionValueMin"
            :max="actionValueMax"
            :step="form.action_type === 'ac_set_temp' ? 1 : 5"
          />
          <span style="margin-left: 10px; color: #909399;">
            {{ form.action_type === 'ac_set_temp' ? '°C' : '%' }}
          </span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const formRef = ref(null)

const defaultForm = () => ({
  name: '',
  description: '',
  enabled: true,
  cooling_minutes: 5,
  condition_type: 'temperature',
  condition_operator: '>',
  condition_value: 25,
  time_start: '08:00',
  time_end: '18:00',
  action_type: 'ac_on',
  action_value: 24
})

const form = reactive(defaultForm())

const showActionValue = computed(() => {
  return ['ac_set_temp', 'light_set_brightness'].includes(form.action_type)
})

const actionValueMin = computed(() => {
  return form.action_type === 'ac_set_temp' ? 16 : 0
})

const actionValueMax = computed(() => {
  return form.action_type === 'ac_set_temp' ? 30 : 100
})

const formatTime = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getOperatorText = (op) => {
  const map = {
    '>': '大于',
    '>=': '大于等于',
    '<': '小于',
    '<=': '小于等于',
    '==': '等于',
    '!=': '不等于'
  }
  return map[op] || op
}

const getActionText = (type) => {
  const map = {
    'ac_on': '开启空调',
    'ac_off': '关闭空调',
    'ac_set_temp': '设置空调温度',
    'light_on': '开启灯光',
    'light_off': '关闭灯光',
    'light_set_brightness': '设置灯光亮度'
  }
  return map[type] || type
}

const getActionType = (type) => {
  if (!type) return 'info'
  if (type.includes('ac')) return 'primary'
  if (type.includes('light')) return 'warning'
  return 'info'
}

const handleConditionTypeChange = () => {
  if (form.condition_type === 'temperature') {
    form.condition_operator = '>'
    form.condition_value = 25
    form.time_start = null
    form.time_end = null
  } else {
    form.condition_operator = null
    form.condition_value = null
    form.time_start = '08:00'
    form.time_end = '18:00'
  }
}

const handleActionTypeChange = () => {
  if (form.action_type === 'ac_set_temp') {
    form.action_value = 24
  } else if (form.action_type === 'light_set_brightness') {
    form.action_value = 50
  } else {
    form.action_value = null
  }
}

const handleCreate = () => {
  isEdit.value = false
  editId.value = null
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, JSON.parse(JSON.stringify(row)))
  if (form.condition_type === 'temperature') {
    form.time_start = form.time_start || null
    form.time_end = form.time_end || null
  } else {
    form.condition_operator = form.condition_operator || null
    form.condition_value = form.condition_value !== undefined ? form.condition_value : null
  }
  if (!showActionValue.value) {
    form.action_value = form.action_value !== undefined ? form.action_value : null
  }
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除规则 "${row.name}" 吗？`, '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await store.deleteRule(row.id)
      ElMessage.success('删除成功')
    } catch (e) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    const payload = {
      name: form.name,
      description: form.description,
      enabled: form.enabled,
      cooling_minutes: form.cooling_minutes,
      condition_type: form.condition_type,
      condition_operator: form.condition_operator,
      condition_value: form.condition_value,
      time_start: form.time_start,
      time_end: form.time_end,
      action_type: form.action_type,
      action_value: form.action_value
    }

    if (isEdit.value) {
      await store.updateRule(editId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await store.createRule(payload)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
  } catch (e) {
    if (e !== false) {
      console.error(e)
      ElMessage.error('操作失败')
    }
  }
}

const handleEvaluateRules = async () => {
  try {
    const result = await store.evaluateRules()
    ElMessage.success('规则评估已触发')
  } catch (e) {
    ElMessage.error('规则评估失败')
  }
}
</script>

<style scoped>
.rules-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.condition-display,
.action-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.operator {
  color: #606266;
  font-weight: 500;
}

.action-value {
  color: #E6A23C;
  font-weight: 600;
}

.text-muted {
  color: #909399;
  font-size: 13px;
}
</style>
