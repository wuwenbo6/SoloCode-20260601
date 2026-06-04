require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const dataRoutes = require('./routes/data');
const analysisRoutes = require('./routes/analysis');
const exportRoutes = require('./routes/export');
const realtimeRoutes = require('./routes/realtime');
const leaderboardRoutes = require('./routes/leaderboard');

const { initWebSocketService } = require('./services/websocketService');

const app = express();
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
initWebSocketService(server);

app.use(cors());
app.use(express.json());

app.use('/api/data', dataRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Band Backend is running' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  console.log(``);
  console.log(`REST API endpoints:`);
  console.log(`  POST /api/data/steps`);
  console.log(`  POST /api/data/heartrate`);
  console.log(`  POST /api/data/sleep`);
  console.log(`  POST /api/data/batch`);
  console.log(`  GET  /api/data/steps`);
  console.log(`  GET  /api/data/heartrate`);
  console.log(`  GET  /api/data/sleep`);
  console.log(`  GET  /api/data/latest`);
  console.log(`  POST /api/analysis/calories`);
  console.log(`  POST /api/analysis/goal`);
  console.log(`  GET  /api/analysis/heartrate/zones`);
  console.log(`  GET  /api/export/csv`);
  console.log(`  POST /api/export/pdf`);
  console.log(``);
  console.log(`Realtime API endpoints:`);
  console.log(`  POST /api/realtime/heartrate`);
  console.log(`  POST /api/realtime/activity`);
  console.log(`  GET  /api/realtime/activity/current`);
  console.log(`  GET  /api/realtime/activity/stats`);
  console.log(`  GET  /api/realtime/activity/types`);
  console.log(`  GET  /api/realtime/status`);
  console.log(``);
  console.log(`Leaderboard API endpoints:`);
  console.log(`  GET  /api/leaderboard`);
  console.log(`  GET  /api/leaderboard/rank/:deviceId`);
  console.log(`  GET  /api/leaderboard/compare`);
  console.log(`  GET  /api/leaderboard/friends`);
  console.log(`  POST /api/leaderboard/friends`);
  console.log(`  POST /api/leaderboard/steps`);
  console.log(`  GET  /api/leaderboard/historical`);
  console.log(``);
  console.log(`WebSocket events:`);
  console.log(`  heartrate_update - Real-time heart rate data`);
  console.log(`  activity_update - Activity recognition data`);
  console.log(`  leaderboard_update - Leaderboard updates`);
  console.log(`  steps_update - Individual steps updates`);
});
