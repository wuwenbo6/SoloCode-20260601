import request from './request'

export function getServers() {
  return request.get('/servers')
}

export function getServer(id) {
  return request.get(`/servers/${id}`)
}

export function createServer(data) {
  return request.post('/servers', data)
}

export function updateServer(id, data) {
  return request.put(`/servers/${id}`, data)
}

export function deleteServer(id) {
  return request.delete(`/servers/${id}`)
}
