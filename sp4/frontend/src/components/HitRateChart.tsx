import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Process, CLOSGroup } from '../types';
import { getCLOSColor } from '../utils/format';

interface HitRateChartProps {
  processes: Process[];
  closGroups: CLOSGroup[];
}

export default function HitRateChart({ processes, closGroups }: HitRateChartProps) {
  const option = useMemo(() => {
    const legendData = processes.map((p) => p.name);
    const series = processes.map((proc) => ({
      name: proc.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: getCLOSColor(proc.clos_id, closGroups),
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${getCLOSColor(proc.clos_id, closGroups)}30` },
            { offset: 1, color: `${getCLOSColor(proc.clos_id, closGroups)}00` },
          ],
        },
      },
      data: Array.from({ length: 60 }, (_, i) => {
        const baseHitRate = proc.llc_hit_rate;
        const variation = (Math.sin(i / 10 + proc.pid) * 0.05);
        return [
          `${-59 + i}s`,
          Math.max(0.3, Math.min(0.95, baseHitRate + variation)),
        ];
      }),
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 25, 41, 0.95)',
        borderColor: '#132F4C',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let result = `<div style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">`;
          result += `<div style="margin-bottom: 8px; color: #B2BAC2;">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">`;
            result += `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>`;
            result += `<span>${p.seriesName}:</span>`;
            result += `<span style="color: ${p.color}; font-weight: bold;">${(p.value[1] * 100).toFixed(1)}%</span>`;
            result += `</div>`;
          });
          result += `</div>`;
          return result;
        },
      },
      legend: {
        data: legendData,
        top: 0,
        right: 0,
        textStyle: { color: '#B2BAC2', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: Array.from({ length: 60 }, (_, i) => `${-59 + i}s`),
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { color: '#B2BAC2', fontSize: 10, interval: 14 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        axisLabel: {
          color: '#B2BAC2',
          fontSize: 10,
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
        },
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        splitLine: { lineStyle: { color: '#1e3a5f', type: 'dashed' } },
      },
      series,
    };
  }, [processes, closGroups]);

  return (
    <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#00E5FF]"></span>
        LLC命中率趋势
      </h3>
      <ReactECharts
        option={option}
        style={{ height: '300px' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
