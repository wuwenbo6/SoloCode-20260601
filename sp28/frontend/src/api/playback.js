import request from './request'

export function getRecordings() {
  return request.get('/playback')
}

export function getRecordingInfo(id) {
  return request.get(`/playback/${id}/info`)
}

export function getPlaybackFrames(id, speed = 1.0) {
  return request.get(`/playback/${id}/speed?speed=${speed}`)
}

export function getPlaybackFramesRaw(id) {
  return request.get(`/playback/${id}`)
}
