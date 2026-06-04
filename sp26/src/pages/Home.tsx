import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  MapPin,
  Wifi,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NFCScanButton } from '@/components/UI/NFCScanButton';
import { StatusBadge } from '@/components/UI/StatusBadge';
import { Button } from '@/components/UI/Button';
import { useNFC } from '@/hooks/useNFC';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useScanStore } from '@/store/scanStore';
import { useOfflineStore } from '@/store/offlineStore';
import { assetService } from '@/services/assetService';
import { inventoryService } from '@/services/inventoryService';
import { offlineSyncService } from '@/services/offlineSyncService';
import { formatDate, formatCurrency, formatLatLng } from '@/utils/format';
import type { Asset, AssetStatus, NFCReadResult } from '../../shared/types';

const statusIcons: Record<AssetStatus, string> = {
  in_use: '📱',
  idle: '📦',
  maintenance: '🔧',
  scrapped: '🗑️',
};

export default function Home() {
  const { isScanning, isSupported, isAvailable, startScan, stopScan, error, clearError, lastRead } = useNFC();
  const { position, getCurrent, isWatching, startWatching, stopWatching } = useGeolocation({ watch: false });
  const { devices, startScan: startBluetoothScan, isScanning: isBluetoothScanning } = useBluetooth({ autoStop: true, scanDuration: 5000 });
  const { currentAsset, setCurrentAsset, setError: setScanError, clearScannedItems } = useScanStore();
  const { isOnline } = useOfflineStore();
  const [scanSuccess, setScanSuccess] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['assets-stats'],
    queryFn: () => assetService.getStats(),
    refetchInterval: 30000,
  });

  const { data: locationData } = useQuery({
    queryKey: ['current-location'],
    queryFn: async () => {
      try {
        const pos = await getCurrent();
        return pos;
      } catch {
        return null;
      }
    },
    enabled: false,
  });

  useEffect(() => {
    if (lastRead) {
      handleScanSuccess(lastRead);
    }
  }, [lastRead]);

  const handleScanSuccess = useCallback(async (result: NFCReadResult) => {
    try {
      const asset = await assetService.getAssetByUid(result.uid);
      setCurrentAsset(asset);
      setScanSuccess(true);
      stopScan();
      startBluetoothScan();
      getCurrent();
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未找到对应资产';
      setScanError(errorMessage);
      setCurrentAsset(null);
    }
  }, [setCurrentAsset, setScanError, stopScan, startBluetoothScan, getCurrent]);

  const handleStartScan = useCallback(async () => {
    if (isScanning) {
      stopScan();
      return;
    }

    clearError();
    setScanError(null);
    setCurrentAsset(null);
    setScanSuccess(false);

    try {
      await startScan(
        (result) => handleScanSuccess(result),
        (err) => setScanError(err.message)
      );
      startWatching();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '扫描启动失败');
    }
  }, [isScanning, stopScan, clearError, setScanError, setCurrentAsset, startScan, startWatching, handleScanSuccess]);

  const handleUpdateStatus = useCallback(async (newStatus: AssetStatus) => {
    if (!currentAsset) return;

    setUpdatingStatus(true);
    setUpdateSuccess(false);

    try {
      const location = position ? {
        gps: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
        },
        beacons: devices,
      } : undefined;

      if (isOnline) {
        await inventoryService.createInventoryRecord(
          currentAsset.uid,
          newStatus,
          location,
          '快速更新状态'
        );
        await assetService.updateAsset(currentAsset.uid, { status: newStatus });
      } else {
        await offlineSyncService.addToQueue('inventory', {
          assetUid: currentAsset.uid,
          status: newStatus,
          location,
          note: '快速更新状态',
        });
        await offlineSyncService.addToQueue('asset_update', {
          uid: currentAsset.uid,
          data: { status: newStatus },
        });
      }

      setCurrentAsset({ ...currentAsset, status: newStatus });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '更新状态失败');
    } finally {
      setUpdatingStatus(false);
    }
  }, [currentAsset, position, devices, isOnline, setCurrentAsset, setScanError]);

  useEffect(() => {
    return () => {
      stopScan();
      stopWatching();
      clearScannedItems();
    };
  }, [stopScan, stopWatching, clearScannedItems]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFC扫描</h1>
          <p className="text-sm text-gray-500 mt-1">扫描标签查看资产信息</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
            isOnline 
              ? 'bg-success-50 text-success-600' 
              : 'bg-warning-50 text-warning-600'
          }`}>
            {isOnline ? <Wifi size={14} /> : <AlertCircle size={14} />}
            {isOnline ? '在线' : '离线'}
          </span>
        </div>
      </div>

      <div className="flex justify-center py-8">
        <NFCScanButton
          isScanning={isScanning}
          isSupported={isSupported}
          isAvailable={isAvailable}
          scanSuccess={scanSuccess}
          onClick={handleStartScan}
          size="xl"
        />
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger-50 border border-danger-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-danger-500 flex-shrink-0" size={20} />
              <p className="text-danger-700 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {updateSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-success-50 border border-success-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="text-success-500 flex-shrink-0" size={20} />
              <p className="text-success-700 text-sm">状态更新成功!</p>
            </div>
          </motion.div>
        )}

        {currentAsset && (
          <motion.div
            key="asset-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden"
          >
            <div className="relative h-48 bg-gradient-to-br from-primary-50 to-primary-100">
              {currentAsset.imageUrl ? (
                <img
                  src={currentAsset.imageUrl}
                  alt={currentAsset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl">{statusIcons[currentAsset.status]}</span>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <StatusBadge status={currentAsset.status} size="md" animated />
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{currentAsset.name}</h3>
                <p className="text-sm text-gray-500 mt-1">ID: {currentAsset.uid}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">分类</p>
                  <p className="font-medium text-gray-900 mt-0.5">{currentAsset.category}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">位置</p>
                  <p className="font-medium text-gray-900 mt-0.5 truncate">{currentAsset.location}</p>
                </div>
                {currentAsset.purchasePrice && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">价值</p>
                    <p className="font-medium text-primary-600 mt-0.5">{formatCurrency(currentAsset.purchasePrice)}</p>
                  </div>
                )}
                {currentAsset.lastInventoryAt && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">上次盘点</p>
                    <p className="font-medium text-gray-900 mt-0.5">{formatDate(currentAsset.lastInventoryAt, 'MM-DD HH:mm')}</p>
                  </div>
                )}
              </div>

              {currentAsset.description && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">描述</p>
                  <p className="text-sm text-gray-700">{currentAsset.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">快速更新状态</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['in_use', 'idle', 'maintenance', 'scrapped'] as AssetStatus[]).map((status) => (
                    <Button
                      key={status}
                      variant={currentAsset.status === status ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleUpdateStatus(status)}
                      isLoading={updatingStatus}
                      disabled={currentAsset.status === status}
                    >
                      {statusIcons[status]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MapPin size={18} className="text-primary-500" />
          当前位置
        </h3>
        <div className="space-y-3">
          {position ? (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">GPS坐标</span>
                <span className="font-mono text-sm text-gray-900">
                  {formatLatLng(position.lat, position.lng)}
                </span>
              </div>
              {position.accuracy && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">精度</span>
                  <span className="text-sm text-gray-900">±{Math.round(position.accuracy)}米</span>
                </div>
              )}
              {position.timestamp && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">更新时间</span>
                  <span className="text-sm text-gray-900">{formatDate(position.timestamp, 'HH:mm:ss')}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">正在获取位置...</p>
              </div>
            </div>
          )}
        </div>

        {devices.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">附近蓝牙信标 ({devices.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {devices.slice(0, 3).map((beacon) => (
                <div key={beacon.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600 truncate flex-1">
                    {beacon.name || beacon.id.slice(0, 8)}
                  </span>
                  <span className="text-xs font-mono text-gray-500 ml-2">{beacon.rssi} dBm</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Package size={18} className="text-primary-500" />
          资产统计
        </h3>
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-12 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-4 text-white"
            >
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm opacity-80">总资产</p>
            </motion.div>
            {(['in_use', 'idle', 'maintenance', 'scrapped'] as AssetStatus[]).map((status, index) => (
              <motion.div
                key={status}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 1) * 0.1 }}
                className="bg-white rounded-xl p-4"
              >
                <p className="text-2xl font-bold text-gray-900">{stats.byStatus[status] || 0}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <span>{statusIcons[status]}</span>
                  {status === 'in_use' ? '在用' : status === 'idle' ? '闲置' : status === 'maintenance' ? '维修中' : '报废'}
                </p>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<RefreshCw size={18} />}
          onClick={() => {
            getCurrent();
            startBluetoothScan();
          }}
          isLoading={isWatching || isBluetoothScanning}
        >
          刷新位置
        </Button>
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<Clock size={18} />}
          onClick={() => {
            setCurrentAsset(null);
            clearError();
            setScanError(null);
          }}
        >
          清除结果
        </Button>
      </div>
    </div>
  );
}
