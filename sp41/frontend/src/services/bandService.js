import filterService from './filterService';
import webSocketClient from './websocketService';
import { realtimeApi, leaderboardApi } from '../api';

const SIMULATED_ACTIVITIES = ['resting', 'walking', 'running', 'cycling', 'swimming'];

class SmartBandService {
  constructor() {
    this.device = null;
    this.connected = false;
    this.connectionType = null;
    this.onDataCallback = null;
    this.simulationInterval = null;
    this.heartRateInterval = null;
    this.activityInterval = null;
    this.enableFiltering = true;
    this.simulateAnomalies = false;
    this.continuousHeartRateMode = false;
    this.currentActivity = 'resting';
    this.activityChangeTime = Date.now();
    this.deviceId = null;
    this.userName = null;
    this.totalSteps = 0;
    this.lastStepsUpdate = 0;
  }

  setOnDataCallback(callback) {
    this.onDataCallback = callback;
  }

  setFilteringEnabled(enabled) {
    this.enableFiltering = enabled;
    if (enabled) {
      filterService.resetFilters();
    }
  }

  setSimulateAnomalies(enabled) {
    this.simulateAnomalies = enabled;
  }

  setDeviceInfo(deviceId, userName) {
    this.deviceId = deviceId;
    this.userName = userName;
  }

  async connectWebUSB() {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB not supported');
      }

      const devices = await navigator.usb.getDevices();
      if (devices.length === 0) {
        this.device = await navigator.usb.requestDevice({
          filters: [{ vendorId: 0x2717 }]
        });
      } else {
        this.device = devices[0];
      }

      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);

      this.connected = true;
      this.connectionType = 'webusb';
      this.startDataStreaming();
      this.connectWebSocket();

      return { success: true, type: 'webusb', device: this.device.productName };
    } catch (error) {
      console.error('WebUSB connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  async connectWebHID() {
    try {
      if (!navigator.hid) {
        throw new Error('WebHID not supported');
      }

      const devices = await navigator.hid.getDevices();
      if (devices.length === 0) {
        const [device] = await navigator.hid.requestDevice({
          filters: [{ vendorId: 0x2717 }]
        });
        this.device = device;
      } else {
        this.device = devices[0];
      }

      await this.device.open();

      this.device.oninputreport = (event) => {
        this.handleHIDData(event.data);
      };

      this.connected = true;
      this.connectionType = 'webhid';
      this.startDataStreaming();
      this.connectWebSocket();

      return { success: true, type: 'webhid', device: this.device.productName };
    } catch (error) {
      console.error('WebHID connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  connectSimulator() {
    this.connected = true;
    this.connectionType = 'simulator';
    this.startDataStreaming();
    this.connectWebSocket();
    return { success: true, type: 'simulator', device: 'Smart Band Simulator' };
  }

  async connectWebSocket() {
    if (this.deviceId) {
      await webSocketClient.connect(this.deviceId);
    }
  }

  setContinuousHeartRateMode(enabled) {
    this.continuousHeartRateMode = enabled;

    if (enabled) {
      this.startContinuousHeartRateMonitoring();
    } else {
      this.stopContinuousHeartRateMonitoring();
    }
  }

  startDataStreaming() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }

    this.simulationInterval = setInterval(() => {
      const data = this.generateSimulatedData();
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    }, 5000);
  }

  startContinuousHeartRateMonitoring() {
    if (this.heartRateInterval) {
      clearInterval(this.heartRateInterval);
    }

    this.heartRateInterval = setInterval(() => {
      const heartRateData = this.generateHeartRateData();
      this.sendHeartRateToWebSocket(heartRateData);
    }, 1000);

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    this.activityInterval = setInterval(() => {
      this.maybeChangeActivity();
      const activityData = this.generateActivityData();
      this.sendActivityToWebSocket(activityData);
    }, 2000);
  }

  stopContinuousHeartRateMonitoring() {
    if (this.heartRateInterval) {
      clearInterval(this.heartRateInterval);
      this.heartRateInterval = null;
    }

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  maybeChangeActivity() {
    const now = Date.now();
    const activityDuration = now - this.activityChangeTime;
    const minDuration = 30000;

    if (activityDuration > minDuration && Math.random() < 0.1) {
      const currentIndex = SIMULATED_ACTIVITIES.indexOf(this.currentActivity);
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * SIMULATED_ACTIVITIES.length);
      } while (newIndex === currentIndex);

      this.currentActivity = SIMULATED_ACTIVITIES[newIndex];
      this.activityChangeTime = now;
      console.log(`Activity changed to: ${this.currentActivity}`);
    }
  }

  generateHeartRateData() {
    const now = Date.now();
    let baseHeartRate = 70;

    switch (this.currentActivity) {
      case 'resting':
        baseHeartRate = 55 + Math.random() * 15;
        break;
      case 'walking':
        baseHeartRate = 80 + Math.random() * 20;
        break;
      case 'running':
        baseHeartRate = 130 + Math.random() * 40;
        break;
      case 'cycling':
        baseHeartRate = 110 + Math.random() * 30;
        break;
      case 'swimming':
        baseHeartRate = 120 + Math.random() * 35;
        break;
      default:
        baseHeartRate = 70 + Math.random() * 30;
    }

    let heartRate = Math.round(baseHeartRate);

    if (this.simulateAnomalies && Math.random() < 0.05) {
      const anomalyType = Math.random();
      if (anomalyType < 0.3) {
        heartRate = 300;
      } else if (anomalyType < 0.5) {
        heartRate = 5;
      } else {
        heartRate = heartRate + 80;
      }
    }

    const rawValue = heartRate;
    let filtered = false;
    let filteredValue = heartRate;

    if (this.enableFiltering) {
      const result = filterService.filterHeartRate(heartRate);
      if (result === null) {
        filtered = true;
      } else {
        filteredValue = result;
        filtered = result !== heartRate;
      }
    }

    return {
      value: filteredValue,
      rawValue,
      filtered,
      timestamp: now
    };
  }

  generateActivityData() {
    const now = Date.now();
    let accelerometer = { x: 0, y: 0, z: -1 };
    let heartRate = 70;
    let steps = 0;

    switch (this.currentActivity) {
      case 'running':
        accelerometer = {
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2,
          z: Math.random() * 2 - 1
        };
        heartRate = 140 + Math.floor(Math.random() * 30);
        steps = 35 + Math.floor(Math.random() * 20);
        break;
      case 'cycling':
        accelerometer = {
          x: Math.random() * 2 - 1,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 1 - 0.5
        };
        heartRate = 120 + Math.floor(Math.random() * 20);
        steps = 0;
        break;
      case 'swimming':
        accelerometer = {
          x: Math.random() * 1.5 - 0.75,
          y: Math.random() * 2 - 1,
          z: -0.8 + Math.random() * 0.6
        };
        heartRate = 130 + Math.floor(Math.random() * 25);
        steps = 0;
        break;
      case 'walking':
        accelerometer = {
          x: Math.random() * 1.5 - 0.75,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 0.5 - 0.25
        };
        heartRate = 90 + Math.floor(Math.random() * 15);
        steps = 15 + Math.floor(Math.random() * 10);
        break;
      case 'resting':
      default:
        accelerometer = {
          x: Math.random() * 0.1 - 0.05,
          y: Math.random() * 0.1 - 0.05,
          z: -1 + Math.random() * 0.1 - 0.05
        };
        heartRate = 60 + Math.floor(Math.random() * 10);
        steps = 0;
    }

    if (steps > 0) {
      this.totalSteps += steps;
      const nowMs = Date.now();
      if (nowMs - this.lastStepsUpdate > 10000) {
        this.updateLeaderboardSteps();
        this.lastStepsUpdate = nowMs;
      }
    }

    return {
      accelerometer,
      heartRate,
      steps,
      activityType: this.currentActivity,
      timestamp: now
    };
  }

  async updateLeaderboardSteps() {
    if (!this.deviceId || this.totalSteps <= 0) return;

    try {
      await leaderboardApi.updateSteps(this.deviceId, this.totalSteps, this.userName);
    } catch (error) {
      console.error('Update leaderboard steps error:', error);
    }
  }

  async sendHeartRateToWebSocket(data) {
    if (!this.deviceId || !webSocketClient.isConnectedToServer()) return;

    try {
      await realtimeApi.sendHeartRate(
        this.deviceId,
        data.value,
        data.timestamp,
        data.filtered,
        0.95
      );
    } catch (error) {
      console.error('Send heart rate error:', error);
    }
  }

  async sendActivityToWebSocket(data) {
    if (!this.deviceId || !webSocketClient.isConnectedToServer()) return;

    try {
      await realtimeApi.sendActivity(
        this.deviceId,
        data.accelerometer,
        data.heartRate,
        data.steps,
        data.timestamp
      );
    } catch (error) {
      console.error('Send activity error:', error);
    }
  }

  generateSimulatedData() {
    const now = new Date();
    const baseSteps = Math.floor(Math.random() * 50) + 10;
    let heartRate = Math.floor(Math.random() * 40) + 60;

    if (this.simulateAnomalies && Math.random() < 0.1) {
      const anomalyType = Math.random();
      if (anomalyType < 0.3) {
        heartRate = 300;
      } else if (anomalyType < 0.5) {
        heartRate = 5;
      } else {
        heartRate = heartRate + 100;
      }
    }

    const sleepStage = ['awake', 'light', 'deep', 'rem'][Math.floor(Math.random() * 4)];

    let data = {
      timestamp: now.toISOString(),
      steps: baseSteps,
      heartRateRaw: heartRate,
      sleep: {
        stage: sleepStage,
        duration: Math.random() * 0.5
      },
      activity: this.currentActivity,
      accelerometer: this.generateActivityData().accelerometer
    };

    if (this.enableFiltering) {
      const filteredHR = filterService.filterHeartRate(heartRate);
      if (filteredHR !== null) {
        data.heartRate = filteredHR;
        data.filtered = heartRate !== filteredHR;
      } else {
        data.heartRate = null;
        data.filtered = true;
        data.filterReason = 'anomaly_detected';
      }
    } else {
      data.heartRate = heartRate;
    }

    return data;
  }

  handleHIDData(data) {
    const uint8Data = new Uint8Array(data.buffer);
    console.log('HID Data received:', uint8Data);

    let parsedData = this.parseMiBandData(uint8Data);
    if (!parsedData) return;

    if (this.enableFiltering && parsedData.heartRate) {
      const filteredHR = filterService.filterHeartRate(parsedData.heartRate);
      if (filteredHR !== null) {
        parsedData.heartRateRaw = parsedData.heartRate;
        parsedData.heartRate = filteredHR;
        parsedData.filtered = parsedData.heartRateRaw !== filteredHR;
      } else {
        parsedData.heartRateRaw = parsedData.heartRate;
        parsedData.heartRate = null;
        parsedData.filtered = true;
        parsedData.filterReason = 'anomaly_detected';
      }
    }

    if (this.onDataCallback) {
      this.onDataCallback(parsedData);
    }

    if (this.continuousHeartRateMode && parsedData.heartRate) {
      this.sendHeartRateToWebSocket({
        value: parsedData.heartRate,
        rawValue: parsedData.heartRateRaw,
        filtered: parsedData.filtered,
        timestamp: Date.now()
      });
    }
  }

  parseMiBandData(data) {
    if (data.length < 4) return null;

    return {
      timestamp: new Date().toISOString(),
      steps: data[1] | (data[2] << 8),
      heartRate: data[3],
      sleep: {
        stage: data[4] === 1 ? 'deep' : 'light',
        duration: data[5] / 60
      }
    };
  }

  async disconnect() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.heartRateInterval) {
      clearInterval(this.heartRateInterval);
      this.heartRateInterval = null;
    }

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }

    if (this.connectionType === 'webusb' && this.device) {
      await this.device.close();
    } else if (this.connectionType === 'webhid' && this.device) {
      await this.device.close();
    }

    webSocketClient.disconnect();
    filterService.resetFilters();

    this.device = null;
    this.connected = false;
    this.connectionType = null;
    this.continuousHeartRateMode = false;
    this.totalSteps = 0;
  }

  isConnected() {
    return this.connected;
  }

  getConnectionType() {
    return this.connectionType;
  }

  isContinuousHeartRateMode() {
    return this.continuousHeartRateMode;
  }

  getCurrentActivity() {
    return this.currentActivity;
  }

  getTotalSteps() {
    return this.totalSteps;
  }
}

const bandService = new SmartBandService();
export default bandService;
