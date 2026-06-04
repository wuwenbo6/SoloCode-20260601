import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getConfig = () => api.get('/config').then(res => res.data);
export const getExhibits = () => api.get('/exhibits').then(res => res.data);
export const getHotspots = () => api.get('/hotspots').then(res => res.data);
export const getNavmesh = () => api.get('/navmesh').then(res => res.data);

export default api;
