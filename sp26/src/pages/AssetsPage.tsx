import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  Package,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AssetCard } from '@/components/UI/AssetCard';
import { Button } from '@/components/UI/Button';
import { StatusBadge } from '@/components/UI/StatusBadge';
import { assetService } from '@/services/assetService';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { AssetStatus } from '../../shared/types';
import { AssetStatusLabels } from '../../shared/types';

type ViewMode = 'grid' | 'list';

const statusFilters: { value: AssetStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'maintenance', label: '维修中' },
  { value: 'scrapped', label: '报废' },
];

export default function AssetsPage() {
  const isAdmin = useAuth().isAdmin();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: ['assets', searchQuery, statusFilter, categoryFilter, page],
    queryFn: () =>
      assetService.getAssets({
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        page,
        limit,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => assetService.getCategories(),
  });

  const assets = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资产管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {data?.total || 0} 项资产
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
          >
            新增资产
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="搜索资产名称、位置..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-3 rounded-xl border transition-colors',
            showFilters ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
        >
          <SlidersHorizontal size={20} />
        </button>
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2.5 transition-colors',
              viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            )}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2.5 transition-colors',
              viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            )}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5 overflow-hidden"
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">状态筛选</p>
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => { setStatusFilter(filter.value); setPage(1); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        statusFilter === filter.value
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {categories && categories.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">分类筛选</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setCategoryFilter('all'); setPage(1); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        categoryFilter === 'all'
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      全部
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setPage(1); }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          categoryFilter === cat
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className={cn(
          'grid gap-4',
          viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-soft overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={36} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">未找到资产</h3>
          <p className="text-gray-500">尝试调整搜索条件或筛选器</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset, index) => (
            <AssetCard key={asset.uid} asset={asset} delay={index * 0.05} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-50">
          {assets.map((asset, index) => (
            <motion.div
              key={asset.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{asset.name}</p>
                  <StatusBadge status={asset.status} size="sm" />
                </div>
                <p className="text-sm text-gray-500 truncate">{asset.location}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs text-gray-400">{asset.category}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
