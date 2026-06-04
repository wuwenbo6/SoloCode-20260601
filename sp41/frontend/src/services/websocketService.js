class WebSocketClient {
  constructor() {
    this.ws = null;
    this.url = 'ws://localhost:3001/ws';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.heartbeatInterval = null;
    this.isConnected = false;
    this.clientId = null;

    this.onHeartRateCallback = null;
    this.onActivityCallback = null;
    this.onLeaderboardCallback = null;
    this.onStepsUpdateCallback = null;
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
    this.onErrorCallback = null;
  }

  connect(deviceId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();

          if (deviceId) {
            this.send({ type: 'auth', deviceId });
          }

          if (this.onConnectCallback) {
            this.onConnectCallback();
          }

          resolve({ success: true });
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();

          if (this.onDisconnectCallback) {
            this.onDisconnectCallback(event);
          }

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
              this.connect(deviceId);
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        reject(error);
      }
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        break;

      case 'authenticated':
        console.log('WebSocket authenticated');
        break;

      case 'subscribed':
        console.log(`Subscribed to ${message.channel}`);
        break;

      case 'unsubscribed':
        console.log(`Unsubscribed from ${message.channel}`);
        break;

      case 'heartrate_update':
        if (this.onHeartRateCallback) {
          this.onHeartRateCallback(message);
        }
        break;

      case 'activity_update':
        if (this.onActivityCallback) {
          this.onActivityCallback(message);
        }
        break;

      case 'leaderboard_update':
        if (this.onLeaderboardCallback) {
          this.onLeaderboardCallback(message);
        }
        break;

      case 'steps_update':
        if (this.onStepsUpdateCallback) {
          this.onStepsUpdateCallback(message);
        }
        break;

      case 'pong':
        break;

      case 'error':
        console.error('WebSocket error message:', message.message);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error(message.message));
        }
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket is not connected, cannot send message');
    return false;
  }

  subscribeHeartRate(deviceId) {
    return this.send({ type: 'subscribe_heartrate', deviceId });
  }

  unsubscribeHeartRate() {
    return this.send({ type: 'unsubscribe_heartrate' });
  }

  subscribeLeaderboard() {
    return this.send({ type: 'subscribe_leaderboard' });
  }

  unsubscribeLeaderboard() {
    return this.send({ type: 'unsubscribe_leaderboard' });
  }

  sendHeartRateData(deviceId, data) {
    return this.send({
      type: 'heartrate_data',
      deviceId,
      data
    });
  }

  sendActivityData(deviceId, data) {
    return this.send({
      type: 'activity_data',
      deviceId,
      data
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.clientId = null;
  }

  setOnHeartRateCallback(callback) {
    this.onHeartRateCallback = callback;
  }

  setOnActivityCallback(callback) {
    this.onActivityCallback = callback;
  }

  setOnLeaderboardCallback(callback) {
    this.onLeaderboardCallback = callback;
  }

  setOnStepsUpdateCallback(callback) {
    this.onStepsUpdateCallback = callback;
  }

  setOnConnectCallback(callback) {
    this.onConnectCallback = callback;
  }

  setOnDisconnectCallback(callback) {
    this.onDisconnectCallback = callback;
  }

  setOnErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  isConnectedToServer() {
    return this.isConnected;
  }

  getClientId() {
    return this.clientId;
  }
}

const webSocketClient = new WebSocketClient();
export default webSocketClient;
