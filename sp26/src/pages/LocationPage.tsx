import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Bluetooth,
  Crosshair,
  Radio,
  Clock,
  RefreshCw,
  Signal,
  Navigation,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/UI/Button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useBluetooth } from '@/hooks/useBluetooth';
import { locationService } from '@/services/locationService';
import { formatDate, formatLatLng } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { BeaconInfo } from '../../shared/types';

function getRssiLevel(rssi: number): { label: string; color: string; width: string } {
  if (rssi >= -40) return { label: '极强', color: 'bg-success-500', width: '100%' };
  if (rssi >= -60) return { label: '强', color: 'bg-success-500', width: '80%' };
  if (rssi >= -70) return { label: '中', color: 'bg-warning-500', width: '60%' };
  if (rssi >= -80) return { label: '弱', color: 'bg-warning-500', width: '40%' };
  return { label: '极弱', color: 'bg-danger-500', width: '20%' };
}

export default function LocationPage() {
  const { position, getCurrent, isWatching, startWatching, stopWatching, isLoading: geoLoading } = useGeolocation({ watch: true });
  const { devices, startScan: startBluetoothScan, stopScan: stopBluetoothScan, isScanning: isBluetoothScanning } = useBluetooth({ autoStop: true, scanDuration: 8000 });
  const [selectedBeacon, setSelectedBeacon] = useState<BeaconInfo | null>(null);

  const { data: locationHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['location-history'],
    queryFn: () => locationService.getRecentHistory(20),
  });

  const handleRefresh = useCallback(async () => {
    try {
      await getCurrent();
      await startBluetoothScan();
    } catch (err) {
      console.error('刷新位置失败:', err);
    }
  }, [getCurrent, startBluetoothScan]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">位置跟踪</h1>
          <p className="text-sm text-gray-500 mt-1">GPS定位与蓝牙信标信息</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw size={16} className={cn(geoLoading || isBluetoothScanning ? 'animate-spin' : '')} />}
          onClick={handleRefresh}
          isLoading={geoLoading}
        >
          刷新
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Crosshair size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">GPS定位</h3>
              <p className="text-sm opacity-80 flex items-center gap-1">
                <Navigation size={14} />
                {isWatching ? '实时跟踪中' : '位置服务'}
              </p>
            </div>
          </div>

          {position ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs opacity-70">纬度</p>
                <p className="font-mono font-medium">{position.lat.toFixed(6)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs opacity-70">经度</p>
                <p className="font-mono font-medium">{position.lng.toFixed(6)}</p>
              </div>
              {position.accuracy && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs opacity-70">精度</p>
                  <p className="font-medium">±{Math.round(position.accuracy)}米</p>
                </div>
              )}
              {position.timestamp && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs opacity-70">更新时间</p>
                  <p className="font-medium">{formatDate(position.timestamp, 'HH:mm:ss')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 opacity-70">
              <MapPin size={32} className="mx-auto mb-2" />
              <p>正在获取位置...</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bluetooth size={18} className="text-blue-500" />
            蓝牙信标
          </h3>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              isBluetoothScanning ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            )}>
              {isBluetoothScanning ? '扫描中...' : `${devices.length} 个信标`}
            </span>
            <Button
              variant={isBluetoothScanning ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => isBluetoothScanning ? stopBluetoothScan() : startBluetoothScan()}
            >
              {isBluetoothScanning ? '停止' : '扫描'}
            </Button>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8">
            <Radio size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {isBluetoothScanning ? '正在扫描附近蓝牙信标...' : '点击扫描按钮检测附近蓝牙信标'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {devices.map((beacon, index) => {
                const rssiLevel = getRssiLevel(beacon.rssi);
                return (
                  <motion.div
                    key={beacon.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'p-4 rounded-xl border-2 cursor-pointer transition-colors',
                      selectedBeacon?.id === beacon.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200'
                    )}
                    onClick={() => setSelectedBeacon(
                      selectedBeacon?.id === beacon.id ? null : beacon
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Signal size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-900 text-sm">
                          {beacon.name || `信标 ${beacon.id.slice(0, 8)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          rssiLevel.color === 'bg-success-500' ? 'bg-success-100 text-success-700' :
                          rssiLevel.color === 'bg-warning-500' ? 'bg-warning-100 text-warning-700' :
                          'bg-danger-100 text-danger-700'
                        )}>
                          {rssiLevel.label}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{beacon.rssi} dBm</span>
                      </div>
                    </div>

                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('absolute inset-y-0 left-0 rounded-full', rssiLevel.color)}
                        initial={{ width: 0 }}
                        animate={{ width: rssiLevel.width }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                      />
                    </div>

                    {selectedBeacon?.id === beacon.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 pt-3 border-t border-gray-200 space-y-2"
                      >
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">ID:</span>
                            <span className="ml-1 font-mono text-gray-700">{beacon.id}</span>
                          </div>
                          {beacon.uuid && (
                            <div>
                              <span className="text-gray-500">UUID:</span>
                              <span className="ml-1 font-mono text-gray-700 truncate">{beacon.uuid.slice(0, 8)}...</span>
                            </div>
                          )}
                          {beacon.major !== undefined && (
                            <div>
                              <span className="text-gray-500">Major:</span>
                              <span className="ml-1 text-gray-700">{beacon.major}</span>
                            </div>
                          )}
                          {beacon.minor !== undefined && (
                            <div>
                              <span className="text-gray-500">Minor:</span>
                              <span className="ml-1 text-gray-700">{beacon.minor}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-primary-500" />
          位置历史
        </h3>

        {historyLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : locationHistory && locationHistory.length > 0 ? (
          <div className="space-y-1">
            {locationHistory.map((track, index) => (
              <motion.div
                key={track._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin size={14} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {track.asset?.name || track.assetUid}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatDate(track.trackedAt, 'MM-DD HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {formatLatLng(track.gps.lat, track.gps.lng)}
                  </p>
                  {track.beacons.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {track.beacons.length} 个信标
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Clock size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">暂无位置历史记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
