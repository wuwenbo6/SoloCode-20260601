const express = require('express');
const router = express.Router();
const { leaderboardService } = require('../services/leaderboardService');

router.get('/', (req, res) => {
  try {
    const { limit = 20, deviceId } = req.query;
    const leaderboard = leaderboardService.getLeaderboard(parseInt(limit));

    if (deviceId) {
      const myRank = leaderboard.rankings.findIndex(r => r.deviceId === deviceId);
      if (myRank >= 0) {
        leaderboard.rankings[myRank].isCurrentUser = true;
        leaderboard.myRank = myRank + 1;
      }
    }

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rank/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const rank = leaderboardService.getFriendRank(deviceId);

    if (!rank) {
      return res.status(404).json({
        success: false,
        message: 'User not found in leaderboard'
      });
    }

    res.json({
      success: true,
      data: rank
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/compare', (req, res) => {
  try {
    const { currentDeviceId, friendDeviceId } = req.query;

    if (!currentDeviceId || !friendDeviceId) {
      return res.status(400).json({
        success: false,
        message: 'Both currentDeviceId and friendDeviceId are required'
      });
    }

    const comparison = leaderboardService.compareWithFriend(currentDeviceId, friendDeviceId);

    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: 'One or both users not found'
      });
    }

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/friends', (req, res) => {
  try {
    const friends = leaderboardService.getFriendsList();
    res.json({
      success: true,
      data: friends
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/friends', (req, res) => {
  try {
    const { deviceId, userName, avatar } = req.body;

    if (!deviceId || !userName) {
      return res.status(400).json({
        success: false,
        message: 'deviceId and userName are required'
      });
    }

    const result = leaderboardService.addFriend(deviceId, userName, avatar);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/friends/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = leaderboardService.removeFriend(deviceId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/steps', async (req, res) => {
  try {
    const { deviceId, steps, userName } = req.body;

    if (!deviceId || steps === undefined) {
      return res.status(400).json({
        success: false,
        message: 'deviceId and steps are required'
      });
    }

    const newSteps = await leaderboardService.updateSteps(deviceId, parseInt(steps), userName);

    res.json({
      success: true,
      data: {
        deviceId,
        totalSteps: newSteps,
        addedSteps: parseInt(steps)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/historical', async (req, res) => {
  try {
    const { start, end } = req.query;
    const result = await leaderboardService.getHistoricalLeaderboard(
      start || '-7d',
      end || 'now()'
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset', (req, res) => {
  try {
    leaderboardService.resetDailyData();
    res.json({
      success: true,
      message: 'Daily leaderboard data reset'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
