<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>
        <el-icon><Setting /></el-icon>
        管理后台
      </h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="服务器管理" name="servers">
        <div class="tab-content">
          <div class="tab-header">
            <el-button type="primary" :icon="Plus" @click="openServerDialog()">
              添加服务器
            </el-button>
          </div>

          <el-table :data="servers" v-loading="loadingServers">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="host" label="主机" width="200" />
            <el-table-column prop="port" label="端口" width="80" />
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column label="跳板机" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.jump_host" type="info" size="small">
                  {{ row.jump_host.name }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="tags" label="标签" width="150" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="openServerDialog(row)">编辑</el-button>
                <el-button type="danger" size="small" link @click="deleteServer(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="权限审批" name="access">
        <div class="tab-content">
          <div class="tab-header">
            <el-radio-group v-model="requestStatus" size="small">
              <el-radio-button value="pending">待审批</el-radio-button>
              <el-radio-button value="approved">已通过</el-radio-button>
              <el-radio-button value="rejected">已拒绝</el-radio-button>
              <el-radio-button value="">全部</el-radio-button>
            </el-radio-group>
            <el-button :icon="Refresh" @click="loadRequests">刷新</el-button>
          </div>

          <el-table :data="accessRequests" v-loading="loadingRequests">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column label="申请人" width="120">
              <template #default="{ row }">
                {{ row.user?.username || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="服务器">
              <template #default="{ row }">
                {{ row.server?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="申请理由" :show-overflow-tooltip="true" />
            <el-table-column label="过期时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.expires_at) }}
              </template>
            </el-table-column>
            <el-table-column label="申请时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)">
                  {{ statusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pending'"
                  type="success"
                  size="small"
                  link
                  @click="approveRequest(row.id)"
                >
                  通过
                </el-button>
                <el-button
                  v-if="row.status === 'pending'"
                  type="danger"
                  size="small"
                  link
                  @click="rejectRequest(row.id)"
                >
                  拒绝
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="用户管理" name="users">
        <div class="tab-content">
          <el-table :data="users" v-loading="loadingUsers">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="username" label="用户名" width="200" />
            <el-table-column prop="role" label="角色" width="150">
              <template #default="{ row }">
                <el-tag :type="row.role === 'admin' ? 'danger' : 'info'">
                  {{ row.role === 'admin' ? '管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="200">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="serverDialogVisible"
      :title="editingServer ? '编辑服务器' : '添加服务器'"
      width="500px"
    >
      <el-form :model="serverForm" label-width="100px">
        <el-form-item label="服务器名称">
          <el-input v-model="serverForm.name" placeholder="请输入服务器名称" />
        </el-form-item>
        <el-form-item label="主机地址">
          <el-input v-model="serverForm.host" placeholder="例如: 192.168.1.1" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="serverForm.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="serverForm.username" placeholder="SSH 用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="serverForm.password" type="password" placeholder="SSH 密码" show-password />
        </el-form-item>
        <el-form-item label="跳板机">
          <el-select v-model="serverForm.jump_host_id" placeholder="选择跳板机（可选）" clearable>
            <el-option
              v-for="jh in jumpHosts"
              :key="jh.id"
              :label="`${jh.name} (${jh.host})`"
              :value="jh.id"
            />
          </el-select>
          <div class="form-tip">通过跳板机连接到此服务器</div>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="serverForm.tags" placeholder="用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serverDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveServer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getServers, createServer, updateServer, deleteServer as removeServer } from '../api/server'
import { getAccessRequests, approveRequest as approve, rejectRequest as reject } from '../api/access'
import { getCurrentUser } from '../api/auth'
import { getJumpHosts } from '../api/jumpHost'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const activeTab = ref('servers')
const serverDialogVisible = ref(false)
const editingServer = ref(null)
const requestStatus = ref('pending')

const servers = ref([])
const accessRequests = ref([])
const users = ref([])
const jumpHosts = ref([])
const loadingServers = ref(false)
const loadingRequests = ref(false)
const loadingUsers = ref(false)

const serverForm = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  tags: '',
  jump_host_id: null
})

const loadServers = async () => {
  loadingServers.value = true
  try {
    const [serverRes, jumpHostRes] = await Promise.all([
      getServers(),
      getJumpHosts()
    ])
    servers.value = serverRes.data
    jumpHosts.value = jumpHostRes.data
  } finally {
    loadingServers.value = false
  }
}

const loadRequests = async () => {
  loadingRequests.value = true
  try {
    const res = await getAccessRequests(requestStatus.value)
    accessRequests.value = res.data
  } finally {
    loadingRequests.value = false
  }
}

const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await getCurrentUser()
    users.value = res.data ? [res.data] : []
  } finally {
    loadingUsers.value = false
  }
}

const openServerDialog = (row = null) => {
  editingServer.value = row
  if (row) {
    serverForm.value = {
      ...row,
      jump_host_id: row.jump_host_id || null
    }
  } else {
    serverForm.value = {
      name: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      tags: '',
      jump_host_id: null
    }
  }
  serverDialogVisible.value = true
}

const saveServer = async () => {
  try {
    if (editingServer.value) {
      await updateServer(editingServer.value.id, serverForm.value)
      ElMessage.success('更新成功')
    } else {
      await createServer(serverForm.value)
      ElMessage.success('创建成功')
    }
    serverDialogVisible.value = false
    loadServers()
  } catch (err) {
    console.error(err)
  }
}

const deleteServer = (row) => {
  ElMessageBox.confirm(`确定要删除服务器 "${row.name}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await removeServer(row.id)
    ElMessage.success('删除成功')
    loadServers()
  }).catch(() => {})
}

const approveRequest = async (id) => {
  try {
    await approve(id)
    ElMessage.success('已通过')
    loadRequests()
  } catch (err) {
    console.error(err)
  }
}

const rejectRequest = async (id) => {
  ElMessageBox.confirm('确定要拒绝该申请吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await reject(id)
    ElMessage.success('已拒绝')
    loadRequests()
  }).catch(() => {})
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const statusType = (status) => {
  switch (status) {
    case 'pending': return 'warning'
    case 'approved': return 'success'
    case 'rejected': return 'danger'
    case 'expired': return 'info'
    default: return 'info'
  }
}

const statusText = (status) => {
  switch (status) {
    case 'pending': return '待审批'
    case 'approved': return '已通过'
    case 'rejected': return '已拒绝'
    case 'expired': return '已过期'
    default: return status
  }
}

watch(requestStatus, () => {
  loadRequests()
})

onMounted(() => {
  loadServers()
  loadRequests()
  loadUsers()
})
</script>

<style lang="scss" scoped>
.admin-page {
  .tab-content {
    padding-top: 16px;
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .form-tip {
    color: #909399;
    font-size: 12px;
    margin-top: 4px;
  }
}
</style>
