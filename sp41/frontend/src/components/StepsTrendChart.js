import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const StepsTrendChart = ({ data }) => {
  return (
    <div className="chart-container">
      <h3>最近7天步数趋势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="steps"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ fill: '#8884d8' }}
            activeDot={{ r: 8 }}
            name="步数"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StepsTrendChart;
