import React from 'react';
import type { StreamStats } from './types';

interface StatsPanelProps {
  stats: StreamStats;
  isPublisher: boolean;
  encodingBitrate: number;
  encodingFramerate: number;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  isPublisher,
  encodingBitrate,
  encodingFramerate,
}) => {
  const formatBitrate = (bps: number): string => {
    if (bps >= 1000000) {
      return (bps / 1000000).toFixed(2) + ' Mbps';
    } else if (bps >= 1000) {
      return (bps / 1000).toFixed(1) + ' kbps';
    }
    return bps.toFixed(0) + ' bps';
  };

  const getStatusColor = (value: number, thresholds: [number, number]): string => {
    if (value <= thresholds[0]) return 'text-green-400';
    if (value <= thresholds[1]) return 'text-yellow-400';
    return 'text-red-400';
  };

  const rttColor = getStatusColor(stats.rtt, [100, 300]);
  const lossColor = getStatusColor(stats.lossRate, [1, 5]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm shadow-xl border border-gray-700">
      <h3 className="text-lg font-bold mb-3 text-blue-400 border-b border-gray-700 pb-2">
        {isPublisher ? '📤 Publisher Stats' : '📥 Subscriber Stats'}
      </h3>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs">RTT</span>
          <span className={`text-xl font-bold ${rttColor}`}>
            {stats.rtt.toFixed(0)} <span className="text-sm">ms</span>
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-xs">Packet Loss</span>
          <span className={`text-xl font-bold ${lossColor}`}>
            {stats.lossRate.toFixed(2)} <span className="text-sm">%</span>
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-xs">Bitrate</span>
          <span className="text-xl font-bold text-blue-300">
            {formatBitrate(stats.bitrate)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-xs">Framerate</span>
          <span className="text-xl font-bold text-purple-300">
            {stats.framerate.toFixed(0)} <span className="text-sm">fps</span>
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-xs">Est. Bandwidth</span>
          <span className="text-xl font-bold text-cyan-300">
            {formatBitrate(stats.estimatedBandwidth)}
          </span>
        </div>

        {isPublisher && (
          <>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Encoding Bitrate</span>
              <span className="text-xl font-bold text-orange-300">
                {formatBitrate(encodingBitrate)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Encoding FPS</span>
              <span className="text-xl font-bold text-pink-300">
                {encodingFramerate.toFixed(0)} <span className="text-sm">fps</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, (stats.bitrate / Math.max(stats.estimatedBandwidth, 1)) * 100)}%`,
              }}
            />
          </div>
          <span className="text-gray-400 whitespace-nowrap">
            {Math.round((stats.bitrate / Math.max(stats.estimatedBandwidth, 1)) * 100)}%
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Bandwidth utilization
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
