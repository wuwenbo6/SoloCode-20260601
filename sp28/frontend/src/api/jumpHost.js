import request from './request'

export function getJumpHosts() {
  return request({
    url: '/jump-hosts',
    method: 'get'
  })
}

export function getJumpHost(id) {
  return request({
    url: `/jump-hosts/${id}`,
    method: 'get'
  })
}

export function createJumpHost(data) {
  return request({
    url: '/jump-hosts',
    method: 'post',
    data
  })
}

export function updateJumpHost(id, data) {
  return request({
    url: `/jump-hosts/${id}`,
    method: 'put',
    data
  })
}

export function deleteJumpHost(id) {
  return request({
    url: `/jump-hosts/${id}`,
    method: 'delete'
  })
}
