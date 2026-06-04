const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const { calculateCalories } = require('../services/exportService');

router.post('/calories', async (req, res) => {
  try {
    const { deviceId, weight, age, start, stop } = req.body;
    const stepsData = await dataService.queryStepsByRange(
      deviceId,
      start || '-7d',
      stop || 'now()'
    );

    const analysis = stepsData.map(day => ({
      date: day.date,
      steps: day.steps,
      calories: calculateCalories(day.steps, weight, age)
    }));

    const totalSteps = stepsData.reduce((sum, d) => sum + d.steps, 0);
    const totalCalories = calculateCalories(totalSteps, weight, age);

    res.json({
      success: true,
      data: analysis,
      summary: {
        totalSteps,
        totalCalories,
        avgDailyCalories: analysis.length ? totalCalories / analysis.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/goal', async (req, res) => {
  try {
    const { deviceId, dailyGoal = 10000 } = req.body;
    const stepsData = await dataService.queryStepsByRange(deviceId, '-7d', 'now()');

    const goalProgress = stepsData.map(day => ({
      date: day.date,
      steps: day.steps,
      goal: dailyGoal,
      completion: Math.min(100, Math.round((day.steps / dailyGoal) * 100)),
      achieved: day.steps >= dailyGoal
    }));

    const achievedDays = goalProgress.filter(d => d.achieved).length;

    res.json({
      success: true,
      data: goalProgress,
      summary: {
        totalDays: goalProgress.length,
        achievedDays,
        achievementRate: goalProgress.length ? Math.round((achievedDays / goalProgress.length) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/heartrate/zones', async (req, res) => {
  try {
    const { deviceId, start, stop } = req.query;
    const heartRateData = await dataService.queryHeartRateByRange(
      deviceId,
      start || '-7d',
      stop || 'now()'
    );

    const zones = {
      rest: { min: 0, max: 60, count: 0, label: '休息' },
      light: { min: 60, max: 100, count: 0, label: '轻度活动' },
      moderate: { min: 100, max: 140, count: 0, label: '中等强度' },
      vigorous: { min: 140, max: 170, count: 0, label: '高强度' },
      peak: { min: 170, max: 220, count: 0, label: '极限' }
    };

    heartRateData.forEach(item => {
      const hr = item.heartRate;
      if (hr < 60) zones.rest.count++;
      else if (hr < 100) zones.light.count++;
      else if (hr < 140) zones.moderate.count++;
      else if (hr < 170) zones.vigorous.count++;
      else zones.peak.count++;
    });

    const total = heartRateData.length;
    const result = Object.entries(zones).map(([key, zone]) => ({
      zone: key,
      label: zone.label,
      count: zone.count,
      percentage: total ? Math.round((zone.count / total) * 100) : 0
    }));

    res.json({
      success: true,
      data: result,
      totalReadings: total
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
