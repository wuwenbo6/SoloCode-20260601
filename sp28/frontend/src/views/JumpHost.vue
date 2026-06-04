<template>
  <div class="jump-host-page">
    <div class="page-header">
      <h2>
        <el-icon><Connection /></el-icon>
        跳板机管理
      </h2>
      <el-button type="primary" :icon="Plus" @click="openDialog()">
        添加跳板机
      </el-button>
    </div>

    <el-card>
      <el-table :data="jumpHosts" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="host" label="主机" width="200" />
        <el-table-column prop="port" label="端口" width="80" align="center" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" link @click="deleteJumpHost(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !jumpHosts.length" description="暂无跳板机配置" />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingHost ? '编辑跳板机' : '添加跳板机'"
      width="500px"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="跳板机名称">
          <el-input v-model="form.name" placeholder="例如：内网跳板机" />
        </el-form-item>
        <el-form-item label="主机地址">
          <el-input v-model="form.host" placeholder="例如: 192.168.1.1" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="form.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="SSH 用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="SSH 密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="密钥路径">
          <el-input v-model="form.key_path" placeholder="/path/to/private_key (可选)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveJumpHost" :loading="saving">
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
  getJumpHosts,
  createJumpHost,
  updateJumpHost,
  deleteJumpHost
} from '../api/jumpHost'
import dayjs from 'dayjs'

const loading = ref(false)
const saving = ref(false)
const jumpHosts = ref([])
const dialogVisible = ref(false)
const editingHost = ref(null)

const form = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  key_path: ''
})

const loadJumpHosts = async () => {
  loading.value = true
  try {
    const res = await getJumpHosts()
    jumpHosts.value = res.data
  } finally {
    loading.value = false
  }
}

const openDialog = (row = null) => {
  editingHost.value = row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      name: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      key_path: ''
    }
  }
  dialogVisible.value = true
}

const saveJumpHost = async () => {
  if (!form.value.name || !form.value.host || !form.value.username) {
    ElMessage.warning('请填写完整信息')
    return
  }

  saving.value = true
  try {
    if (editingHost.value) {
      await updateJumpHost(editingHost.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createJumpHost(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadJumpHosts()
  } finally {
    saving.value = false
  }
}

const deleteJumpHost = (row) => {
  ElMessageBox.confirm(`确定要删除跳板机 "${row.name}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await deleteJumpHost(row.id)
    ElMessage.success('删除成功')
    loadJumpHosts()
  }).catch(() => {})
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadJumpHosts()
})
</script>
