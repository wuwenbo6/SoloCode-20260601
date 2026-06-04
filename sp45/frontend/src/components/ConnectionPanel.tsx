import { useState, useEffect } from 'react';
import { Usb, Wifi, Server, Power, PowerOff, Activity, RefreshCw, Clock } from 'lucide-react';
import { cn } from '../utils';
import { useWebUSB } from '../hooks/useWebUSB';
import { printerAPI } from '../services/api';
import type { ConnectionStatus, ConnectionStatusType } from '../types';

interface ConnectionPanelProps {
  devices: USBDevice[];
  selectedDevice: USBDevice | null;
  connected: boolean;
  isSupported: boolean;
  onConnect: (device: USBDevice) => void;
  onDisconnect: () => void;
  onStartSimulation: () => void;
}

const statusConfig: Record<ConnectionStatusType, { label: string; className: string; icon: 'ok' | 'warn' | 'err' | 'loading' }> = {
  disconnected: { label: '未连接', className: 'bg-gray-100 text-gray-600', icon: 'err' },
  connecting: { label: '连接中', className: 'bg-blue-100 text-blue-700', icon: 'loading' },
  connected: { label: '已连接', className: 'bg-green-100 text-green-700', icon: 'ok' },
  reconnecting: { label: '重连中', className: 'bg-yellow-100 text-yellow-700', icon: 'warn' },
};

export function ConnectionPanel({ devices, selectedDevice, connected, isSupported, onConnect, onDisconnect, onStartSimulation }: ConnectionPanelProps) {
  const [connecting, setConnecting] = useState(false);
  const [connState, setConnState] = useState<ConnectionStatus | null>(null);
  const { isSupported: webUSBSupported, requestDevice, connectDevice: connectUSBDevice, disconnectDevice: disconnectUSBDevice, error } = useWebUSB();

  useEffect(() => {
    let interval: number | null = null;
    
    const loadState = async () => {
      try {
        const state = await printerAPI.getConnectionStatus();
        setConnState(state);
      } catch (e) {
        console.error('Failed to load connection state:', e);
      }
    };

    loadState();
    interval = window.setInterval(loadState, 3000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleConnectSimulator = async () => {
    setConnecting(true);
    try {
      await printerAPI.connect('simulator');
      onConnectionChange();
    } catch (e) {
      console.error('Failed to connect simulator:', e);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectWebUSB = async () => {
    const device = await requestDevice();
    if (device) {
      await connectDevice(device);
      setConnecting(true);
      try {
        await printerAPI.connect('webusb');
        onConnectionChange();
      } catch (e) {
        console.error('Failed to connect:', e);
      } finally {
        setConnecting(false);
      }
    }
  };

  const handleDisconnect = async () => {
    if (selectedDevice) {
      await disconnectDevice();
    }
    try {
      await printerAPI.disconnect();
      onConnectionChange();
    } catch (e) {
      console.error('Failed to disconnect:', e);
    }
  };

  const status = connState?.status || 'disconnected';
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          onClick={onStartSimulation}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            connState?.connected
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {status === 'connecting' || status === 'reconnecting' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : connState?.connected ? (
            <Activity className="w-4 h-4" />
          ) : (
            <Server className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {connState?.connected ? '模拟器' : '连接'}
          </span>
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              connState?.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            )}
          />
        </button>

        {connState && connState.connected && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[240px] z-50">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">状态:</span>
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.className)}>
                  {config.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">连接类型:</span>
                <span className="text-gray-700">
                  {connState.type === 'simulator' ? '模拟器' : connState.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">延迟:</span>
                <span className="text-gray-700 font-mono">{connState.latencyMs}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">心跳:</span>
                <span className="text-gray-700">#{connState.heartbeatCount}</span>
              </div>
              {connState.reconnectTries > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">重连:</span>
                  <span className="text-yellow-600">{connState.reconnectTries}/5</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  最后心跳: {new Date(connState.lastHeartbeat).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!connState?.connected ? (
        <button
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Usb className="w-4 h-4" />
          <span className="text-sm font-medium">WebUSB</span>
        </button>
      ) : (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
        >
          <PowerOff className="w-4 h-4" />
          <span className="text-sm font-medium">断开</span>
        </button>
      )}

      <div className="hidden">
        {selectedDevice && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-700">USB设备:</p>
            <p className="text-gray-600">
              {selectedDevice.product || '未知设备'}
            </p>
            {selectedDevice.manufacturer && (
              <p className="text-gray-500">{selectedDevice.manufacturer}</p>
            )}
            {selectedDevice.serialNumber && (
              <p className="text-gray-500 text-xs">SN: {selectedDevice.serialNumber}</p>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2">
          {!connectionStatus?.connected ? (
            <>
              <button
                onClick={handleConnectSimulator}
                disabled={connecting}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <Power className="w-4 h-4" />
                连接模拟器
              </button>
              <button
                onClick={handleConnectWebUSB}
                disabled={connecting || !isSupported}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <Usb className="w-4 h-4" />
                WebUSB
              </button>
            </>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <PowerOff className="w-4 h-4" />
              断开连接
            </button>
          )}
        </div>

        {!isSupported && (
          <p className="text-orange-600 text-xs text-center">
            您的浏览器不支持WebUSB，请使用Chrome或Edge浏览器
          </p>
        )}

        {devices.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">已配对设备 ({devices.length}):</p>
            <div className="space-y-1">
              {devices.map((d, i) => (
                <div key={i} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  {d.product || '未知设备'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
