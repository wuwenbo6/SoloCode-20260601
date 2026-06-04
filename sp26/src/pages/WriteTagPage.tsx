import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Type,
  Link,
  FileCode,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Search,
  X,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NFCScanButton } from '@/components/UI/NFCScanButton';
import { Button } from '@/components/UI/Button';
import { StatusBadge } from '@/components/UI/StatusBadge';
import { useNFC } from '@/hooks/useNFC';
import { useAuth } from '@/hooks/useAuth';
import { assetService } from '@/services/assetService';
import { cn } from '@/lib/utils';
import type { Asset, AssetStatus } from '../../shared/types';

type WriteType = 'text' | 'url' | 'custom' | 'asset';

interface WriteOption {
  type: WriteType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const writeOptions: WriteOption[] = [
  { type: 'asset', label: '资产ID', icon: <Tag size={20} />, description: '写入资产唯一标识' },
  { type: 'text', label: '纯文本', icon: <Type size={20} />, description: '写入普通文本信息' },
  { type: 'url', label: '链接', icon: <Link size={20} />, description: '写入网址链接' },
  { type: 'custom', label: '自定义', icon: <FileCode size={20} />, description: '写入自定义数据' },
];

export default function WriteTagPage() {
  const { isSupported, isAvailable, writeText, writeUrl, writeTag, error, clearError } = useNFC();
  const { isAdmin: checkIsAdmin } = useAuth();
  const [selectedType, setSelectedType] = useState<WriteType>('asset');
  const [assetUid, setAssetUid] = useState('');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [customRecords, setCustomRecords] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [writeSuccess, setWriteSuccess] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [writeProgress, setWriteProgress] = useState(0);

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets-search', searchQuery],
    queryFn: () => assetService.searchAssets(searchQuery, { limit: 20 }),
    enabled: showAssetPicker && searchQuery.length > 0,
  });

  useEffect(() => {
    if (error) {
      setWriteError(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSelectAsset = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setAssetUid(asset.uid);
    setShowAssetPicker(false);
  }, []);

  const handleWrite = useCallback(async () => {
    if (!isSupported || !isAvailable) return;

    let content = '';
    let isValid = true;

    switch (selectedType) {
      case 'asset':
        if (!assetUid.trim()) {
          setWriteError('请输入或选择资产ID');
          isValid = false;
        } else {
          content = assetUid.trim();
        }
        break;
      case 'text':
        if (!textContent.trim()) {
          setWriteError('请输入文本内容');
          isValid = false;
        } else {
          content = textContent.trim();
        }
        break;
      case 'url':
        if (!urlContent.trim()) {
          setWriteError('请输入URL地址');
          isValid = false;
        } else {
          try {
            new URL(urlContent);
            content = urlContent.trim();
          } catch {
            setWriteError('请输入有效的URL地址');
            isValid = false;
          }
        }
        break;
      case 'custom':
        if (!customRecords.trim()) {
          setWriteError('请输入自定义记录');
          isValid = false;
        } else {
          try {
            JSON.parse(customRecords);
          } catch {
            setWriteError('自定义记录必须是有效的JSON格式');
            isValid = false;
          }
        }
        break;
    }

    if (!isValid) return;

    setIsWriting(true);
    setWriteError(null);
    setWriteSuccess(false);
    setWriteProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setWriteProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      switch (selectedType) {
        case 'asset':
        case 'text':
          await writeText(content);
          break;
        case 'url':
          await writeUrl(content);
          break;
        case 'custom':
          const records = JSON.parse(customRecords);
          await writeTag({ records });
          break;
      }

      clearInterval(progressInterval);
      setWriteProgress(100);
      setWriteSuccess(true);

      setTimeout(() => {
        setWriteSuccess(false);
        setWriteProgress(0);
        if (selectedType === 'asset' && selectedAsset) {
          setSelectedAsset(null);
          setAssetUid('');
        }
      }, 3000);
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : '写入失败');
    } finally {
      setIsWriting(false);
    }
  }, [selectedType, assetUid, textContent, urlContent, customRecords, isSupported, isAvailable, writeText, writeUrl, writeTag, selectedAsset]);

  const handleClear = useCallback(() => {
    setTextContent('');
    setUrlContent('');
    setCustomRecords('');
    setAssetUid('');
    setSelectedAsset(null);
    setWriteError(null);
    setWriteSuccess(false);
    setWriteProgress(0);
  }, []);

  const renderContentInput = () => {
    switch (selectedType) {
      case 'asset':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">资产ID</label>
            <div className="relative">
              <input
                type="text"
                value={assetUid}
                onChange={(e) => {
                  setAssetUid(e.target.value);
                  setSelectedAsset(null);
                }}
                placeholder="输入资产ID或点击选择"
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowAssetPicker(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {selectedAsset && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary-50 border border-primary-200 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Tag size={20} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{selectedAsset.name}</p>
                    <p className="text-xs text-gray-500 truncate">ID: {selectedAsset.uid}</p>
                  </div>
                  <StatusBadge status={selectedAsset.status as AssetStatus} size="sm" />
                </div>
              </motion.div>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">文本内容</label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="输入要写入的文本内容..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              rows={4}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 text-right">{textContent.length}/200</p>
          </div>
        );

      case 'url':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">URL地址</label>
            <input
              type="url"
              value={urlContent}
              onChange={(e) => setUrlContent(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            <div className="flex gap-2 flex-wrap">
              {['https://www.baidu.com', 'https://github.com', 'https://www.google.com'].map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setUrlContent(url)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
                >
                  {url}
                </button>
              ))}
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">自定义记录 (JSON)</label>
            <textarea
              value={customRecords}
              onChange={(e) => setCustomRecords(e.target.value)}
              placeholder={`[\n  {\n    "recordType": "text",\n    "lang": "zh-CN",\n    "data": "示例文本"\n  }\n]`}
              className="w-full px-4 py-3 bg-gray-900 text-green-400 border border-gray-700 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              rows={8}
            />
            <p className="text-xs text-gray-400">输入NDEF记录数组的JSON格式</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">写入标签</h1>
          <p className="text-sm text-gray-500 mt-1">将数据写入NFC标签</p>
        </div>
      </div>

      <AnimatePresence>
        {writeSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-success-50 border border-success-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="text-success-500 flex-shrink-0" size={20} />
              <p className="text-success-700 text-sm">写入成功!</p>
            </div>
          </motion.div>
        )}

        {writeError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger-50 border border-danger-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-danger-500 flex-shrink-0" size={20} />
              <p className="text-danger-700 text-sm">{writeError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(!isSupported || !isAvailable) && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-warning-500 flex-shrink-0" size={20} />
            <div>
              <p className="text-warning-700 font-medium">NFC不可用</p>
              <p className="text-warning-600 text-sm">
                {!isSupported ? '您的浏览器不支持NFC功能' : 'NFC功能当前不可用'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag size={18} className="text-primary-500" />
          写入类型
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {writeOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => {
                setSelectedType(option.type);
                setWriteError(null);
              }}
              className={cn(
                'flex flex-col items-start gap-2 p-4 rounded-xl transition-all duration-200 text-left',
                selectedType === option.type
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                selectedType === option.type
                  ? 'bg-white/20'
                  : 'bg-white'
              )}>
                {option.icon}
              </div>
              <div>
                <p className={cn(
                  'font-medium',
                  selectedType === option.type ? 'text-white' : 'text-gray-900'
                )}>
                  {option.label}
                </p>
                <p className={cn(
                  'text-xs',
                  selectedType === option.type ? 'text-white/70' : 'text-gray-500'
                )}>
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
        {renderContentInput()}
      </div>

      {isWriting && writeProgress > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">写入进度</span>
            <span className="text-sm text-gray-500">{writeProgress}%</span>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${writeProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      <div className="flex justify-center py-6">
        <NFCScanButton
          isScanning={isWriting}
          isSupported={isSupported}
          isAvailable={isAvailable}
          scanSuccess={writeSuccess}
          onClick={handleWrite}
          disabled={isWriting || !isSupported || !isAvailable}
          size="xl"
          label={
            isWriting ? '正在写入...' :
            writeSuccess ? '写入成功!' :
            '点击开始写入'
          }
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm">
            <p className="font-medium text-blue-700 mb-1">写入提示</p>
            <ul className="text-blue-600 space-y-1">
              <li>• 将NFC标签靠近手机背部NFC区域</li>
              <li>• 保持标签稳定，直到写入完成</li>
              <li>• 确保标签有足够的存储空间</li>
              <li>• 某些标签可能需要先解锁才能写入</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={handleClear}
          disabled={isWriting}
        >
          清空内容
        </Button>
      </div>

      <AnimatePresence>
        {showAssetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setShowAssetPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">选择资产</h3>
                  <button
                    onClick={() => setShowAssetPicker(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索资产名称或ID..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-96">
                {assetsLoading ? (
                  <div className="p-8 text-center">
                    <Loader2 size={32} className="mx-auto text-primary-500 animate-spin mb-3" />
                    <p className="text-gray-500">搜索中...</p>
                  </div>
                ) : assets && assets.items.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {assets.items.map((asset) => (
                      <button
                        key={asset.uid}
                        onClick={() => handleSelectAsset(asset)}
                        className="w-full p-4 hover:bg-gray-50 transition-colors flex items-center gap-3 text-left"
                      >
                        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Tag size={18} className="text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{asset.name}</p>
                          <p className="text-xs text-gray-500 truncate">{asset.uid}</p>
                        </div>
                        <StatusBadge status={asset.status as AssetStatus} size="sm" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length > 0 ? (
                  <div className="p-8 text-center">
                    <Search size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">未找到匹配的资产</p>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Tag size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">输入关键词搜索资产</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
