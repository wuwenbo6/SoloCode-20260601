<template>
  <div class="blacklist-page">
    <div class="page-header">
      <h2>
        <el-icon><Warning /></el-icon>
        命令黑名单
      </h2>
      <el-button type="primary" :icon="Plus" @click="openDialog()">
        添加规则
      </el-button>
    </div>

    <el-card>
      <el-table :data="rules" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="pattern" label="匹配规则" min-width="200">
          <template #default="{ row }">
            <code class="pattern-text">{{ row.pattern }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="severityType(row.severity)">
              {{ severityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="toggleRule(row)"
              active-text="启用"
              inactive-text="禁用"
            />
          </template>
        </el-table-column>
        <el-table-column label="拦截" width="80">
          <template #default="{ row }">
            <el-tag :type="row.block ? 'danger' : 'info'">
              {{ row.block ? '拦截' : '记录' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" link @click="deleteRule(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingRule ? '编辑规则' : '添加规则'"
      width="600px"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="匹配规则">
          <el-input
            v-model="form.pattern"
            placeholder="正则表达式，例如: rm\s+-rf\s+/"
          />
          <div class="form-tip">使用正则表达式匹配命令</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="规则描述"
          />
        </el-form-item>
        <el-form-item label="严重级别">
          <el-select v-model="form.severity" style="width: 100%">
            <el-option label="警告" value="warning" />
            <el-option label="高危" value="high" />
            <el-option label="严重" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用规则">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="拦截执行">
          <el-switch v-model="form.block" />
          <span class="form-tip">启用后将阻止命令执行</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule" :loading="saving">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getBlacklistRules,
  createBlacklistRule,
  updateBlacklistRule,
  deleteBlacklistRule
} from '../api/blacklist'

const loading = ref(false)
const saving = ref(false)
const rules = ref([])
const dialogVisible = ref(false)
const editingRule = ref(null)

const form = ref({
  pattern: '',
  description: '',
  severity: 'warning',
  enabled: true,
  block: true
})

const loadRules = async () => {
  loading.value = true
  try {
    const res = await getBlacklistRules()
    rules.value = res.data
  } finally {
    loading.value = false
  }
}

const openDialog = (row = null) => {
  editingRule.value = row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      pattern: '',
      description: '',
      severity: 'warning',
      enabled: true,
      block: true
    }
  }
  dialogVisible.value = true
}

const saveRule = async () => {
  if (!form.value.pattern) {
    ElMessage.warning('请输入匹配规则')
    return
  }

  saving.value = true
  try {
    if (editingRule.value) {
      await updateBlacklistRule(editingRule.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createBlacklistRule(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadRules()
  } finally {
    saving.value = false
  }
}

const toggleRule = async (row) => {
  await updateBlacklistRule(row.id, { enabled: row.enabled })
  ElMessage.success(row.enabled ? '已启用' : '已禁用')
}

const deleteRule = (row) => {
  ElMessageBox.confirm(`确定要删除规则 "${row.pattern}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await deleteBlacklistRule(row.id)
    ElMessage.success('删除成功')
    loadRules()
  }).catch(() => {})
}

const severityType = (severity) => {
  switch (severity) {
    case 'warning': return 'warning'
    case 'high': return 'danger'
    case 'critical': return 'danger'
    default: return 'info'
  }
}

const severityText = (severity) => {
  switch (severity) {
    case 'warning': return '警告'
    case 'high': return '高危'
    case 'critical': return '严重'
    default: return severity
  }
}

onMounted(() => {
  loadRules()
})
</script>

<style lang="scss" scoped>
.blacklist-page {
  .pattern-text {
    background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }

  .form-tip {
    color: #909399;
    font-size: 12px;
    margin-top: 4px;
  }
}
</style>
