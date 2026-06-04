import { Thermometer, Ruler, Clock, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn, formatTime, getStateLabel, getStateBgColor } from '../utils';
import type { PrinterStatus, TemperaturePoint } from '../types';

interface StatusPanelProps {
  status: PrinterStatus | null;
  tempHistory: TemperaturePoint[];
}

export function StatusPanel({ status, tempHistory }: StatusPanelProps) {
  if (!status) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const chartData = tempHistory.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    喷嘴: point.nozzle,
    热床: point.bed,
  }));

  const nozzleHeating = status.nozzle_target > 0 && Math.abs(status.nozzle_temp - status.nozzle_target) > 2;
  const bedHeating = status.bed_target > 0 && Math.abs(status.bed_temp - status.bed_target) > 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">打印机状态</h3>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStateBgColor(status.state))}>
          {getStateLabel(status.state)}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <Thermometer className="w-5 h-5" />
            <span className="text-sm font-medium">喷嘴温度</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">{status.nozzle_temp.toFixed(1)}</span>
            <span className="text-gray-500">°C</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            目标: <span className={cn(nozzleHeating && 'animate-pulse text-orange-600')}>{status.nozzle_target.toFixed(1)}°C</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', nozzleHeating ? 'bg-orange-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, (status.nozzle_temp / Math.max(1, status.nozzle_target)) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Thermometer className="w-5 h-5" />
            <span className="text-sm font-medium">热床温度</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">{status.bed_temp.toFixed(1)}</span>
            <span className="text-gray-500">°C</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            目标: <span className={cn(bedHeating && 'animate-pulse text-blue-600')}>{status.bed_target.toFixed(1)}°C</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', bedHeating ? 'bg-cyan-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, (status.bed_temp / Math.max(1, status.bed_target)) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Ruler className="w-5 h-5" />
            <span className="text-sm font-medium">Z轴高度</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">{status.z_height.toFixed(2)}</span>
            <span className="text-gray-500">mm</span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            当前打印层: ~{Math.floor(status.z_height / 0.2) + 1}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">打印进度</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">{status.progress.toFixed(1)}</span>
            <span className="text-gray-500">%</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            已用: {formatTime(status.print_time || 0)}
            {status.time_left && status.time_left > 0 && (
              <span className="ml-2">剩余: {formatTime(status.time_left)}</span>
            )}
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {status.file_name && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
          <FileText className="w-4 h-4" />
          <span className="font-medium">文件:</span>
          <span>{status.file_name}</span>
        </div>
      )}

      {tempHistory.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">温度曲线</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="喷嘴"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="热床"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
