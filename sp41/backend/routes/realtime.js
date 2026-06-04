const express = require('express');
const router = express.Router();
const { activityRecognitionService, ACTIVITY_TYPES, ACTIVITY_LABELS_CN } = require('../services/activityRecognitionService');
const { getWebSocketService } = require('../services/websocketService');

router.post('/heartrate', async (req, res) => {
  try {
    const { deviceId, value, timestamp, filtered, confidence } = req.body;

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.broadcastHeartRate(deviceId, {
        value,
        timestamp: timestamp || Date.now(),
        filtered: filtered || false,
        confidence: confidence || 1.0
      });
    }

    res.json({
      success: true,
      message: 'Heart rate data broadcasted',
      data: { deviceId, value, timestamp }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/activity', async (req, res) => {
  try {
    const { deviceId, accelerometer, heartRate, steps, stepsDelta, timestamp } = req.body;

    const result = activityRecognitionService.recognizeActivity({
      accelerometer,
      heartRate,
      steps,
      stepsDelta,
      timestamp: timestamp || Date.now()
    });

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.broadcastActivity(deviceId, {
        activityType: result.activityType,
        confidence: result.confidence,
        steps,
        heartRate,
        accelerometer,
        timestamp: timestamp || Date.now()
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activity/current', (req, res) => {
  try {
    const currentActivity = activityRecognitionService.getCurrentActivity();
    res.json({
      success: true,
      data: currentActivity
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activity/stats', (req, res) => {
  try {
    const stats = activityRecognitionService.getActivityStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/activity/reset', (req, res) => {
  try {
    activityRecognitionService.reset();
    res.json({
      success: true,
      message: 'Activity recognition reset'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activity/types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: ACTIVITY_TYPES,
      labels: ACTIVITY_LABELS_CN
    }
  });
});

router.get('/status', (req, res) => {
  const wsService = getWebSocketService();
  const stats = wsService ? wsService.getConnectedClients() : { total: 0 };

  res.json({
    success: true,
    data: {
      websocket: {
        connected: wsService !== null,
        ...stats
      },
      activityRecognition: {
        currentActivity: activityRecognitionService.getCurrentActivity()
      }
    }
  });
});

module.exports = router;
