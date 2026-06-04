const WebSocket = require('ws');
const http = require('http');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map();
    this.heartRateSubscriptions = new Map();
    this.leaderboardSubscriptions = new Set();
    this.setupConnectionHandlers();
  }

  setupConnectionHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`New WebSocket connection: ${clientId}`);

      this.clients.set(clientId, {
        ws,
        deviceId: null,
        subscriptions: new Set(),
        createdAt: Date.now()
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Invalid message format'
          });
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket disconnected: ${clientId}`);
        this.cleanupClient(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.cleanupClient(clientId);
      });

      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        message: 'Connected to Smart Band WebSocket server'
      });
    });
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'auth':
        client.deviceId = message.deviceId;
        this.sendToClient(clientId, {
          type: 'authenticated',
          deviceId: message.deviceId
        });
        break;

      case 'subscribe_heartrate':
        client.subscriptions.add('heartrate');
        if (message.deviceId) {
          client.deviceId = message.deviceId;
          if (!this.heartRateSubscriptions.has(message.deviceId)) {
            this.heartRateSubscriptions.set(message.deviceId, new Set());
          }
          this.heartRateSubscriptions.get(message.deviceId).add(clientId);
        }
        this.sendToClient(clientId, {
          type: 'subscribed',
          channel: 'heartrate',
          deviceId: message.deviceId
        });
        break;

      case 'unsubscribe_heartrate':
        client.subscriptions.delete('heartrate');
        if (client.deviceId && this.heartRateSubscriptions.has(client.deviceId)) {
          this.heartRateSubscriptions.get(client.deviceId).delete(clientId);
        }
        this.sendToClient(clientId, {
          type: 'unsubscribed',
          channel: 'heartrate'
        });
        break;

      case 'subscribe_leaderboard':
        client.subscriptions.add('leaderboard');
        this.leaderboardSubscriptions.add(clientId);
        this.sendToClient(clientId, {
          type: 'subscribed',
          channel: 'leaderboard'
        });
        break;

      case 'unsubscribe_leaderboard':
        client.subscriptions.delete('leaderboard');
        this.leaderboardSubscriptions.delete(clientId);
        this.sendToClient(clientId, {
          type: 'unsubscribed',
          channel: 'leaderboard'
        });
        break;

      case 'heartrate_data':
        this.broadcastHeartRate(message.deviceId || client.deviceId, message.data);
        break;

      case 'activity_data':
        this.broadcastActivity(message.deviceId || client.deviceId, message.data);
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendToClient(clientId, {
          type: 'error',
          message: `Unknown message type: ${message.type}`
        });
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcastHeartRate(deviceId, data) {
    const subscribers = this.heartRateSubscriptions.get(deviceId);
    if (!subscribers) return;

    const message = {
      type: 'heartrate_update',
      deviceId,
      data: {
        value: data.value,
        timestamp: data.timestamp || Date.now(),
        filtered: data.filtered || false,
        confidence: data.confidence || 1.0
      }
    };

    subscribers.forEach(clientId => {
      this.sendToClient(clientId, message);
    });
  }

  broadcastActivity(deviceId, data) {
    const subscribers = this.heartRateSubscriptions.get(deviceId);
    if (!subscribers) return;

    const message = {
      type: 'activity_update',
      deviceId,
      data: {
        activityType: data.activityType,
        confidence: data.confidence,
        steps: data.steps,
        heartRate: data.heartRate,
        accelerometer: data.accelerometer,
        timestamp: data.timestamp || Date.now()
      }
    };

    subscribers.forEach(clientId => {
      this.sendToClient(clientId, message);
    });
  }

  broadcastLeaderboardUpdate(leaderboard) {
    const message = {
      type: 'leaderboard_update',
      data: leaderboard,
      timestamp: Date.now()
    };

    this.leaderboardSubscriptions.forEach(clientId => {
      this.sendToClient(clientId, message);
    });
  }

  broadcastStepsUpdate(deviceId, steps, userName) {
    const message = {
      type: 'steps_update',
      deviceId,
      userName,
      steps,
      timestamp: Date.now()
    };

    this.leaderboardSubscriptions.forEach(clientId => {
      this.sendToClient(clientId, message);
    });
  }

  cleanupClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.deviceId && this.heartRateSubscriptions.has(client.deviceId)) {
      this.heartRateSubscriptions.get(client.deviceId).delete(clientId);
    }

    this.leaderboardSubscriptions.delete(clientId);
    this.clients.delete(clientId);
  }

  getConnectedClients() {
    return {
      total: this.clients.size,
      heartRateSubscriptions: this.heartRateSubscriptions.size,
      leaderboardSubscriptions: this.leaderboardSubscriptions.size
    };
  }

  close() {
    this.wss.close();
  }
}

let webSocketService = null;

const initWebSocketService = (server) => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
  }
  return webSocketService;
};

const getWebSocketService = () => {
  return webSocketService;
};

module.exports = {
  initWebSocketService,
  getWebSocketService
};
