import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import webSocketClient from '../services/websocketService';

const RealTimeHeartRate = ({ deviceId, userName }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState(null);
  const [heartRateHistory, setHeartRateHistory] = useState([]);
  const [avgHeartRate, setAvgHeartRate] = useState(0);
  const [maxHeartRate, setMaxHeartRate] = useState(0);
  const [minHeartRate, setMinHeartRate] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const maxHistoryPoints = 60;
  const chartRef = useRef(null);

  useEffect(() => {
    webSocketClient.setOnHeartRateCallback(handleHeartRateUpdate);
    webSocketClient.setOnConnectCallback(() => setWsConnected(true));
    webSocketClient.setOnDisconnectCallback(() => setWsConnected(false));

    if (!webSocketClient.isConnectedToServer()) {
      webSocketClient.connect(deviceId);
    }

    return () => {
      if (isMonitoring) {
        stopMonitoring();
      }
    };
  }, [deviceId]);

  useEffect(() => {
    if (heartRateHistory.length > 0) {
      const values = heartRateHistory.map(h => h.value);
      setAvgHeartRate(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
      setMaxHeartRate(Math.max(...values));
      setMinHeartRate(Math.min(...values));
    }
  }, [heartRateHistory]);

  const handleHeartRateUpdate = (message) => {
    const { data } = message;
    setCurrentHeartRate(data.value);

    setHeartRateHistory(prev => {
      const newPoint = {
        time: new Date(data.timestamp).toLocaleTimeString(),
        value: data.value,
        filtered: data.filtered
      };
      const updated = [...prev, newPoint];
      return updated.slice(-maxHistoryPoints);
    });
  };

  const startMonitoring = async () => {
    if (!webSocketClient.isConnectedToServer()) {
      await webSocketClient.connect(deviceId);
    }
    webSocketClient.subscribeHeartRate(deviceId);
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    webSocketClient.unsubscribeHeartRate();
    setIsMonitoring(false);
  };

  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  const clearHistory = () => {
    setHeartRateHistory([]);
    setCurrentHeartRate(null);
    setAvgHeartRate(0);
    setMaxHeartRate(0);
    setMinHeartRate(0);
  };

  const getHeartRateZone = (hr) => {
    if (!hr) return { zone: '未知', color: '#999' };
    if (hr < 60) return { zone: '休息', color: '#52c41a' };
    if (hr < 100) return { zone: '轻度活动', color: '#1890ff' };
    if (hr < 140) return { zone: '中等强度', color: '#faad14' };
    if (hr < 170) return { zone: '高强度', color: '#fa8c16' };
    return { zone: '极限', color: '#f5222d' };
  };

  const currentZone = getHeartRateZone(currentHeartRate);

  return (
    <div className="realtime-heartrate-panel">
      <div className="panel-header">
        <h3>实时心率监测</h3>
        <div className="ws-status">
          <span className={`status-dot ${wsConnected ? 'online' : 'offline'}`}></span>
          <span>{wsConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'}</span>
        </div>
      </div>

      <div className="current-hr-display">
        <div className="hr-circle">
          <div className="hr-value">
            {currentHeartRate || '--'}
            <span className="hr-unit">bpm</span>
          </div>
          <div className="hr-zone" style={{ color: currentZone.color }}>
            {currentZone.zone}
          </div>
          <div className="hr-animation">
            <span className="heart-beat">❤️</span>
          </div>
        </div>

        <div className="hr-stats">
          <div className="hr-stat-item">
            <span className="stat-label">平均</span>
            <span className="stat-value">{avgHeartRate}</span>
            <span className="stat-unit">bpm</span>
          </div>
          <div className="hr-stat-item">
            <span className="stat-label">最高</span>
            <span className="stat-value">{maxHeartRate}</span>
            <span className="stat-unit">bpm</span>
          </div>
          <div className="hr-stat-item">
            <span className="stat-label">最低</span>
            <span className="stat-value">{minHeartRate}</span>
            <span className="stat-unit">bpm</span>
          </div>
        </div>
      </div>

      <div className="hr-chart-container">
        <h4>心率趋势（最近{maxHistoryPoints}个点）</h4>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={heartRateHistory} ref={chartRef}>
            <defs>
              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              interval={Math.max(0, Math.floor(heartRateHistory.length / 6) - 1)}
            />
            <YAxis domain={[40, 200]} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: '12px' }}
              formatter={(value, name) => [
                `${value} bpm`,
                name === 'value' ? '心率' : name
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ff4d4f"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorHr)"
              isAnimationActive={false}
              name="心率"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="hr-controls">
        <button
          onClick={toggleMonitoring}
          className={`btn ${isMonitoring ? 'btn-danger' : 'btn-primary'}`}
          disabled={!deviceId}
        >
          {isMonitoring ? '停止监测' : '开始连续心率监测'}
        </button>
        <button
          onClick={clearHistory}
          className="btn btn-secondary"
        >
          清除历史
        </button>
      </div>

      {userName && (
        <p className="monitoring-user">
          监测用户: {userName} ({deviceId})
        </p>
      )}
    </div>
  );
};

export default RealTimeHeartRate;
