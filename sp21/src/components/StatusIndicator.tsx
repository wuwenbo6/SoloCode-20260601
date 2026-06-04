import { CheckCircle, XCircle, AlertTriangle, Thermometer, AlertOctagon } from 'lucide-react';
import type { PrinterStatus } from '../../shared/types';

interface StatusIndicatorProps {
  status: PrinterStatus;
  showDetails?: boolean;
}

export default function StatusIndicator({ status, showDetails = true }: StatusIndicatorProps) {
  const items = [
    {
      key: 'connected',
      value: status.connected,
      label: '连接状态',
      okText: '已连接',
      noText: '未连接',
      icon: CheckCircle
    },
    {
      key: 'online',
      value: status.online,
      label: '在线状态',
      okText: '在线',
      noText: '离线',
      icon: CheckCircle
    },
    {
      key: 'paperOk',
      value: status.paperOk,
      label: '纸张状态',
      okText: '纸张充足',
      noText: '缺纸',
      icon: AlertTriangle
    },
    {
      key: 'temperatureOk',
      value: status.temperatureOk,
      label: '温度状态',
      okText: '温度正常',
      noText: '过热',
      icon: Thermometer
    },
    {
      key: 'coverOpen',
      value: !status.coverOpen,
      label: '机盖状态',
      okText: '已关闭',
      noText: '已打开',
      icon: AlertOctagon
    }
  ];

  if (!showDetails) {
    const isOk = status.connected && status.online && status.paperOk && status.temperatureOk && !status.coverOpen;
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        isOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}>
        {isOk ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <XCircle className="w-4 h-4" />
        )}
        {isOk ? '正常' : status.errorMessage || '异常'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {items.map((item) => (
        <div
          key={item.key}
          className={`p-4 rounded-xl border-2 transition-all duration-300 ${
            item.value
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <item.icon className={`w-5 h-5 ${item.value ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
          </div>
          <p className={`text-lg font-bold ${item.value ? 'text-green-700' : 'text-red-700'}`}>
            {item.value ? item.okText : item.noText}
          </p>
        </div>
      ))}
    </div>
  );
}
