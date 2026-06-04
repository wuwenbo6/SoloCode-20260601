import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Info, Trash2, Settings, Power, PowerOff, ShieldAlert } from 'lucide-react';
import { detectionAPI } from '../services/api';
import type { FailureAlert, DetectionConfig } from '../types';
import { cn } from '../utils';

const FAILURE_TYPE_LABELS: Record<FailureAlert['type'], string> = {
  warping: '翘边',
  clog: '堵头',
  spaghetti: '面条化',
  layer_shift: '层偏移',
  stringing: '拉丝',
};

const SEVERITY_STYLES: Record<FailureAlert['severity'], { bg: string; text: string; border: string; badge: string }> = {
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
};

const SEVERITY_LABELS: Record<FailureAlert['severity'], string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
};

export function FailureDetection({ disabled = false }: { disabled?: boolean }) {
  const [alerts, setAlerts] = useState<FailureAlert[]>([]);
  const [config, setConfig] = useState<DetectionConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const result = await detectionAPI.getAlerts();
      setAlerts(result.alerts);
      if (config === null) {
        setConfig(await detectionAPI.getConfig());
      }
    } catch (e) {
      console.error('Failed to fetch alerts:', e);
    }
  }, [config]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleToggleDetection = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const updated = { ...config, enabled: !config.enabled };
      await detectionAPI.updateConfig(updated);
      setConfig(updated);
    } catch (e) {
      console.error('Failed to toggle detection:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAlerts = async () => {
    try {
      await detectionAPI.clearAlerts();
      setAlerts([]);
    } catch (e) {
      console.error('Failed to clear alerts:', e);
    }
  };

  const handleConfigChange = async (patch: Partial<DetectionConfig>) => {
    if (!config) return;
    const updated = { ...config, ...patch };
    try {
      await detectionAPI.updateConfig(updated);
      setConfig(updated);
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isEnabled = config?.enabled ?? false;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary-600" />
          故障检测
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleDetection}
            disabled={disabled || loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              (disabled || loading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            {isEnabled ? '已开启' : '已关闭'}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          {alerts.length > 0 && (
            <button
              onClick={handleClearAlerts}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
          )}
        </div>
      </div>

      {showConfig && config && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">检测配置</h4>
          <div className="space-y-3">
            <div>
              <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>灵敏度</span>
                <span className="font-mono text-gray-800">{config.sensitivity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={config.sensitivity}
                onChange={(e) => handleConfigChange({ sensitivity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>翘边阈值</span>
                <span className="font-mono text-gray-800">{config.warp_threshold.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={config.warp_threshold}
                onChange={(e) => handleConfigChange({ warp_threshold: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>堵头阈值</span>
                <span className="font-mono text-gray-800">{config.clog_threshold.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={config.clog_threshold}
                onChange={(e) => handleConfigChange({ clog_threshold: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>最低置信度</span>
                <span className="font-mono text-gray-800">{config.min_confidence.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={config.min_confidence}
                onChange={(e) => handleConfigChange({ min_confidence: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>暂无故障警报</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {alerts.map((alert, idx) => {
            const style = SEVERITY_STYLES[alert.severity];
            const SeverityIcon = alert.severity === 'info' ? Info : AlertTriangle;
            return (
              <div
                key={`${alert.timestamp}-${idx}`}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  style.bg,
                  style.border
                )}
              >
                <div className="flex items-start gap-3">
                  <SeverityIcon className={cn('w-5 h-5 mt-0.5 shrink-0', style.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', style.badge)}>
                        {SEVERITY_LABELS[alert.severity]}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {FAILURE_TYPE_LABELS[alert.type]}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {Math.round(alert.confidence * 100)}%
                      </span>
                    </div>
                    <p className={cn('text-sm', style.text)}>{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span>{formatTimestamp(alert.timestamp)}</span>
                      <span>
                        区域 ({alert.region.x}, {alert.region.y}) {alert.region.width}×{alert.region.height}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
