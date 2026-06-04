<template>
  <div class="broadcast-page">
    <div class="page-header">
      <h2>
        <el-icon><Promotion /></el-icon>
        直播会话
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
        <el-table-column label="观看人数" width="100">
          <template #default="{ row }">
            <el-tag type="success">
              {{ row.viewer_count || 0 }} 人
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              link
              @click="$router.push(`/broadcast/${row.id}`)"
            >
              加入观看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !sessions.length" description="暂无正在进行的会话" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getActiveSessions } from '../api/session'
import dayjs from 'dayjs'

const loading = ref(false)
const sessions = ref([])
let refreshTimer = null

const loadSessions = async () => {
  loading.value = true
  try {
    const res = await getActiveSessions()
    sessions.value = res.data
  } finally {
    loading.value = false
  }
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadSessions()
  refreshTimer = setInterval(loadSessions, 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>
