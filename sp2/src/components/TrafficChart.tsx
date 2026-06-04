import { useStore } from '@/hooks/useStore';

export function TrafficChart() {
  const flowRates = useStore((s) => s.flowRates);

  const maxRate = Math.max(...flowRates.map((p) => p.rate), 1);
  const chartHeight = 120;
  const chartWidth = 600;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const now = Date.now();
  const points = flowRates.length > 1
    ? flowRates.map((p) => ({
        x: padding.left + ((p.time - (now - 60000)) / 60000) * innerWidth,
        y: padding.top + innerHeight - (p.rate / maxRate) * innerHeight,
      }))
    : [];

  const linePath =
    points.length > 1
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ')
      : '';

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
      : '';

  const yTicks = [0, maxRate * 0.5, maxRate];

  return (
    <div className="gradient-border p-5">
      <h2 className="text-lg font-semibold text-white mb-3">实时流量速率</h2>
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: chartHeight }}
        >
          {yTicks.map((tick) => {
            const y = padding.top + innerHeight - (tick / maxRate) * innerHeight;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#334155"
                  strokeWidth={0.5}
                />
                <text
                  x={padding.left - 5}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono"
                  fill="#64748B"
                  fontSize={8}
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {areaPath && (
            <path d={areaPath} fill="url(#cyanGradient)" opacity={0.15} />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#06B6D4"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          <defs>
            <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
            </linearGradient>
          </defs>

          {points.length === 0 && (
            <text
              x={chartWidth / 2}
              y={chartHeight / 2}
              textAnchor="middle"
              fill="#475569"
              fontSize={12}
            >
              等待数据...
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
