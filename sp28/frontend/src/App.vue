<template>
  <el-container class="app-container">
    <el-header v-if="authStore.isLoggedIn" class="app-header">
      <div class="header-left">
        <el-button text @click="router.push('/')">
          <el-icon><Monitor /></el-icon>
          <span class="title">SSH 终端管理平台</span>
        </el-button>
      </div>
      <el-menu
        mode="horizontal"
        :default-active="route.path"
        @select="handleMenuSelect"
        class="header-menu"
      >
        <el-menu-item index="/terminal">
          <el-icon><Connection /></el-icon>
          <span>终端连接</span>
        </el-menu-item>
        <el-menu-item index="/sessions">
          <el-icon><List /></el-icon>
          <span>会话列表</span>
        </el-menu-item>
        <el-menu-item index="/playback">
          <el-icon><VideoPlay /></el-icon>
          <span>录像回放</span>
        </el-menu-item>
        <el-menu-item index="/broadcast">
          <el-icon><Promotion /></el-icon>
          <span>直播观看</span>
        </el-menu-item>
        <el-menu-item index="/access">
          <el-icon><Key /></el-icon>
          <span>权限申请</span>
        </el-menu-item>
        <el-menu-item index="/audit">
          <el-icon><DataAnalysis /></el-icon>
          <span>审计报表</span>
        </el-menu-item>
        <el-menu-item v-if="authStore.user?.role === 'admin'" index="/blacklist">
          <el-icon><Warning /></el-icon>
          <span>命令拦截</span>
        </el-menu-item>
        <el-menu-item v-if="authStore.user?.role === 'admin'" index="/jump-hosts">
          <el-icon><Connection /></el-icon>
          <span>跳板机</span>
        </el-menu-item>
        <el-menu-item v-if="authStore.user?.role === 'admin'" index="/admin">
          <el-icon><Setting /></el-icon>
          <span>管理后台</span>
        </el-menu-item>
      </el-menu>
      <div class="header-right">
        <span class="user-info">{{ authStore.user?.username }} ({{ authStore.user?.role }})</span>
        <el-button type="danger" size="small" @click="logout">
          <el-icon><SwitchButton /></el-icon>
          退出
        </el-button>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const handleMenuSelect = (index) => {
  router.push(index)
}

const logout = () => {
  authStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<style lang="scss">
.app-container {
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: #001529;
  border-bottom: 1px solid #002140;

  .header-left {
    .title {
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      margin-left: 8px;
    }
    .el-icon {
      color: #409eff;
      font-size: 24px;
    }
  }

  .header-menu {
    flex: 1;
    border-bottom: none;
    background: transparent;
    margin-left: 20px;

    :deep(.el-menu-item) {
      color: rgba(255,255,255,0.75);
      height: 60px;
      line-height: 60px;

      &:hover, &.is-active {
        color: #fff;
        background: rgba(64,158,255,0.1);
        border-bottom: 2px solid #409eff;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .user-info {
      color: rgba(255,255,255,0.85);
    }
  }
}

.app-main {
  padding: 20px;
  background: #f0f2f5;
  overflow: auto;
}
</style>
