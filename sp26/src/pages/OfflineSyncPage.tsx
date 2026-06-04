import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Package,
  MapPin,
  ClipboardList,
  ArrowUpDown,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/UI/Button';
import { useOfflineStore } from '@/store/offlineStore';
import { offlineSyncService } from '@/services/offlineSyncService';
import { formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { SyncQueueItem, SyncQueueType } from '../../shared/types';

const typeConfig: Record<SyncQueueType, { icon: React.ReactNode; label: string; color: string }> = {
  asset_update: { icon: <Package size={16} />, label: '资产更新', color: 'bg-blue-100 text-blue-700' },
  inventory: { icon: <ClipboardList size={16} />, label: '盘点记录', color: 'bg-green-100 text-green-700' },
  location: { icon: <MapPin size={16} />, label: '位置跟踪', color: 'bg-purple-100 text-purple-700' },
  batch_inventory: { icon: <ClipboardList size={16} />, label: '批量盘点', color: 'bg-orange-100 text-orange-700' },
};

export default function OfflineSyncPage() {
  const { queue, isOnline, isSyncing, lastSyncAt } = useOfflineStore();
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());

  const groupedQueue = queue.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<SyncQueueType, SyncQueueItem[]>);

  const handleSyncAll = useCallback(async () => {
    if (!isOnline || queue.length === 0) return;

    for (const item of queue) {
      setSyncingItems(prev => new Set(prev).add(item.id));
    }

    try {
      await offlineSyncService.sync();
    } catch (err) {
      console.error('同步失败:', err);
    } finally {
      setSyncingItems(new Set());
    }
  }, [isOnline, queue]);

  const handleSyncItem = useCallback(async (item: SyncQueueItem) => {
    if (!isOnline) return;

    setSyncingItems(prev => new Set(prev).add(item.id));

    try {
      await offlineSyncService.syncItem(item.id);
      setSyncResults(prev => {
        const next = new Map(prev);
        next.set(item.id, { success: true, message: '同步成功' });
        return next;
      });
    } catch (err) {
      setSyncResults(prev => {
        const next = new Map(prev);
        next.set(item.id, { success: false, message: err instanceof Error ? err.message : '同步失败' });
        return next;
      });
    } finally {
      setSyncingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [isOnline]);

  const handleDeleteItem = useCallback(async (id: string) => {
    await offlineSyncService.removeFromQueue(id);
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">离线同步</h1>
          <p className="text-sm text-gray-500 mt-1">管理离线数据和同步队列</p>
        </div>
      </div>

      <div className={cn(
        'rounded-2xl p-5',
        isOnline
          ? 'bg-gradient-to-r from-success-500 to-success-600 text-white'
          : 'bg-gradient-to-r from-warning-500 to-warning-600 text-white'
      )}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            {isOnline ? <Wifi size={28} /> : <WifiOff size={28} />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{isOnline ? '已连接' : '离线模式'}</h3>
            <p className="text-sm opacity-80">
              {isOnline ? '网络正常，可以同步数据' : '网络不可用，操作将保存在本地'}
            </p>
          </div>
          {lastSyncAt && (
            <div className="text-right text-sm opacity-80">
              <p>上次同步</p>
              <p className="font-medium">{formatDate(lastSyncAt, 'HH:mm:ss')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(typeConfig) as SyncQueueType[]).map((type) => {
          const config = typeConfig[type];
          const count = groupedQueue[type]?.length || 0;
          return (
            <div key={type} className="bg-white rounded-xl p-4 shadow-soft border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.color)}>
                  {config.icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {queue.length > 0 && (
        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={<ArrowUpDown size={18} className={isSyncing ? 'animate-spin' : ''} />}
            onClick={handleSyncAll}
            disabled={!isOnline || isSyncing}
            isLoading={isSyncing}
          >
            {isOnline ? `同步全部 (${queue.length} 项)` : '离线无法同步'}
          </Button>
          <Button
            variant="danger"
            leftIcon={<Trash2 size={18} />}
            onClick={async () => { await offlineSyncService.clearQueue(); }}
            disabled={queue.length === 0}
          >
            清空
          </Button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-primary-500" />
            同步队列
          </h3>
        </div>

        {queue.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success-500" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">队列已清空</h4>
            <p className="text-sm text-gray-500">所有数据已同步完成</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {queue.map((item, index) => {
              const config = typeConfig[item.type];
              const isSyncingThis = syncingItems.has(item.id);
              const result = syncResults.get(item.id);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.color)}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{config.label}</span>
                        {item.retryCount > 0 && (
                          <span className="text-xs text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">
                            重试 {item.retryCount} 次
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(item.createdAt)}</p>
                      {item.error && (
                        <p className="text-xs text-danger-500 mt-0.5">{item.error}</p>
                      )}
                      {result && (
                        <p className={cn('text-xs mt-0.5', result.success ? 'text-success-600' : 'text-danger-600')}>
                          {result.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw size={14} className={isSyncingThis ? 'animate-spin' : ''} />}
                        onClick={() => handleSyncItem(item)}
                        disabled={!isOnline || isSyncingThis}
                        isLoading={isSyncingThis}
                      >
                        同步
                      </Button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {!isOnline && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-warning-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-medium text-warning-700 mb-1">离线提示</p>
              <ul className="text-warning-600 space-y-1">
                <li>• 当前处于离线状态，所有操作将保存在本地</li>
                <li>• 连接网络后，请手动点击同步按钮</li>
                <li>• 同步冲突时需要手动选择保留版本</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
