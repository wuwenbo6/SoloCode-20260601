import { defineStore } from 'pinia'
import { login, register, getCurrentUser } from '../api/auth'
import { ElMessage } from 'element-plus'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin'
  },
  actions: {
    async login(username, password) {
      try {
        const res = await login({ username, password })
        this.token = res.data.token
        this.user = res.data.user
        ElMessage.success('登录成功')
        return res
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '登录失败')
        throw err
      }
    },
    async register(username, password) {
      try {
        const res = await register({ username, password })
        ElMessage.success('注册成功')
        return res
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '注册失败')
        throw err
      }
    },
    async fetchCurrentUser() {
      try {
        const res = await getCurrentUser()
        this.user = res.data
      } catch (err) {
        this.logout()
      }
    },
    logout() {
      this.token = ''
      this.user = null
    }
  },
  persist: {
    key: 'ssh-terminal-auth',
    paths: ['token', 'user']
  }
})
