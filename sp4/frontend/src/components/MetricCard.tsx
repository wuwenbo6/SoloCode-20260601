import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ComponentType } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  trend?: number;
  subtitle?: string;
}

export default function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  trend,
  subtitle,
}: MetricCardProps) {
  return (
    <div className="bg-[#132F4C] rounded-xl p-6 border border-[#1e3a5f] hover:border-[#00E5FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#00E5FF]/5 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[#B2BAC2] mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace", color }}
            >
              {value}
            </span>
            {unit && <span className="text-sm text-[#B2BAC2]">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-[#8892B0] mt-2">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-3">
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-[#4CAF50]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-[#F44336]" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                }`}
              >
                {Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-xs text-[#B2BAC2]">较上周期</span>
            </div>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  );
}
