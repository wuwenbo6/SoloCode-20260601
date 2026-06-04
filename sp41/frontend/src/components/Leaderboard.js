import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import webSocketClient from '../services/websocketService';
import { leaderboardApi } from '../api';

const RANK_MEDALS = {
  1: '🥇',
  2: '🥈',
  3: '🥉'
};

const Leaderboard = ({ deviceId, userName = '我' }) => {
  const [leaderboard, setLeaderboard] = useState({ rankings: [], totalCount: 0 });
  const [myRank, setMyRank] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [compareFriend, setCompareFriend] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    webSocketClient.setOnLeaderboardCallback(handleLeaderboardUpdate);
    webSocketClient.setOnStepsUpdateCallback(handleStepsUpdate);

    loadLeaderboard();

    return () => {
      if (isLive) {
        stopLiveUpdates();
      }
    };
  }, [deviceId, selectedPeriod]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await leaderboardApi.getLeaderboard(20, deviceId);
      if (response.data.success) {
        setLeaderboard(response.data.data);
        setLastUpdate(response.data.data.lastUpdate);

        if (deviceId) {
          const rankResponse = await leaderboardApi.getRank(deviceId);
          if (rankResponse.data.success) {
            setMyRank(rankResponse.data.data);
          }
        }
      }
    } catch (error) {
      console.error('Load leaderboard error:', error);
    }
    setIsLoading(false);
  };

  const handleLeaderboardUpdate = (message) => {
    setLeaderboard(message.data);
    setLastUpdate(message.data.lastUpdate);
  };

  const handleStepsUpdate = (message) => {
    if (message.deviceId !== deviceId) {
      setLastUpdate(Date.now());
    }
  };

  const startLiveUpdates = async () => {
    if (!webSocketClient.isConnectedToServer()) {
      await webSocketClient.connect(deviceId);
    }
    webSocketClient.subscribeLeaderboard();
    setIsLive(true);
  };

  const stopLiveUpdates = () => {
    webSocketClient.unsubscribeLeaderboard();
    setIsLive(false);
  };

  const toggleLiveUpdates = () => {
    if (isLive) {
      stopLiveUpdates();
    } else {
      startLiveUpdates();
    }
  };

  const handleCompare = async (friendDeviceId) => {
    if (!deviceId || !friendDeviceId) return;

    try {
      const response = await leaderboardApi.compareWithFriend(deviceId, friendDeviceId);
      if (response.data.success) {
        setComparisonResult(response.data.data);
        setCompareFriend(friendDeviceId);
      }
    } catch (error) {
      console.error('Compare error:', error);
    }
  };

  const closeComparison = () => {
    setComparisonResult(null);
    setCompareFriend(null);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  const getRankColor = (rank, isCurrentUser) => {
    if (isCurrentUser) return '#fff7e6';
    if (rank === 1) return '#fff1e6';
    if (rank === 2) return '#fafafa';
    if (rank === 3) return '#fff7e6';
    return 'transparent';
  };

  const getRankTextColor = (rank, isCurrentUser) => {
    if (isCurrentUser) return '#fa8c16';
    if (rank === 1) return '#fa8c16';
    if (rank === 2) return '#8c8c8c';
    if (rank === 3) return '#d48806';
    return '#333';
  };

  const chartData = leaderboard.rankings.slice(0, 10).map(item => ({
    name: item.userName.length > 4 ? item.userName.slice(0, 4) + '...' : item.userName,
    steps: item.steps,
    isCurrentUser: item.deviceId === deviceId
  }));

  return (
    <div className="leaderboard-panel">
      <div className="panel-header">
        <h3>步数排行榜</h3>
        <div className="live-controls">
          <span className={`live-status ${isLive ? 'active' : ''}`}>
            {isLive ? '● 实时' : '○ 静态'}
          </span>
          <button
            onClick={toggleLiveUpdates}
            className={`btn btn-small ${isLive ? 'btn-danger' : 'btn-primary'}`}
          >
            {isLive ? '停止实时' : '开启实时'}
          </button>
        </div>
      </div>

      {myRank && (
        <div className="my-rank-card">
          <div className="my-rank-info">
            <span className="my-rank-label">我的排名</span>
            <span className="my-rank-value">#{myRank.rank}</span>
            <span className="my-rank-steps">{myRank.steps.toLocaleString()} 步</span>
          </div>
          <div className="my-rank-badges">
            {myRank.isTop1 && <span className="badge gold">👑 第1名</span>}
            {myRank.isTop5 && !myRank.isTop1 && <span className="badge silver">⭐ 前5%</span>}
            {myRank.isTop10 && !myRank.isTop5 && <span className="badge bronze">🏅 前10%</span>}
            {!myRank.isTop10 && <span className="badge">前{myRank.topPercent}%</span>}
          </div>
        </div>
      )}

      <div className="period-selector">
        {['today', 'week', 'month'].map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`btn btn-small ${selectedPeriod === period ? 'active' : ''}`}
          >
            {period === 'today' ? '今日' : period === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      <div className="leaderboard-chart">
        <h4>Top 10 排行榜</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`${value.toLocaleString()} 步`, '步数']}
            />
            <Bar dataKey="steps" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isCurrentUser ? '#fa8c16' : '#667eea'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="leaderboard-list">
        <h4>完整排行榜</h4>
        {isLoading ? (
          <p className="loading">加载中...</p>
        ) : (
          <div className="ranking-list">
            {leaderboard.rankings.map((item, index) => (
              <div
                key={item.deviceId}
                className={`ranking-item ${item.isCurrentUser ? 'current-user' : ''}`}
                style={{ backgroundColor: getRankColor(item.rank, item.isCurrentUser) }}
                onClick={() => handleCompare(item.deviceId)}
              >
                <span className="rank-number">
                  {RANK_MEDALS[item.rank] || `#${item.rank}`}
                </span>
                <span className="rank-avatar">{item.avatar || '👤'}</span>
                <span className="rank-name" style={{ color: getRankTextColor(item.rank, item.isCurrentUser) }}>
                  {item.userName}
                  {item.isCurrentUser && <span className="current-user-tag">（我）</span>}
                </span>
                <span className="rank-steps">
                  {item.steps.toLocaleString()} 步
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {comparisonResult && (
        <div className="comparison-modal">
          <div className="comparison-content">
            <div className="comparison-header">
              <h4>步数PK</h4>
              <button onClick={closeComparison} className="btn btn-small btn-danger">×</button>
            </div>
            <div className="comparison-body">
              <div className={`comparison-user ${comparisonResult.winner === 'current' ? 'winner' : ''}`}>
                <div className="user-avatar">👤</div>
                <div className="user-name">{comparisonResult.currentUser.userName}</div>
                <div className="user-steps">{comparisonResult.currentUser.steps.toLocaleString()}</div>
                {comparisonResult.winner === 'current' && <div className="winner-badge">🏆 胜利!</div>}
              </div>
              <div className="comparison-vs">
                <span className="vs-text">VS</span>
                {comparisonResult.winner !== 'tie' && (
                  <span className="vs-diff">
                    {comparisonResult.difference > 0 ? '+' : ''}{comparisonResult.difference.toLocaleString()}
                  </span>
                )}
                {comparisonResult.winner === 'tie' && <span className="vs-diff">平局</span>}
              </div>
              <div className={`comparison-user ${comparisonResult.winner === 'friend' ? 'winner' : ''}`}>
                <div className="user-avatar">{leaderboard.rankings.find(r => r.deviceId === compareFriend)?.avatar || '👤'}</div>
                <div className="user-name">{comparisonResult.friend.userName}</div>
                <div className="user-steps">{comparisonResult.friend.steps.toLocaleString()}</div>
                {comparisonResult.winner === 'friend' && <div className="winner-badge">🏆 胜利!</div>}
              </div>
            </div>
            <div className="comparison-footer">
              <p>
                {comparisonResult.currentUser.userName} 是 {comparisonResult.friend.userName} 的 {comparisonResult.percentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {lastUpdate && (
        <p className="last-update">
          最后更新: {formatTime(lastUpdate)}
        </p>
      )}
    </div>
  );
};

export default Leaderboard;
