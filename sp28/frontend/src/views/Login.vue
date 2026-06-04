<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="login-header">
        <el-icon size="48" color="#409eff"><Monitor /></el-icon>
        <h1>SSH 终端管理平台</h1>
        <p>安全的 Web SSH 终端解决方案</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-width="0" size="large">
            <el-form-item>
              <el-input
                v-model="loginForm.username"
                placeholder="用户名"
                prefix-icon="User"
                autocomplete="username"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                prefix-icon="Lock"
                autocomplete="current-password"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="full-width" size="large" :loading="loading" @click="handleLogin">
                登 录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" label-width="0" size="large">
            <el-form-item>
              <el-input
                v-model="registerForm.username"
                placeholder="用户名"
                prefix-icon="User"
                autocomplete="username"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="密码"
                prefix-icon="Lock"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="确认密码"
                prefix-icon="Lock"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="full-width" size="large" :loading="loading" @click="handleRegister">
                注 册
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="login-footer">
        <p class="tip">默认账号: admin / admin123 或 user / user123</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref('login')
const loading = ref(false)

const loginForm = ref({
  username: 'admin',
  password: 'admin123'
})

const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    return
  }
  loading.value = true
  try {
    await authStore.login(loginForm.value.username, loginForm.value.password)
    router.push('/terminal')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!registerForm.value.username || !registerForm.value.password) {
    return
  }
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    return
  }
  loading.value = true
  try {
    await authStore.register(registerForm.value.username, registerForm.value.password)
    activeTab.value = 'login'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: #303133;
  }

  p {
    color: #909399;
    font-size: 14px;
    margin: 0;
  }
}

.login-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }
}

.login-footer {
  margin-top: 20px;
  text-align: center;

  .tip {
    font-size: 12px;
    color: #c0c4cc;
    margin: 0;
  }
}
</style>
