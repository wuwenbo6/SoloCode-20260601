import { useStore } from '../store';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatDateTime } from '../utils/format';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const wsConnected = useStore((s) => s.wsConnected);
  const simulatorStatus = useStore((s) => s.simulatorStatus);

  return (
    <header className="bg-[#0A1929]/80 backdrop-blur-sm border-b border-[#132F4C] sticky top-0 z-10">
      <div className="px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {title}
          </h2>
          {subtitle && <p className="text-sm text-[#B2BAC2] mt-1">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#B2BAC2] animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-sm text-[#B2BAC2]">实时更新</span>
          </div>

          <div className="flex items-center gap-2">
            {wsConnected ? (
              <>
                <Wifi className="w-5 h-5 text-[#4CAF50]" />
                <span className="text-sm text-[#4CAF50]">已连接</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-[#F44336]" />
                <span className="text-sm text-[#F44336]">重连中...</span>
              </>
            )}
          </div>

          {simulatorStatus?.start_time && (
            <div className="text-right">
              <p className="text-xs text-[#B2BAC2]">启动时间</p>
              <p className="text-sm text-white font-mono">
                {formatDateTime(simulatorStatus.start_time)}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
