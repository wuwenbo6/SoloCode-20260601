import React, { useState, useEffect } from 'react';
import { analysisApi } from '../api';

const AnalysisPanel = ({ deviceId }) => {
  const [userProfile, setUserProfile] = useState({
    age: 30,
    weight: 70,
    height: 175,
    dailyGoal: 10000
  });

  const [caloriesData, setCaloriesData] = useState(null);
  const [goalData, setGoalData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceId) {
      loadAnalysis();
    }
  }, [deviceId, userProfile]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const [caloriesRes, goalRes] = await Promise.all([
        analysisApi.getCalories(deviceId, userProfile.weight, userProfile.age),
        analysisApi.getGoalProgress(deviceId, userProfile.dailyGoal)
      ]);

      if (caloriesRes.data.success) {
        setCaloriesData(caloriesRes.data);
      }
      if (goalRes.data.success) {
        setGoalData(goalRes.data);
      }
    } catch (error) {
      console.error('Load analysis error:', error);
    }
    setLoading(false);
  };

  const handleProfileChange = (field, value) => {
    setUserProfile(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  return (
    <div className="analysis-panel">
      <h3>运动分析</h3>

      <div className="profile-form">
        <h4>个人资料</h4>
        <div className="form-row">
          <label>
            年龄:
            <input
              type="number"
              value={userProfile.age}
              onChange={(e) => handleProfileChange('age', e.target.value)}
              min="1"
              max="120"
            />
          </label>
          <label>
            体重 (kg):
            <input
              type="number"
              value={userProfile.weight}
              onChange={(e) => handleProfileChange('weight', e.target.value)}
              min="1"
              max="300"
            />
          </label>
          <label>
            身高 (cm):
            <input
              type="number"
              value={userProfile.height}
              onChange={(e) => handleProfileChange('height', e.target.value)}
              min="50"
              max="250"
            />
          </label>
          <label>
            每日目标 (步):
            <input
              type="number"
              value={userProfile.dailyGoal}
              onChange={(e) => handleProfileChange('dailyGoal', e.target.value)}
              min="1000"
              max="50000"
            />
          </label>
        </div>
      </div>

      {loading && <p>加载中...</p>}

      {caloriesData && (
        <div className="calories-summary">
          <h4>卡路里消耗</h4>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">7天总消耗</span>
              <span className="stat-value">{caloriesData.summary.totalCalories.toFixed(0)}</span>
              <span className="stat-unit">kcal</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">日均消耗</span>
              <span className="stat-value">{caloriesData.summary.avgDailyCalories.toFixed(0)}</span>
              <span className="stat-unit">kcal</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">7天总步数</span>
              <span className="stat-value">{caloriesData.summary.totalSteps.toLocaleString()}</span>
              <span className="stat-unit">步</span>
            </div>
          </div>
        </div>
      )}

      {goalData && (
        <div className="goal-summary">
          <h4>目标完成度</h4>
          <div className="goal-progress">
            <div className="goal-stats">
              <span>达成天数: {goalData.summary.achievedDays} / {goalData.summary.totalDays}</span>
              <span>达成率: {goalData.summary.achievementRate}%</span>
            </div>
            <div className="daily-goal-list">
              {goalData.data.slice(-7).map((day, index) => (
                <div key={index} className="goal-item">
                  <span className="goal-date">{day.date.slice(5)}</span>
                  <div className="goal-bar-container">
                    <div
                      className={`goal-bar ${day.achieved ? 'achieved' : ''}`}
                      style={{ width: `${day.completion}%` }}
                    ></div>
                  </div>
                  <span className="goal-completion">{day.completion}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;
