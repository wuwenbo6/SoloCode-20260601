import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24', '#f97316', '#ef4444'];

const HeartRateZonesChart = ({ data }) => {
  const chartData = data.map(zone => ({
    ...zone,
    name: zone.label
  }));

  return (
    <div className="chart-container">
      <h3>心率区间分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip
            formatter={(value, name) => [
              `${value} 次 (${chartData.find(d => d.label === name)?.percentage || 0}%)`,
              '读数数量'
            ]}
          />
          <Legend />
          <Bar dataKey="count" name="读数数量">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HeartRateZonesChart;
