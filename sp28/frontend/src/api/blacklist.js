import request from './request'

export function getBlacklistRules() {
  return request({
    url: '/blacklist',
    method: 'get'
  })
}

export function getBlacklistRule(id) {
  return request({
    url: `/blacklist/${id}`,
    method: 'get'
  })
}

export function createBlacklistRule(data) {
  return request({
    url: '/blacklist',
    method: 'post',
    data
  })
}

export function updateBlacklistRule(id, data) {
  return request({
    url: `/blacklist/${id}`,
    method: 'put',
    data
  })
}

export function deleteBlacklistRule(id) {
  return request({
    url: `/blacklist/${id}`,
    method: 'delete'
  })
}

export function refreshBlacklistPatterns() {
  return request({
    url: '/blacklist/refresh',
    method: 'post'
  })
}
