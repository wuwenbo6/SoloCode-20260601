import { createServer } from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { setupSignalingServer } from './websocket/signaling.js';
import { startAutoSaveTask, stopAutoSaveTask } from './cron/autoSave.js';

const PORT = config.port || 3001;

const httpServer = createServer(app);

setupSignalingServer(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  startAutoSaveTask();
});

const shutdown = (signal: string) => {
  console.log(`${signal} signal received`);
  stopAutoSaveTask();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;