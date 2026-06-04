import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#60a5fa', '#8b5cf6', '#10b981', '#f59e0b'];

const STAGE_LABELS = {
  awake: '清醒',
  light: '浅睡',
  deep: '深睡',
  rem: 'REM睡眠'
};

const SleepPieChart = ({ data }) => {
  const sleepByStage = data.reduce((acc, item) => {
    const stage = item.stage || 'light';
    acc[stage] = (acc[stage] || 0) + (item.duration || 0);
    return acc;
  }, {});

  const chartData = Object.entries(sleepByStage).map(([stage, duration]) => ({
    name: STAGE_LABELS[stage] || stage,
    value: parseFloat(duration.toFixed(2))
  }));

  return (
    <div className="chart-container">
      <h3>睡眠阶段分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value} 小时`, '时长']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SleepPieChart;
