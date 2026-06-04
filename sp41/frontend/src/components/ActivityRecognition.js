import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import webSocketClient from '../services/websocketService';
import { realtimeApi } from '../api';

const ACTIVITY_ICONS = {
  walking: '🚶',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  resting: '😴',
  unknown: '❓'
};

const ACTIVITY_LABELS = {
  walking: '步行',
  running: '跑步',
  cycling: '骑行',
  swimming: '游泳',
  resting: '静止',
  unknown: '未知'
};

const ACTIVITY_COLORS = {
  walking: '#52c41a',
  running: '#ff4d4f',
  cycling: '#1890ff',
  swimming: '#13c2c2',
  resting: '#722ed1',
  unknown: '#8c8c8c'
};

const ActivityRecognition = ({ deviceId }) => {
  const [currentActivity, setCurrentActivity] = useState(null);
  const [activityHistory, setActivityHistory] = useState([]);
  const [activityStats, setActivityStats] = useState({});
  const [isTracking, setIsTracking] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [accelerometer, setAccelerometer] = useState({ x: 0, y: 0, z: 0 });
  const [selectedActivity, setSelectedActivity] = useState('auto');

  useEffect(() => {
    webSocketClient.setOnActivityCallback(handleActivityUpdate);

    loadCurrentActivity();
    loadActivityStats();

    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [deviceId]);

  useEffect(() => {
    let interval;
    if (currentActivity && isTracking) {
      interval = setInterval(() => {
        setCurrentDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentActivity, isTracking]);

  const handleActivityUpdate = (message) => {
    const { data } = message;

    setCurrentActivity(data.activityType);
    setConfidence(data.confidence);
    setAccelerometer(data.accelerometer || { x: 0, y: 0, z: 0 });

    setActivityHistory(prev => {
      const newEntry = {
        activityType: data.activityType,
        timestamp: data.timestamp,
        confidence: data.confidence,
        steps: data.steps,
        heartRate: data.heartRate
      };
      const updated = [newEntry, ...prev];
      return updated.slice(0, 100);
    });
  };

  const loadCurrentActivity = async () => {
    try {
      const response = await realtimeApi.getCurrentActivity();
      if (response.data.success) {
        setCurrentActivity(response.data.data.activityType);
        setConfidence(response.data.data.confidence);
        setCurrentDuration(Math.floor(response.data.data.duration));
      }
    } catch (error) {
      console.error('Load current activity error:', error);
    }
  };

  const loadActivityStats = async () => {
    try {
      const response = await realtimeApi.getActivityStats();
      if (response.data.success) {
        setActivityStats(response.data.data);
      }
    } catch (error) {
      console.error('Load activity stats error:', error);
    }
  };

  const startTracking = async () => {
    if (!webSocketClient.isConnectedToServer()) {
      await webSocketClient.connect(deviceId);
    }
    setIsTracking(true);
    setCurrentDuration(0);
  };

  const stopTracking = () => {
    setIsTracking(false);
  };

  const toggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const simulateActivity = (activity) => {
    setSelectedActivity(activity);

    let accelerometer = { x: 0, y: 0, z: 0 };
    let heartRate = 70;
    let steps = 0;

    switch (activity) {
      case 'running':
        accelerometer = {
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2,
          z: Math.random() * 2 - 1
        };
        heartRate = 130 + Math.floor(Math.random() * 30);
        steps = 35 + Math.floor(Math.random() * 20);
        break;
      case 'cycling':
        accelerometer = {
          x: Math.random() * 2 - 1,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 1 - 0.5
        };
        heartRate = 110 + Math.floor(Math.random() * 20);
        steps = 0;
        break;
      case 'swimming':
        accelerometer = {
          x: Math.random() * 1.5 - 0.75,
          y: Math.random() * 2 - 1,
          z: -0.8 + Math.random() * 0.6
        };
        heartRate = 120 + Math.floor(Math.random() * 25);
        steps = 0;
        break;
      case 'walking':
        accelerometer = {
          x: Math.random() * 1.5 - 0.75,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 0.5 - 0.25
        };
        heartRate = 80 + Math.floor(Math.random() * 15);
        steps = 15 + Math.floor(Math.random() * 10);
        break;
      case 'resting':
      default:
        accelerometer = { x: 0, y: 0, z: -1 };
        heartRate = 60 + Math.floor(Math.random() * 10);
        steps = 0;
    }

    setAccelerometer(accelerometer);

    realtimeApi.sendActivity(
      deviceId,
      accelerometer,
      heartRate,
      steps,
      Date.now()
    ).then(response => {
      if (response.data.success) {
        setCurrentActivity(response.data.data.activityType);
        setConfidence(response.data.data.confidence);
      }
    });
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}时${mins}分${secs}秒`;
    } else if (mins > 0) {
      return `${mins}分${secs}秒`;
    }
    return `${secs}秒`;
  };

  const pieData = Object.entries(activityStats)
    .filter(([key, value]) => value.count > 0)
    .map(([key, value]) => ({
      name: ACTIVITY_LABELS[key] || key,
      value: value.totalDuration,
      color: ACTIVITY_COLORS[key] || '#8c8c8c',
      count: value.count,
      avgConfidence: value.avgConfidence
    }));

  return (
    <div className="activity-recognition-panel">
      <div className="panel-header">
        <h3>运动识别</h3>
        <span className={`tracking-status ${isTracking ? 'active' : ''}`}>
          {isTracking ? '● 追踪中' : '○ 未追踪'}
        </span>
      </div>

      <div className="current-activity">
        <div className="activity-icon">
          {ACTIVITY_ICONS[currentActivity] || '❓'}
        </div>
        <div className="activity-info">
          <div className="activity-name">
            {ACTIVITY_LABELS[currentActivity] || '未知'}
          </div>
          <div className="activity-duration">
            持续时间: {formatDuration(currentDuration)}
          </div>
          <div className="confidence-bar">
            <div className="confidence-label">
              识别置信度: {(confidence * 100).toFixed(0)}%
            </div>
            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{
                  width: `${confidence * 100}%`,
                  backgroundColor: confidence > 0.8 ? '#52c41a' : confidence > 0.6 ? '#faad14' : '#ff4d4f'
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {accelerometer && (
        <div className="accelerometer-display">
          <h4>加速度计数据</h4>
          <div className="accel-values">
            <div className="accel-item">
              <span className="accel-label">X:</span>
              <span className="accel-value">{accelerometer.x?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="accel-item">
              <span className="accel-label">Y:</span>
              <span className="accel-value">{accelerometer.y?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="accel-item">
              <span className="accel-label">Z:</span>
              <span className="accel-value">{accelerometer.z?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="activity-controls">
        <button
          onClick={toggleTracking}
          className={`btn ${isTracking ? 'btn-danger' : 'btn-primary'}`}
          disabled={!deviceId}
        >
          {isTracking ? '停止追踪' : '开始运动追踪'}
        </button>
      </div>

      <div className="simulate-section">
        <h4>模拟运动模式（测试）</h4>
        <div className="simulate-buttons">
          {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => simulateActivity(key)}
              className={`btn btn-simulate ${selectedActivity === key ? 'active' : ''}`}
              disabled={!deviceId}
            >
              {ACTIVITY_ICONS[key]} {label}
            </button>
          ))}
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="activity-stats">
          <h4>活动统计</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value.toFixed(1)} 秒`, '时长']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ActivityRecognition;
