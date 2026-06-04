<template>
  <div class="sessions-page">
    <div class="page-header">
      <h2>
        <el-icon><List /></el-icon>
        会话列表
      </h2>
      <el-button type="primary" :icon="Refresh" @click="loadSessions">刷新</el-button>
    </div>

    <el-card>
      <el-table :data="sessions" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="用户" width="120">
          <template #default="{ row }">
            {{ row.user?.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="服务器">
          <template #default="{ row }">
            {{ row.server?.name || '-' }}
            <el-tag type="info" size="small" style="margin-left: 8px;">
              {{ row.server?.host || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.start_time) }}
          </template>
        </el-table-column>
        <el-table-column label="结束时间" width="180">
          <template #default="{ row }">
            {{ row.end_time ? formatTime(row.end_time) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="时长" width="100">
          <template #default="{ row }">
            {{ row.end_time ? formatDuration(row.start_time, row.end_time) : '-' }}
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
              v-if="row.recording_path"
              type="primary"
              size="small"
              link
              @click="$router.push(`/playback/${row.id}`)"
            >
              查看录像
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSessions } from '../api/session'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const sessions = ref([])

const loadSessions = async () => {
  loading.value = true
  try {
    const res = await getSessions()
    sessions.value = res.data
  } finally {
    loading.value = false
  }
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatDuration = (start, end) => {
  const diff = dayjs(end).diff(dayjs(start), 'second')
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

const statusType = (status) => {
  switch (status) {
    case 'active': return 'success'
    case 'ended': return 'info'
    default: return 'info'
  }
}

const statusText = (status) => {
  switch (status) {
    case 'active': return '进行中'
    case 'ended': return '已结束'
    default: return status
  }
}

onMounted(() => {
  loadSessions()
})
</script>
