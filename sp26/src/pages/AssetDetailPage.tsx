import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Tag,
  DollarSign,
  Calendar,
  FileText,
  Trash2,
  Edit3,
  CheckCircle,
  AlertCircle,
  History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/UI/Button';
import { StatusBadge } from '@/components/UI/StatusBadge';
import { assetService } from '@/services/assetService';
import { inventoryService } from '@/services/inventoryService';
import { locationService } from '@/services/locationService';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatCurrency, formatLatLng } from '@/utils/format';
import type { AssetStatus } from '../../shared/types';
import { AssetStatusLabels } from '../../shared/types';

const statusIcons: Record<AssetStatus, string> = {
  in_use: '📱',
  idle: '📦',
  maintenance: '🔧',
  scrapped: '🗑️',
};

export default function AssetDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuth().isAdmin();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: asset, isLoading: assetLoading } = useQuery({
    queryKey: ['asset', uid],
    queryFn: () => assetService.getAssetByUid(uid!),
    enabled: !!uid,
  });

  const { data: inventoryRecords } = useQuery({
    queryKey: ['inventory-records', uid],
    queryFn: () => inventoryService.getRecordsByAsset(uid!),
    enabled: !!uid,
  });

  const { data: locationHistory } = useQuery({
    queryKey: ['location-history', uid],
    queryFn: () => locationService.getHistoryByAsset(uid!),
    enabled: !!uid,
  });

  if (assetLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-64 bg-gray-200 rounded-2xl mb-4" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-16">
        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">未找到资产</h3>
        <p className="text-gray-500 mb-4">该UID对应的资产不存在</p>
        <Button variant="primary" onClick={() => navigate('/')}>返回首页</Button>
      </div>
    );
  }

  const infoItems = [
    { icon: <Tag size={16} />, label: '分类', value: asset.category },
    { icon: <MapPin size={16} />, label: '位置', value: asset.location },
    { icon: <DollarSign size={16} />, label: '价值', value: asset.purchasePrice ? formatCurrency(asset.purchasePrice) : '-' },
    { icon: <Calendar size={16} />, label: '采购日期', value: asset.purchaseDate ? formatDate(asset.purchaseDate) : '-' },
    { icon: <Clock size={16} />, label: '上次盘点', value: asset.lastInventoryAt ? formatDate(asset.lastInventoryAt) : '-' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
          <p className="text-sm text-gray-500">UID: {asset.uid}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Edit3 size={14} />}>
              编辑
            </Button>
            <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
              删除
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="relative h-52 bg-gradient-to-br from-primary-50 to-primary-100">
          {asset.imageUrl ? (
            <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl">{statusIcons[asset.status]}</span>
            </div>
          )}
          <div className="absolute top-4 right-4">
            <StatusBadge status={asset.status} size="lg" animated />
          </div>
        </div>

        <div className="p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{asset.name}</h2>
          <p className="text-sm text-gray-500 mb-4">ID: {asset.uid}</p>

          {asset.description && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText size={14} />
                <span className="text-xs font-medium">描述</span>
              </div>
              <p className="text-sm text-gray-700">{asset.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {infoItems.map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="font-medium text-gray-900 text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History size={18} className="text-primary-500" />
          盘点记录
        </h3>
        {inventoryRecords && inventoryRecords.length > 0 ? (
          <div className="space-y-3">
            {inventoryRecords.slice(0, 10).map((record, index) => (
              <motion.div
                key={record._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={14} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={record.status} size="sm" />
                    {record.isOffline && (
                      <span className="text-xs text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">离线</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(record.scannedAt)}</p>
                  {record.note && <p className="text-xs text-gray-400 mt-0.5">{record.note}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <History size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无盘点记录</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-primary-500" />
          位置历史
        </h3>
        {locationHistory && locationHistory.length > 0 ? (
          <div className="space-y-3">
            {locationHistory.slice(0, 10).map((track, index) => (
              <motion.div
                key={track._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-700">
                    {formatLatLng(track.gps.lat, track.gps.lng)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(track.trackedAt)}</p>
                  {track.beacons.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {track.beacons.length} 个蓝牙信标
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <MapPin size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无位置记录</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={28} className="text-danger-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
                <p className="text-gray-500 text-sm mb-6">
                  确定要删除资产「{asset.name}」吗？此操作不可撤销。
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" fullWidth onClick={() => setShowDeleteConfirm(false)}>
                    取消
                  </Button>
                  <Button variant="danger" fullWidth onClick={async () => {
                    await assetService.deleteAsset(asset.uid);
                    navigate('/assets');
                  }}>
                    确认删除
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
