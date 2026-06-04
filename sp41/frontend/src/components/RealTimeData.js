import React from 'react';

const RealTimeData = ({ data }) => {
  if (!data) {
    return (
      <div className="realtime-panel">
        <h3>实时数据</h3>
        <p className="no-data">等待设备连接...</p>
      </div>
    );
  }

  return (
    <div className="realtime-panel">
      <h3>实时数据</h3>
      <div className="realtime-stats">
        <div className="realtime-item">
          <span className="realtime-label">步数</span>
          <span className="realtime-value">{data.steps || 0}</span>
          <span className="realtime-unit">步</span>
        </div>
        <div className="realtime-item">
          <span className="realtime-label">心率</span>
          <span className="realtime-value heartrate">{data.heartRate || 0}</span>
          <span className="realtime-unit">bpm</span>
        </div>
        <div className="realtime-item">
          <span className="realtime-label">睡眠阶段</span>
          <span className="realtime-value">{data.sleep?.stage || '-'}</span>
          <span className="realtime-unit"></span>
        </div>
      </div>
      <p className="realtime-time">
        更新时间: {new Date(data.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
};

export default RealTimeData;
