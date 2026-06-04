import request from './request'

export function getUserStats(days = 7) {
  return request({
    url: '/audit/stats/users',
    method: 'get',
    params: { days }
  })
}

export function getServerStats(days = 7) {
  return request({
    url: '/audit/stats/servers',
    method: 'get',
    params: { days }
  })
}

export function getDailyStats(days = 7) {
  return request({
    url: '/audit/stats/daily',
    method: 'get',
    params: { days }
  })
}

export function getBlockedCommands(limit = 100) {
  return request({
    url: '/audit/blocked',
    method: 'get',
    params: { limit }
  })
}

export function getUserCommands(userId, limit = 100) {
  return request({
    url: `/audit/users/${userId}/commands`,
    method: 'get',
    params: { limit }
  })
}

export function getSessionCommands(sessionId) {
  return request({
    url: `/audit/sessions/${sessionId}/commands`,
    method: 'get'
  })
}

export function getAuditReport(days = 30) {
  return request({
    url: '/audit/report',
    method: 'get',
    params: { days }
  })
}
