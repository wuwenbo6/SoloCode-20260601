import { useState } from 'react';
import { Box, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { SRHField } from '@shared/types';
import { cn } from '../lib/utils';

interface SrhVisualizerProps {
  title: string;
  fields: SRHField[];
  totalLength: number;
  isCompressed?: boolean;
}

export default function SrhVisualizer({ 
  title, 
  fields, 
  totalLength,
  isCompressed = false 
}: SrhVisualizerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const headerFields = fields.filter(f => !f.name.startsWith('Segment'));
  const segmentFields = fields.filter(f => f.name.startsWith('Segment'));

  const getFieldColor = (index: number, isSegment: boolean) => {
    if (isSegment) {
      return isCompressed 
        ? 'from-accent/20 to-accent/5 border-accent/30' 
        : 'from-primary-500/20 to-primary-500/5 border-primary-500/30';
    }
    const colors = [
      'from-dark-600 to-dark-700 border-dark-500',
      'from-dark-600 to-dark-700 border-dark-500',
      'from-warning/20 to-warning/5 border-warning/30',
      'from-primary-500/20 to-primary-500/5 border-primary-500/30',
      'from-accent/20 to-accent/5 border-accent/30',
      'from-dark-600 to-dark-700 border-dark-500',
      'from-dark-600 to-dark-700 border-dark-500',
    ];
    return colors[index % colors.length];
  };

  const getFieldWidth = (length: number) => {
    const maxWidth = 16;
    const percentage = (length / maxWidth) * 100;
    return `${Math.max(percentage, 12)}%`;
  };

  return (
    <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: isCompressed ? '0.2s' : '0.15s' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isCompressed ? "bg-accent/20" : "bg-primary-500/20"
          )}>
            <Box className={cn("w-5 h-5", isCompressed ? "text-accent" : "text-primary-400")} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-gray-400">
              总长度: <span className="font-mono font-semibold text-white">{totalLength}</span> 字节
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-dark-700 rounded-full">
          <span className="text-xs text-gray-400">{fields.length}</span>
          <span className="text-xs text-gray-500">字段</span>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
          SRH 结构可视化
        </p>
        <div className="flex flex-wrap gap-1 p-4 bg-dark-900/50 rounded-xl border border-dark-600">
          {headerFields.map((field, index) => (
            <div
              key={field.name}
              className={cn(
                "relative group p-2 rounded-lg bg-gradient-to-br border cursor-pointer",
                "transition-all duration-200 hover:scale-105",
                getFieldColor(index, false)
              )}
              style={{ width: getFieldWidth(field.length) }}
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <div className="text-xs font-medium text-white truncate">{field.name}</div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                {field.length}B
              </div>
              <div className="absolute inset-0 bg-dark-900/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-2 overflow-hidden">
                <p className="text-[10px] text-white font-medium">{field.name}</p>
                <p className="text-[10px] font-mono text-primary-400">{field.value}</p>
              </div>
            </div>
          ))}
          {segmentFields.map((field, index) => (
            <div
              key={field.name}
              className={cn(
                "relative group p-2 rounded-lg bg-gradient-to-br border cursor-pointer",
                "transition-all duration-200 hover:scale-105",
                getFieldColor(headerFields.length + index, true)
              )}
              style={{ width: getFieldWidth(field.length) }}
              onClick={() => setExpandedIndex(expandedIndex === headerFields.length + index ? null : index)}
            >
              <div className="text-xs font-medium text-white truncate">{field.name}</div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                {field.length}B
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-4">
          <span className="text-xs text-gray-500">0</span>
          <span className="text-xs text-gray-500">8</span>
          <span className="text-xs text-gray-500">16</span>
          <span className="text-xs text-gray-500">24</span>
          <span className="text-xs text-gray-500">32</span>
          <span className="text-xs text-gray-500">字节</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
          详细字段列表
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {fields.map((field, index) => (
            <div
              key={`${field.name}-${index}`}
              className="srh-segment"
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  {expandedIndex === index ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{field.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-dark-600 rounded-full text-gray-300 font-mono">
                        {field.length} B
                      </span>
                    </div>
                    <code className="text-sm font-mono text-primary-400">
                      {field.value}
                    </code>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    {field.length * 8} 位
                  </span>
                </div>
              </button>
              
              {expandedIndex === index && (
                <div className="mt-3 pl-7 animate-fade-in">
                  <div className="flex items-start gap-2 p-3 bg-dark-800/50 rounded-lg border border-dark-600">
                    <Info className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-300">{field.description}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {fields.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无 SRH 数据</p>
          <p className="text-sm mt-1">点击"开始模拟"生成结果</p>
        </div>
      )}
    </div>
  );
}
