import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    redirect: '/terminal'
  },
  {
    path: '/terminal',
    name: 'Terminal',
    component: () => import('../views/Terminal.vue')
  },
  {
    path: '/terminal/:serverId',
    name: 'TerminalConnect',
    component: () => import('../views/Terminal.vue')
  },
  {
    path: '/sessions',
    name: 'Sessions',
    component: () => import('../views/Sessions.vue')
  },
  {
    path: '/playback',
    name: 'PlaybackList',
    component: () => import('../views/PlaybackList.vue')
  },
  {
    path: '/playback/:id',
    name: 'Playback',
    component: () => import('../views/Playback.vue')
  },
  {
    path: '/broadcast',
    name: 'Broadcast',
    component: () => import('../views/Broadcast.vue')
  },
  {
    path: '/broadcast/:id',
    name: 'BroadcastView',
    component: () => import('../views/BroadcastView.vue')
  },
  {
    path: '/access',
    name: 'Access',
    component: () => import('../views/Access.vue')
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { admin: true }
  },
  {
    path: '/blacklist',
    name: 'Blacklist',
    component: () => import('../views/Blacklist.vue'),
    meta: { admin: true }
  },
  {
    path: '/jump-hosts',
    name: 'JumpHost',
    component: () => import('../views/JumpHost.vue'),
    meta: { admin: true }
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('../views/Audit.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (!to.meta.public && !authStore.token) {
    next('/login')
    return
  }
  
  if (to.meta.admin && authStore.user?.role !== 'admin') {
    next('/')
    return
  }
  
  next()
})

export default router
