const { writeApi, queryApi, Point, bucket, org } = require('../config/influxdb');
const { getWebSocketService } = require('./websocketService');

const MOCK_FRIENDS = [
  { deviceId: 'friend-001', userName: '张三', avatar: '👨' },
  { deviceId: 'friend-002', userName: '李四', avatar: '👩' },
  { deviceId: 'friend-003', userName: '王五', avatar: '🧑' },
  { deviceId: 'friend-004', userName: '赵六', avatar: '👨‍🦰' },
  { deviceId: 'friend-005', userName: '孙七', avatar: '👩‍🦱' },
  { deviceId: 'friend-006', userName: '周八', avatar: '👴' },
  { deviceId: 'friend-007', userName: '吴九', avatar: '👵' }
];

class LeaderboardService {
  constructor() {
    this.friends = new Map();
    this.dailySteps = new Map();
    this.lastUpdate = null;
    this.broadcastInterval = null;

    MOCK_FRIENDS.forEach(friend => {
      this.friends.set(friend.deviceId, friend);
      this.dailySteps.set(friend.deviceId, {
        steps: Math.floor(Math.random() * 5000) + 3000,
        lastUpdate: Date.now()
      });
    });

    this.startMockUpdate();
  }

  startMockUpdate() {
    setInterval(() => {
      this.friends.forEach((friend, deviceId) => {
        if (Math.random() < 0.3) {
          const steps = Math.floor(Math.random() * 200) + 50;
          this.updateSteps(deviceId, steps);
        }
      });
    }, 10000);

    this.broadcastInterval = setInterval(() => {
      const wsService = getWebSocketService();
      if (wsService) {
        const leaderboard = this.getLeaderboard();
        wsService.broadcastLeaderboardUpdate(leaderboard);
      }
    }, 30000);
  }

  async updateSteps(deviceId, steps, userName = null) {
    const existing = this.dailySteps.get(deviceId) || { steps: 0, lastUpdate: Date.now() };
    const newSteps = existing.steps + steps;
    this.dailySteps.set(deviceId, {
      steps: newSteps,
      lastUpdate: Date.now()
    });

    if (userName && !this.friends.has(deviceId)) {
      this.friends.set(deviceId, {
        deviceId,
        userName,
        avatar: '👤'
      });
    }

    const friend = this.friends.get(deviceId);
    if (friend) {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastStepsUpdate(deviceId, newSteps, friend.userName);
      }
    }

    try {
      const point = new Point('leaderboard')
        .tag('deviceId', deviceId)
        .tag('userName', friend?.userName || 'Unknown')
        .intField('steps', newSteps)
        .timestamp(new Date());
      writeApi.writePoint(point);
      await writeApi.flush();
    } catch (error) {
      console.error('Write leaderboard to InfluxDB error:', error);
    }

    this.lastUpdate = Date.now();
    return newSteps;
  }

  getLeaderboard(limit = 20) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rankings = [];

    this.friends.forEach((friend, deviceId) => {
      const stepsData = this.dailySteps.get(deviceId) || { steps: 0, lastUpdate: null };
      const lastUpdateDate = stepsData.lastUpdate ? new Date(stepsData.lastUpdate) : null;
      const isToday = lastUpdateDate && lastUpdateDate >= today;

      rankings.push({
        rank: 0,
        deviceId,
        userName: friend.userName,
        avatar: friend.avatar,
        steps: isToday ? stepsData.steps : 0,
        lastUpdate: stepsData.lastUpdate,
        isCurrentUser: false
      });
    });

    rankings.sort((a, b) => b.steps - a.steps);
    rankings.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      rankings: rankings.slice(0, limit),
      totalCount: rankings.length,
      lastUpdate: this.lastUpdate
    };
  }

  getFriendRank(deviceId) {
    const leaderboard = this.getLeaderboard();
    const friendRank = leaderboard.rankings.find(r => r.deviceId === deviceId);

    if (!friendRank) {
      return null;
    }

    const total = leaderboard.totalCount;
    const topPercent = total > 0 ? ((friendRank.rank / total) * 100).toFixed(1) : 0;

    return {
      ...friendRank,
      totalCount: total,
      topPercent: parseFloat(topPercent),
      isTop10: friendRank.rank <= 10,
      isTop5: friendRank.rank <= 5,
      isTop1: friendRank.rank === 1
    };
  }

  compareWithFriend(currentDeviceId, friendDeviceId) {
    const current = this.dailySteps.get(currentDeviceId);
    const friend = this.dailySteps.get(friendDeviceId);

    if (!current || !friend) {
      return null;
    }

    const diff = current.steps - friend.steps;
    const currentFriend = this.friends.get(currentDeviceId);
    const targetFriend = this.friends.get(friendDeviceId);

    return {
      currentUser: {
        deviceId: currentDeviceId,
        userName: currentFriend?.userName || '我',
        steps: current.steps
      },
      friend: {
        deviceId: friendDeviceId,
        userName: targetFriend?.userName || '好友',
        steps: friend.steps
      },
      difference: diff,
      winner: diff > 0 ? 'current' : (diff < 0 ? 'friend' : 'tie'),
      percentage: friend.steps > 0 ? ((current.steps / friend.steps) * 100).toFixed(1) : 0
    };
  }

  getFriendsList() {
    return Array.from(this.friends.values()).map(friend => {
      const stepsData = this.dailySteps.get(friend.deviceId) || { steps: 0 };
      return {
        ...friend,
        steps: stepsData.steps,
        lastUpdate: stepsData.lastUpdate
      };
    });
  }

  addFriend(deviceId, userName, avatar = '👤') {
    if (this.friends.has(deviceId)) {
      return { success: false, message: '好友已存在' };
    }

    this.friends.set(deviceId, { deviceId, userName, avatar });
    this.dailySteps.set(deviceId, {
      steps: 0,
      lastUpdate: Date.now()
    });

    return { success: true, message: '好友添加成功' };
  }

  removeFriend(deviceId) {
    if (!this.friends.has(deviceId)) {
      return { success: false, message: '好友不存在' };
    }

    this.friends.delete(deviceId);
    this.dailySteps.delete(deviceId);

    return { success: true, message: '好友已删除' };
  }

  async getHistoricalLeaderboard(startDate, endDate) {
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${startDate}, stop: ${endDate})
        |> filter(fn: (r) => r._measurement == "leaderboard")
        |> group(columns: ["deviceId", "userName"])
        |> sum(column: "_value")
        |> yield(name: "total_steps")
    `;

    try {
      const result = await queryApi.collectRows(fluxQuery);
      const rankings = result.map(row => ({
        deviceId: row.deviceId,
        userName: row.userName,
        steps: row._value,
        avatar: this.friends.get(row.deviceId)?.avatar || '👤'
      }));

      rankings.sort((a, b) => b.steps - a.steps);
      rankings.forEach((item, index) => {
        item.rank = index + 1;
      });

      return {
        success: true,
        rankings,
        period: { start: startDate, end: endDate }
      };
    } catch (error) {
      console.error('Get historical leaderboard error:', error);
      return { success: false, error: error.message };
    }
  }

  resetDailyData() {
    this.friends.forEach((friend, deviceId) => {
      this.dailySteps.set(deviceId, {
        steps: 0,
        lastUpdate: Date.now()
      });
    });
    this.lastUpdate = Date.now();
  }
}

const leaderboardService = new LeaderboardService();

module.exports = {
  leaderboardService
};
