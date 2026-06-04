import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  Trash2,
  Send,
  Clock,
  ScanLine,
  CheckCircle,
  AlertCircle,
  FileText,
  ChevronLeft,
  Tag,
} from 'lucide-react';
import { NFCScanButton } from '@/components/UI/NFCScanButton';
import { StatusBadge } from '@/components/UI/StatusBadge';
import { Button } from '@/components/UI/Button';
import { useNFC } from '@/hooks/useNFC';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useScanStore } from '@/store/scanStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useOfflineStore } from '@/store/offlineStore';
import { assetService } from '@/services/assetService';
import { inventoryService } from '@/services/inventoryService';
import { offlineSyncService } from '@/services/offlineSyncService';
import { formatDate, formatDuration } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Asset, AssetStatus, InventoryItem, NFCReadResult } from '../../shared/types';

const statusLabels: Record<AssetStatus, string> = {
  in_use: '在用',
  idle: '闲置',
  maintenance: '维修中',
  scrapped: '报废',
};

const statusColors: Record<AssetStatus, string> = {
  in_use: 'bg-success-500',
  idle: 'bg-gray-500',
  maintenance: 'bg-warning-500',
  scrapped: 'bg-danger-500',
};

export default function InventoryPage() {
  const { isScanning, isSupported, isAvailable, startScan, stopScan, lastRead } = useNFC();
  const { position, getCurrent } = useGeolocation({ watch: false });
  const { devices, startScan: startBluetoothScan, stopScan: stopBluetoothScan } = useBluetooth({ autoStop: false });
  const { scannedItems, addScannedItem, checkAndAddScannedItem, removeScannedItem, clearScannedItems, inventoryStatus, setInventoryStatus } = useScanStore();
  const { isSessionActive, startTime, startSession, endSession, incrementScanned, setLocation } = useInventoryStore();
  const { isOnline } = useOfflineStore();
  
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scannedAssets, setScannedAssets] = useState<Map<string, Asset>>(new Map());
  const [swipedItem, setSwipedItem] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastProcessedUIDRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (isSessionActive && startTime) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSessionActive, startTime]);

  useEffect(() => {
    if (lastRead && isSessionActive) {
      handleScanSuccess(lastRead);
    }
  }, [lastRead, isSessionActive]);

  const handleScanSuccess = useCallback(async (result: NFCReadResult) => {
    const uid = result.uid.trim().toUpperCase();
    const now = Date.now();
    
    const lastProcessed = lastProcessedUIDRef.current.get(uid);
    if (lastProcessed && now - lastProcessed < 3000) {
      return;
    }
    
    const checkResult = checkAndAddScannedItem(uid, result.idempotencyKey);
    if (checkResult.isDuplicate) {
      setDuplicateAlert(checkResult.reason || '该标签已扫描');
      setTimeout(() => setDuplicateAlert(null), 2000);
      
      try {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {}
      
      return;
    }
    
    lastProcessedUIDRef.current.set(uid, now);
    
    try {
      const asset = await assetService.getAssetByUid(result.uid);
      
      const added = addScannedItem({
        uid: result.uid,
        status: inventoryStatus,
        note: note || undefined,
      });
      
      if (added) {
        incrementScanned();
        
        setScannedAssets(prev => {
          const newMap = new Map(prev);
          newMap.set(result.uid, asset);
          return newMap;
        });
        
        try {
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        } catch {}
      }
    } catch (err) {
      console.error('获取资产信息失败:', err);
      lastProcessedUIDRef.current.delete(uid);
    }
  }, [checkAndAddScannedItem, addScannedItem, incrementScanned, inventoryStatus, note]);

  const handleStartSession = useCallback(() => {
    startSession();
    clearScannedItems();
    setScannedAssets(new Map());
    setNote('');
    setSubmitSuccess(false);
    setSubmitError(null);
    setElapsedTime(0);
    
    getCurrent().then(pos => {
      if (pos) {
        setLocation({
          gps: {
            lat: pos.lat,
            lng: pos.lng,
            accuracy: pos.accuracy,
          },
          beacons: devices,
        });
      }
    }).catch(() => {});
    
    startBluetoothScan();
  }, [startSession, clearScannedItems, getCurrent, setLocation, devices, startBluetoothScan]);

  const handleEndSession = useCallback(() => {
    stopScan();
    stopBluetoothScan();
    endSession();
  }, [stopScan, stopBluetoothScan, endSession]);

  const handleStartScan = useCallback(async () => {
    if (isScanning) {
      stopScan();
      return;
    }

    try {
      await startScan(
        (result) => handleScanSuccess(result),
        (err) => console.error('扫描错误:', err)
      );
    } catch (err) {
      console.error('启动扫描失败:', err);
    }
  }, [isScanning, stopScan, startScan, handleScanSuccess]);

  const handleSubmit = useCallback(async () => {
    if (scannedItems.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const location = position ? {
        gps: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
        },
        beacons: devices,
      } : undefined;

      const itemsWithNote = scannedItems.map(item => ({
        ...item,
        note: note || item.note,
      }));

      if (isOnline) {
        await inventoryService.submitScannedItems(itemsWithNote, location);
      } else {
        await offlineSyncService.addToQueue('batch_inventory', {
          items: itemsWithNote,
          location,
        });
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        clearScannedItems();
        setScannedAssets(new Map());
        setNote('');
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [scannedItems, position, devices, note, isOnline, clearScannedItems]);

  const handleSwipe = useCallback((uid: string, direction: 'left' | 'right') => {
    if (direction === 'left') {
      setSwipedItem(uid);
    } else {
      setSwipedItem(null);
    }
  }, []);

  const handleDeleteItem = useCallback((uid: string) => {
    removeScannedItem(uid);
    setScannedAssets(prev => {
      const newMap = new Map(prev);
      newMap.delete(uid);
      return newMap;
    });
    setSwipedItem(null);
  }, [removeScannedItem]);

  const progress = scannedItems.length > 0 ? (scannedItems.length / Math.max(scannedItems.length, 10)) * 100 : 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">批量盘点</h1>
          <p className="text-sm text-gray-500 mt-1">扫描多个标签进行批量盘点</p>
        </div>
        {!isSessionActive ? (
          <Button
            variant="primary"
            leftIcon={<Play size={18} />}
            onClick={handleStartSession}
          >
            开始盘点
          </Button>
        ) : (
          <Button
            variant="danger"
            leftIcon={<Square size={18} />}
            onClick={handleEndSession}
          >
            结束盘点
          </Button>
        )}
      </div>

      {isSessionActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-5 text-white overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <ScanLine size={20} className="animate-pulse" />
              </div>
              <div>
                <p className="font-medium">盘点进行中</p>
                <p className="text-sm opacity-80 flex items-center gap-1">
                  <Clock size={14} />
                  {formatDuration(elapsedTime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{scannedItems.length}</p>
              <p className="text-sm opacity-80">已扫描</p>
            </div>
          </div>
          
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-success-50 border border-success-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="text-success-500 flex-shrink-0" size={20} />
              <p className="text-success-700 text-sm">
                {isOnline ? '盘点记录已提交!' : '盘点记录已保存，联网后自动同步'}
              </p>
            </div>
          </motion.div>
        )}

        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger-50 border border-danger-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-danger-500 flex-shrink-0" size={20} />
              <p className="text-danger-700 text-sm">{submitError}</p>
            </div>
          </motion.div>
        )}

        {duplicateAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="bg-warning-50 border border-warning-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-warning-500 flex-shrink-0" size={20} />
              <p className="text-warning-700 text-sm">
                ⚠️ {duplicateAlert}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSessionActive && (
        <div className="flex justify-center py-4">
          <NFCScanButton
            isScanning={isScanning}
            isSupported={isSupported}
            isAvailable={isAvailable}
            onClick={handleStartScan}
            size="lg"
            label={isScanning ? '扫描中...' : '点击扫描标签'}
          />
        </div>
      )}

      {isSessionActive && (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag size={18} className="text-primary-500" />
            批量状态设置
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {(['in_use', 'idle', 'maintenance', 'scrapped'] as AssetStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setInventoryStatus(status)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200',
                  inventoryStatus === status
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  statusColors[status]
                )} />
                <span className="text-xs font-medium">{statusLabels[status]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isSessionActive && (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={18} className="text-primary-500" />
            备注
          </h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加盘点备注（可选）"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            rows={3}
          />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle size={18} className="text-primary-500" />
              已扫描标签
            </h3>
            <span className="text-sm text-gray-500">
              {scannedItems.length} 项
            </span>
          </div>
        </div>

        {scannedItems.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ScanLine size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500">
              {isSessionActive ? '点击上方按钮开始扫描' : '请先开始盘点会话'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {scannedItems.map((item, index) => {
              const asset = scannedAssets.get(item.uid);
              const isSwiped = swipedItem === item.uid;
              
              return (
                <motion.div
                  key={item.uid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative overflow-hidden"
                >
                  <div className="absolute inset-y-0 right-0 w-20 bg-danger-500 flex items-center justify-end pr-4">
                    <button
                      onClick={() => handleDeleteItem(item.uid)}
                      className="p-2 text-white"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  
                  <motion.div
                    className="relative bg-white p-4 cursor-grab active:cursor-grabbing"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(event, info) => {
                      if (info.offset.x < -80) {
                        handleSwipe(item.uid, 'left');
                      } else {
                        handleSwipe(item.uid, 'right');
                      }
                    }}
                    animate={{ x: isSwiped ? -80 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        statusColors[item.status]
                      )}>
                        <span className="text-white text-lg">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {asset?.name || item.uid}
                          </p>
                          <ChevronLeft size={14} className="text-gray-300 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          ID: {item.uid}
                        </p>
                        {item.note && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            备注: {item.note}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={item.status} size="sm" />
                        <span className="text-xs text-gray-400">
                          {formatDate(item.scannedAt, 'HH:mm:ss')}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {isSessionActive && scannedItems.length > 0 && (
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<Send size={20} />}
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={submitting || scannedItems.length === 0}
          >
            提交盘点记录 ({scannedItems.length} 项)
          </Button>
          
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<Trash2 size={18} />}
            onClick={() => {
              clearScannedItems();
              setScannedAssets(new Map());
            }}
            disabled={submitting}
          >
            清空已扫描
          </Button>
        </div>
      )}
    </div>
  );
}
