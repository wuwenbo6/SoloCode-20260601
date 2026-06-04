import request from './request'

export function requestAccess(data) {
  return request.post('/access/request', data)
}

export function getMyGrants() {
  return request.get('/access/grants/me')
}

export function getAccessRequests(status = '') {
  return request.get(`/access/requests?status=${status}`)
}

export function approveRequest(id) {
  return request.post(`/access/requests/${id}/approve`)
}

export function rejectRequest(id) {
  return request.post(`/access/requests/${id}/reject`)
}
