import request from './request'

export function getSessions() {
  return request.get('/sessions')
}

export function getMySessions() {
  return request.get('/sessions/me')
}

export function getSession(id) {
  return request.get(`/sessions/${id}`)
}

export function getActiveSessions() {
  return request.get('/ssh/active')
}
