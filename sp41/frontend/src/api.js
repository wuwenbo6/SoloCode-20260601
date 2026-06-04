import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const dataApi = {
  sendSteps: (deviceId, steps, timestamp) =>
    api.post('/data/steps', { deviceId, steps, timestamp }),

  sendHeartRate: (deviceId, heartRate, timestamp) =>
    api.post('/data/heartrate', { deviceId, heartRate, timestamp }),

  sendSleep: (deviceId, stage, duration, timestamp) =>
    api.post('/data/sleep', { deviceId, stage, duration, timestamp }),

  sendBatch: (deviceId, data) =>
    api.post('/data/batch', { deviceId, data }),

  getSteps: (deviceId, start, stop) =>
    api.get('/data/steps', { params: { deviceId, start, stop } }),

  getHeartRate: (deviceId, start, stop) =>
    api.get('/data/heartrate', { params: { deviceId, start, stop } }),

  getSleep: (deviceId, start, stop) =>
    api.get('/data/sleep', { params: { deviceId, start, stop } }),

  getLatest: (deviceId) =>
    api.get('/data/latest', { params: { deviceId } }),
};

export const analysisApi = {
  getCalories: (deviceId, weight, age, start, stop) =>
    api.post('/analysis/calories', { deviceId, weight, age, start, stop }),

  getGoalProgress: (deviceId, dailyGoal) =>
    api.post('/analysis/goal', { deviceId, dailyGoal }),

  getHeartRateZones: (deviceId, start, stop) =>
    api.get('/analysis/heartrate/zones', { params: { deviceId, start, stop } }),
};

export const exportApi = {
  exportCSV: (deviceId, start, stop) =>
    api.get(`/export/csv?deviceId=${deviceId}&start=${start || '-7d'}&stop=${stop || 'now()'}`, {
      responseType: 'blob',
    }),

  exportPDF: (deviceId, start, stop, userProfile) =>
    api.post('/export/pdf', { deviceId, start, stop, userProfile }, {
      responseType: 'blob',
    }),
};

export const realtimeApi = {
  sendHeartRate: (deviceId, value, timestamp, filtered, confidence) =>
    api.post('/realtime/heartrate', { deviceId, value, timestamp, filtered, confidence }),

  sendActivity: (deviceId, accelerometer, heartRate, steps, timestamp) =>
    api.post('/realtime/activity', { deviceId, accelerometer, heartRate, steps, timestamp }),

  getCurrentActivity: () =>
    api.get('/realtime/activity/current'),

  getActivityStats: () =>
    api.get('/realtime/activity/stats'),

  getActivityTypes: () =>
    api.get('/realtime/activity/types'),

  getStatus: () =>
    api.get('/realtime/status'),
};

export const leaderboardApi = {
  getLeaderboard: (limit, deviceId) =>
    api.get('/leaderboard', { params: { limit, deviceId } }),

  getRank: (deviceId) =>
    api.get(`/leaderboard/rank/${deviceId}`),

  compareWithFriend: (currentDeviceId, friendDeviceId) =>
    api.get('/leaderboard/compare', { params: { currentDeviceId, friendDeviceId } }),

  getFriends: () =>
    api.get('/leaderboard/friends'),

  addFriend: (deviceId, userName, avatar) =>
    api.post('/leaderboard/friends', { deviceId, userName, avatar }),

  removeFriend: (deviceId) =>
    api.delete(`/leaderboard/friends/${deviceId}`),

  updateSteps: (deviceId, steps, userName) =>
    api.post('/leaderboard/steps', { deviceId, steps, userName }),

  getHistoricalLeaderboard: (start, end) =>
    api.get('/leaderboard/historical', { params: { start, end } }),
};

export default api;
