import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Process, CLOSGroup } from '../types';
import { getCLOSColor } from '../utils/format';

interface BandwidthChartProps {
  processes: Process[];
  closGroups: CLOSGroup[];
}

export default function BandwidthChart({ processes, closGroups }: BandwidthChartProps) {
  const option = useMemo(() => {
    const colors = processes.map((p) => getCLOSColor(p.clos_id, closGroups));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(10, 25, 41, 0.95)',
        borderColor: '#132F4C',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let total = 0;
          let result = `<div style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">`;
          result += `<div style="margin-bottom: 8px; color: #B2BAC2;">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
            total += p.value;
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">`;
            result += `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>`;
            result += `<span>${p.seriesName}:</span>`;
            result += `<span style="color: ${p.color}; font-weight: bold;">${p.value.toFixed(0)} MB/s</span>`;
            result += `</div>`;
          });
          result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #1e3a5f;">`;
          result += `<span style="color: #B2BAC2;">总计:</span> `;
          result += `<span style="color: #00E5FF; font-weight: bold;">${total.toFixed(0)} MB/s</span>`;
          result += `</div>`;
          result += `</div>`;
          return result;
        },
      },
      legend: {
        data: processes.map((p) => p.name),
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
        data: Array.from({ length: 30 }, (_, i) => `${-29 + i}s`),
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { color: '#B2BAC2', fontSize: 10, interval: 7 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'MB/s',
        nameTextStyle: { color: '#B2BAC2', fontSize: 10 },
        axisLabel: { color: '#B2BAC2', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        splitLine: { lineStyle: { color: '#1e3a5f', type: 'dashed' } },
      },
      series: processes.map((proc, idx) => ({
        name: proc.name,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: {
          color: colors[idx],
          borderRadius: [0, 0, 0, 0],
        },
        data: Array.from({ length: 30 }, () => {
          const base = proc.mem_bandwidth / processes.length;
          const variation = (Math.random() - 0.5) * base * 0.3;
          return Math.max(50, base + variation);
        }),
      })),
    };
  }, [processes, closGroups]);

  return (
    <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#FF9800]"></span>
        内存带宽使用
      </h3>
      <ReactECharts
        option={option}
        style={{ height: '300px' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
