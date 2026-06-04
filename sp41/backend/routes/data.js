const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');

router.post('/steps', async (req, res) => {
  try {
    const { deviceId, steps, timestamp } = req.body;
    await dataService.writeSteps(deviceId, steps, timestamp ? new Date(timestamp) : new Date());
    res.json({ success: true, message: 'Steps data saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/heartrate', async (req, res) => {
  try {
    const { deviceId, heartRate, timestamp } = req.body;
    await dataService.writeHeartRate(deviceId, heartRate, timestamp ? new Date(timestamp) : new Date());
    res.json({ success: true, message: 'Heart rate data saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sleep', async (req, res) => {
  try {
    const { deviceId, stage, duration, timestamp } = req.body;
    await dataService.writeSleep(deviceId, stage, duration, timestamp ? new Date(timestamp) : new Date());
    res.json({ success: true, message: 'Sleep data saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { deviceId, data } = req.body;
    for (const item of data) {
      const timestamp = item.timestamp ? new Date(item.timestamp) : new Date();
      if (item.type === 'steps') {
        await dataService.writeSteps(deviceId, item.value, timestamp);
      } else if (item.type === 'heartRate') {
        await dataService.writeHeartRate(deviceId, item.value, timestamp);
      } else if (item.type === 'sleep') {
        await dataService.writeSleep(deviceId, item.stage, item.duration, timestamp);
      }
    }
    res.json({ success: true, message: 'Batch data saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/steps', async (req, res) => {
  try {
    const { deviceId, start, stop } = req.query;
    const data = await dataService.queryStepsByRange(deviceId, start || '-7d', stop || 'now()');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/heartrate', async (req, res) => {
  try {
    const { deviceId, start, stop } = req.query;
    const data = await dataService.queryHeartRateByRange(deviceId, start || '-7d', stop || 'now()');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sleep', async (req, res) => {
  try {
    const { deviceId, start, stop } = req.query;
    const data = await dataService.querySleepByRange(deviceId, start || '-7d', stop || 'now()');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const data = await dataService.getLatestData(deviceId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
