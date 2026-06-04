<template>
  <div class="access-page">
    <div class="page-header">
      <h2>
        <el-icon><Key /></el-icon>
        权限申请与管理
      </h2>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="mb-24">
          <template #header>
            <div class="flex-between">
              <span class="card-title">申请访问权限</span>
            </div>
          </template>

          <el-form :model="requestForm" label-width="100px">
            <el-form-item label="服务器">
              <el-select
                v-model="requestForm.server_id"
                placeholder="选择服务器"
                style="width: 100%"
              >
                <el-option
                  v-for="server in servers"
                  :key="server.id"
                  :label="`${server.name} (${server.host})`"
                  :value="server.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="申请时长">
              <el-select v-model="requestForm.duration" placeholder="选择时长" style="width: 100%">
                <el-option label="1小时" value="1h" />
                <el-option label="4小时" value="4h" />
                <el-option label="8小时" value="8h" />
                <el-option label="1天" value="1d" />
                <el-option label="7天" value="7d" />
                <el-option label="30天" value="30d" />
              </el-select>
            </el-form-item>

            <el-form-item label="申请理由">
              <el-input
                v-model="requestForm.reason"
                type="textarea"
                :rows="3"
                placeholder="请说明访问理由"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="requesting" @click="submitRequest">
                提交申请
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header>
            <span class="card-title">我的访问权限</span>
          </template>

          <el-table :data="myGrants" v-loading="loadingGrants">
            <el-table-column label="服务器">
              <template #default="{ row }">
                {{ row.server?.name || '-' }}
                <el-tag type="info" size="small" style="margin-left: 8px;">
                  {{ row.server?.host || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="过期时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.expires_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="$router.push(`/terminal/${row.server_id}`)"
                >
                  连接
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="flex-between">
              <span class="card-title">我的申请记录</span>
              <el-select v-model="requestStatus" size="small" placeholder="筛选状态" style="width: 120px;">
                <el-option label="全部" value="" />
                <el-option label="待审批" value="pending" />
                <el-option label="已通过" value="approved" />
                <el-option label="已拒绝" value="rejected" />
                <el-option label="已过期" value="expired" />
              </el-select>
            </div>
          </template>

          <el-table :data="myRequests" v-loading="loadingRequests">
            <el-table-column label="服务器">
              <template #default="{ row }">
                {{ row.server?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="理由" :show-overflow-tooltip="true" />
            <el-table-column label="过期时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.expires_at) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)">
                  {{ statusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { requestAccess, getMyGrants, getAccessRequests } from '../api/access'
import { getServers } from '../api/server'
import dayjs from 'dayjs'

const servers = ref([])
const myGrants = ref([])
const myRequests = ref([])
const loadingGrants = ref(false)
const loadingRequests = ref(false)
const requesting = ref(false)
const requestStatus = ref('')

const requestForm = ref({
  server_id: null,
  duration: '1d',
  reason: ''
})

const loadServers = async () => {
  try {
    const res = await getServers()
    servers.value = res.data
  } catch (err) {
    console.error('Failed to load servers:', err)
  }
}

const loadMyGrants = async () => {
  loadingGrants.value = true
  try {
    const res = await getMyGrants()
    myGrants.value = res.data
  } finally {
    loadingGrants.value = false
  }
}

const loadMyRequests = async () => {
  loadingRequests.value = true
  try {
    const res = await getAccessRequests(requestStatus.value)
    myRequests.value = res.data.filter(r => r.user)
  } finally {
    loadingRequests.value = false
  }
}

const submitRequest = async () => {
  if (!requestForm.value.server_id || !requestForm.value.reason) {
    ElMessage.warning('请填写完整信息')
    return
  }

  requesting.value = true
  try {
    await requestAccess(requestForm.value)
    ElMessage.success('申请已提交，等待管理员审批')
    requestForm.value = {
      server_id: null,
      duration: '1d',
      reason: ''
    }
    loadMyRequests()
  } finally {
    requesting.value = false
  }
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
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
  loadMyRequests()
})

onMounted(() => {
  loadServers()
  loadMyGrants()
  loadMyRequests()
})
</script>

<style lang="scss" scoped>
.access-page {
  .mb-24 {
    margin-bottom: 24px;
  }
}
</style>
