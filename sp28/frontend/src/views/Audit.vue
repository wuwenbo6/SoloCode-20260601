<template>
  <div class="audit-page">
    <div class="page-header">
      <h2>
        <el-icon><DataAnalysis /></el-icon>
        审计报表
      </h2>
      <div class="header-actions">
        <el-select v-model="selectedDays" size="small" style="width: 120px" @change="loadAll">
          <el-option :value="7" label="最近7天" />
          <el-option :value="30" label="最近30天" />
          <el-option :value="90" label="最近90天" />
        </el-select>
      </div>
    </div>

    <el-row :gutter="20" class="stats-cards">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon sessions">
            <el-icon size="32"><Monitor /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ report?.total_sessions || 0 }}</div>
            <div class="stat-label">总会话数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon commands">
            <el-icon size="32"><Keyboard /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ report?.total_commands || 0 }}</div>
            <div class="stat-label">总命令数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon blocked">
            <el-icon size="32"><CircleClose /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ report?.blocked_commands || 0 }}</div>
            <div class="stat-label">拦截命令</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon users">
            <el-icon size="32"><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ report?.user_stats?.length || 0 }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="用户统计" name="users">
        <el-table :data="userStats" v-loading="loading">
          <el-table-column prop="username" label="用户" width="150" />
          <el-table-column prop="total_sessions" label="会话数" width="120" align="center" />
          <el-table-column prop="total_commands" label="命令数" width="120" align="center" />
          <el-table-column prop="blocked_commands" label="拦截数" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.blocked_commands > 0" type="danger" size="small">
                {{ row.blocked_commands }}
              </el-tag>
              <span v-else>0</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button type="primary" size="small" link @click="viewUserCommands(row)">
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="服务器统计" name="servers">
        <el-table :data="serverStats" v-loading="loading">
          <el-table-column prop="server_name" label="服务器" width="200" />
          <el-table-column prop="total_sessions" label="会话数" width="120" align="center" />
          <el-table-column prop="total_commands" label="命令数" width="120" align="center" />
          <el-table-column prop="blocked_commands" label="拦截数" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.blocked_commands > 0" type="danger" size="small">
                {{ row.blocked_commands }}
              </el-tag>
              <span v-else>0</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="拦截记录" name="blocked">
        <el-table :data="blockedCommands" v-loading="loading">
          <el-table-column prop="executed_at" label="时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.executed_at) }}
            </template>
          </el-table-column>
          <el-table-column prop="user.username" label="用户" width="120" />
          <el-table-column prop="server.name" label="服务器" width="150" />
          <el-table-column prop="command" label="命令" min-width="250">
            <template #default="{ row }">
              <code class="blocked-cmd">{{ row.command }}</code>
            </template>
          </el-table-column>
          <el-table-column label="匹配规则" width="150">
            <template #default="{ row }">
              <el-tag v-if="row.rule" type="danger" size="small">
                {{ row.rule.description || row.rule.pattern }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="每日趋势" name="daily">
        <el-table :data="dailyStats" v-loading="loading">
          <el-table-column prop="date" label="日期" width="150">
            <template #default="{ row }">
              {{ formatDate(row.date) }}
            </template>
          </el-table-column>
          <el-table-column prop="total_sessions" label="会话数" width="120" align="center" />
          <el-table-column prop="total_commands" label="命令数" width="120" align="center" />
          <el-table-column prop="blocked_commands" label="拦截数" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.blocked_commands > 0" type="danger" size="small">
                {{ row.blocked_commands }}
              </el-tag>
              <span v-else>0</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="commandDialogVisible" title="命令详情" width="900px">
      <el-table :data="userCommands" v-loading="loadingCommands">
        <el-table-column prop="executed_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.executed_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="command" label="命令" min-width="300">
          <template #default="{ row }">
            <code :class="{ 'blocked-cmd': row.blocked }">{{ row.command }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="server.name" label="服务器" width="150" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.blocked ? 'danger' : 'success'" size="small">
              {{ row.blocked ? '已拦截' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  getUserStats,
  getServerStats,
  getDailyStats,
  getBlockedCommands,
  getUserCommands,
  getAuditReport
} from '../api/audit'
import dayjs from 'dayjs'

const activeTab = ref('users')
const selectedDays = ref(7)
const loading = ref(false)
const loadingCommands = ref(false)
const commandDialogVisible = ref(false)

const report = ref(null)
const userStats = ref([])
const serverStats = ref([])
const dailyStats = ref([])
const blockedCommands = ref([])
const userCommands = ref([])
const currentUser = ref(null)

const loadAll = async () => {
  loading.value = true
  try {
    const [reportRes, userRes, serverRes, dailyRes, blockedRes] = await Promise.all([
      getAuditReport(selectedDays.value),
      getUserStats(selectedDays.value),
      getServerStats(selectedDays.value),
      getDailyStats(selectedDays.value),
      getBlockedCommands(100)
    ])
    report.value = reportRes.data
    userStats.value = userRes.data
    serverStats.value = serverRes.data
    dailyStats.value = dailyRes.data
    blockedCommands.value = blockedRes.data
  } finally {
    loading.value = false
  }
}

const viewUserCommands = async (row) => {
  currentUser.value = row
  loadingCommands.value = true
  commandDialogVisible.value = true
  try {
    const res = await getUserCommands(row.user_id, 200)
    userCommands.value = res.data
  } finally {
    loadingCommands.value = false
  }
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatDate = (time) => {
  return dayjs(time).format('YYYY-MM-DD')
}

onMounted(() => {
  loadAll()
})
</script>

<style lang="scss" scoped>
.audit-page {
  .header-actions {
    display: flex;
    gap: 12px;
  }

  .stats-cards {
    margin-bottom: 20px;

    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;

      .stat-icon {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;

        &.sessions { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        &.commands { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        &.blocked { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
        &.users { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
      }

      .stat-content {
        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: #303133;
        }
        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-top: 4px;
        }
      }
    }
  }

  .blocked-cmd {
    background: #fef0f0;
    color: #f56c6c;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }
}
</style>
