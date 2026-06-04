import React, { useState, useEffect } from 'react';
import { dataApi, analysisApi } from './api';
import BandConnector from './components/BandConnector';
import RealTimeData from './components/RealTimeData';
import StepsTrendChart from './components/StepsTrendChart';
import HeartRateZonesChart from './components/HeartRateZonesChart';
import SleepPieChart from './components/SleepPieChart';
import AnalysisPanel from './components/AnalysisPanel';
import ExportPanel from './components/ExportPanel';
import RealTimeHeartRate from './components/RealTimeHeartRate';
import ActivityRecognition from './components/ActivityRecognition';
import Leaderboard from './components/Leaderboard';
import bandService from './services/bandService';

const USER_NAME = '我';
const DEVICE_ID = 'smartband-001';

function App() {
  const [deviceId] = useState(DEVICE_ID);
  const [userName] = useState(USER_NAME);
  const [connected, setConnected] = useState(false);
  const [realTimeData, setRealTimeData] = useState(null);
  const [stepsData, setStepsData] = useState([]);
  const [heartRateZones, setHeartRateZones] = useState([]);
  const [sleepData, setSleepData] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userProfile, setUserProfile] = useState({
    age: 30,
    weight: 70,
    height: 175
  });

  useEffect(() => {
    bandService.setDeviceInfo(deviceId, userName);
  }, [deviceId, userName]);

  const handleConnect = (isConnected, type) => {
    setConnected(isConnected);
    if (isConnected) {
      loadDashboardData();
    }
  };

  const handleData = async (data) => {
    setRealTimeData(data);

    try {
      await dataApi.sendBatch(deviceId, [
        { type: 'steps', value: data.steps, timestamp: data.timestamp },
        { type: 'heartRate', value: data.heartRate, timestamp: data.timestamp },
        { type: 'sleep', stage: data.sleep.stage, duration: data.sleep.duration, timestamp: data.timestamp }
      ]);
    } catch (error) {
      console.error('Send data error:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [stepsRes, zonesRes, sleepRes] = await Promise.all([
        dataApi.getSteps(deviceId, '-7d', 'now()'),
        analysisApi.getHeartRateZones(deviceId, '-7d', 'now()'),
        dataApi.getSleep(deviceId, '-7d', 'now()')
      ]);

      if (stepsRes.data.success) {
        setStepsData(stepsRes.data.data);
      }
      if (zonesRes.data.success) {
        setHeartRateZones(zonesRes.data.data);
      }
      if (sleepRes.data.success) {
        setSleepData(sleepRes.data.data);
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    }
  };

  useEffect(() => {
    if (connected) {
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [connected]);

  const generateMockData = async () => {
    const mockData = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const dailySteps = Math.floor(Math.random() * 8000) + 4000;
      mockData.push({
        type: 'steps',
        value: dailySteps,
        timestamp: date.toISOString()
      });

      for (let h = 0; h < 24; h++) {
        const hrTime = new Date(date);
        hrTime.setHours(h);
        const heartRate = Math.floor(Math.random() * 60) + 60;
        mockData.push({
          type: 'heartRate',
          value: heartRate,
          timestamp: hrTime.toISOString()
        });
      }

      const sleepDate = new Date(date);
      sleepDate.setHours(22);
      mockData.push(
        { type: 'sleep', stage: 'light', duration: 2, timestamp: sleepDate.toISOString() },
        { type: 'sleep', stage: 'deep', duration: 3, timestamp: sleepDate.toISOString() },
        { type: 'sleep', stage: 'rem', duration: 1.5, timestamp: sleepDate.toISOString() },
        { type: 'sleep', stage: 'awake', duration: 0.5, timestamp: sleepDate.toISOString() }
      );
    }

    try {
      await dataApi.sendBatch(deviceId, mockData);
      loadDashboardData();
      alert('模拟数据已生成！');
    } catch (error) {
      console.error('Generate mock data error:', error);
    }
  };

  const tabs = [
    { id: 'dashboard', label: '仪表盘', icon: '📊' },
    { id: 'heartrate', label: '实时心率', icon: '❤️' },
    { id: 'activity', label: '运动识别', icon: '🏃' },
    { id: 'leaderboard', label: '排行榜', icon: '🏆' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'heartrate':
        return (
          <div className="full-width-panel">
            <RealTimeHeartRate deviceId={deviceId} userName={userName} />
          </div>
        );
      case 'activity':
        return (
          <div className="full-width-panel">
            <ActivityRecognition deviceId={deviceId} />
          </div>
        );
      case 'leaderboard':
        return (
          <div className="full-width-panel">
            <Leaderboard deviceId={deviceId} userName={userName} />
          </div>
        );
      case 'dashboard':
      default:
        return (
          <>
            <div className="charts-grid">
              <StepsTrendChart data={stepsData} />
              <HeartRateZonesChart data={heartRateZones} />
              <SleepPieChart data={sleepData} />
            </div>
            <AnalysisPanel deviceId={deviceId} />
            <ExportPanel deviceId={deviceId} userProfile={userProfile} />
          </>
        );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>智能手环健康仪表盘</h1>
        <p>实时监控您的运动和健康数据</p>
        {!connected && (
          <button onClick={generateMockData} className="btn btn-mock">
            生成模拟数据
          </button>
        )}
      </header>

      <nav className="app-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        <div className="sidebar">
          <BandConnector onConnect={handleConnect} onData={handleData} deviceId={deviceId} />
          <RealTimeData data={realTimeData} />
        </div>

        <div className="main-content">
          {renderContent()}
        </div>
      </main>

      <footer className="app-footer">
        <p>Smart Band Health Dashboard &copy; 2024 | WebSocket实时心率 · 运动识别 · 社交排行榜</p>
      </footer>
    </div>
  );
}

export default App;
