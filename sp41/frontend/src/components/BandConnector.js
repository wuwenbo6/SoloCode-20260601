import React, { useState } from 'react';
import bandService from '../services/bandService';
import syncService from '../services/syncService';

const BandConnector = ({ onConnect, onData, deviceId }) => {
  const [connected, setConnected] = useState(false);
  const [connectionType, setConnectionType] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [status, setStatus] = useState('未连接');
  const [enableFiltering, setEnableFiltering] = useState(true);
  const [simulateAnomalies, setSimulateAnomalies] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const handleConnect = async (type) => {
    setStatus('连接中...');
    let result;

    bandService.setFilteringEnabled(enableFiltering);
    bandService.setSimulateAnomalies(simulateAnomalies);

    if (type === 'webusb') {
      result = await bandService.connectWebUSB();
    } else if (type === 'webhid') {
      result = await bandService.connectWebHID();
    } else {
      result = bandService.connectSimulator();
    }

    if (result.success) {
      setConnected(true);
      setConnectionType(result.type);
      setDeviceName(result.device);
      setStatus(`已连接: ${result.type}`);

      bandService.setOnDataCallback((data) => {
        if (onData) onData(data);
      });

      if (onConnect) onConnect(true, result.type);
    } else {
      setStatus(`连接失败: ${result.error}`);
    }
  };

  const handleDisconnect = async () => {
    await bandService.disconnect();
    setConnected(false);
    setConnectionType(null);
    setDeviceName('');
    setStatus('未连接');
    setSyncStatus(null);
    if (onConnect) onConnect(false, null);
  };

  const handleSyncHistoricalData = async (days = 30) => {
    if (!deviceId) {
      alert('请先连接设备');
      return;
    }

    setSyncResult(null);
    syncService.syncHistoricalData(
      deviceId,
      days,
      (progress) => {
        setSyncStatus(progress);
      },
      (result) => {
        setSyncStatus(null);
        setSyncResult(result);
        alert(`同步完成！共 ${result.totalRecords} 条记录，${result.totalPages} 页`);
      },
      (error) => {
        setSyncStatus(null);
        alert(`同步失败: ${error.message}`);
      }
    );
  };

  const handleFilteringChange = (e) => {
    const enabled = e.target.checked;
    setEnableFiltering(enabled);
    bandService.setFilteringEnabled(enabled);
  };

  const handleAnomalySimulationChange = (e) => {
    const enabled = e.target.checked;
    setSimulateAnomalies(enabled);
    bandService.setSimulateAnomalies(enabled);
  };

  return (
    <div className="connector-panel">
      <h3>设备连接</h3>
      <div className="connection-status">
        <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
        <span>{status}</span>
      </div>
      {deviceName && <p className="device-name">设备: {deviceName}</p>}

      <div className="settings-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={enableFiltering}
            onChange={handleFilteringChange}
            disabled={connected}
          />
          启用数据过滤（卡尔曼滤波 + 异常剔除）
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={simulateAnomalies}
            onChange={handleAnomalySimulationChange}
            disabled={connected}
          />
          模拟异常数据（测试过滤）
        </label>
      </div>

      {!connected ? (
        <div className="connection-buttons">
          <button onClick={() => handleConnect('webusb')} className="btn btn-primary">
            WebUSB 连接
          </button>
          <button onClick={() => handleConnect('webhid')} className="btn btn-secondary">
            WebHID 连接
          </button>
          <button onClick={() => handleConnect('simulator')} className="btn btn-simulator">
            模拟设备
          </button>
        </div>
      ) : (
        <div className="connected-actions">
          <button onClick={handleDisconnect} className="btn btn-danger">
            断开连接
          </button>
        </div>
      )}

      {syncStatus && (
        <div className="sync-progress">
          <p>{syncStatus.status}</p>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${syncStatus.progress}%` }}
            ></div>
          </div>
          <p className="progress-text">{syncStatus.progress}%</p>
        </div>
      )}

      {syncResult && (
        <div className="sync-result">
          <p>上次同步: {syncResult.totalRecords} 条记录</p>
        </div>
      )}

      <div className="sync-section">
        <h4>历史数据同步</h4>
        <div className="sync-buttons">
          <button
            onClick={() => handleSyncHistoricalData(7)}
            className="btn btn-sync"
            disabled={!deviceId || syncStatus}
          >
            同步7天
          </button>
          <button
            onClick={() => handleSyncHistoricalData(30)}
            className="btn btn-sync"
            disabled={!deviceId || syncStatus}
          >
            同步30天
          </button>
        </div>
      </div>

      <p className="connection-note">
        提示: WebUSB/WebHID需要浏览器支持和实际手环设备。使用"模拟设备"可体验功能。
        历史数据同步采用分页读取（每页7天）和重试机制，避免超时。
      </p>
    </div>
  );
};

export default BandConnector;
