import { createRouter, createWebHistory } from 'vue-router'
import MonitorPage from '@/pages/MonitorPage.vue'
import AlertsPage from '@/pages/AlertsPage.vue'
import ReplayPage from '@/pages/ReplayPage.vue'

const routes = [
  {
    path: '/',
    name: 'monitor',
    component: MonitorPage,
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: AlertsPage,
  },
  {
    path: '/replay',
    name: 'replay',
    component: ReplayPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
