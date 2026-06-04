import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  FileText, 
  Calendar, 
  User, 
  MapPin, 
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  PieChart,
  Activity,
  Eye,
  CheckCircle,
  Edit,
  Trash2,
  Upload,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { lifecycleService } from '@/services/lifecycleService';
import type { 
  AssetLifecycleLog, 
  LifecycleAction,
  ReportData,
  AssetStatus,
  LifecycleLogQueryParams,
} from '../../shared/types';
import { LifecycleActionLabels, AssetStatusLabels, AssetStatusColors } from '../../shared/types';

const actionColors: Record<LifecycleAction, string> = {
  scan: 'bg-blue-100 text-blue-800',
  inventory: 'bg-green-100 text-green-800',
  status_change: 'bg-yellow-100 text-yellow-800',
  location_update: 'bg-purple-100 text-purple-800',
  write_tag: 'bg-indigo-100 text-indigo-800',
  lock_tag: 'bg-gray-100 text-gray-800',
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-orange-100 text-orange-800',
  delete: 'bg-red-100 text-red-800',
  import: 'bg-cyan-100 text-cyan-800',
  export: 'bg-teal-100 text-teal-800',
};

const actionIcons: Record<LifecycleAction, React.ReactNode> = {
  scan: <Eye className="w-4 h-4" />,
  inventory: <CheckCircle className="w-4 h-4" />,
  status_change: <Tag className="w-4 h-4" />,
  location_update: <MapPin className="w-4 h-4" />,
  write_tag: <Edit className="w-4 h-4" />,
  lock_tag: <Lock className="w-4 h-4" />,
  create: <FileText className="w-4 h-4" />,
  update: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  import: <Upload className="w-4 h-4" />,
  export: <Download className="w-4 h-4" />,
};

export default function LifecycleLogsPage() {
  const [logs, setLogs] = useState<AssetLifecycleLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [viewMode, setViewMode] = useState<'logs' | 'report'>('logs');
  
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [filters, setFilters] = useState<LifecycleLogQueryParams>({
    action: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await lifecycleService.getLogs({
        page,
        limit,
        ...filters,
      });
      setLogs(result.items as AssetLifecycleLog[]);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  const fetchReport = useCallback(async () => {
    try {
      const result = await lifecycleService.getReport(
        filters.startDate,
        filters.endDate
      );
      setReport(result);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    if (viewMode === 'logs') {
      fetchLogs();
    } else {
      fetchReport();
    }
  }, [viewMode, page, filters, fetchLogs, fetchReport]);

  const handleExport = () => {
    lifecycleService.exportLogs(
      filters.assetUid,
      filters.startDate,
      filters.endDate
    );
  };

  const handleFilterChange = (key: keyof LifecycleLogQueryParams, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({
      action: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: AssetStatus) => {
    return AssetStatusColors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">资产生命周期</h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('logs')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'logs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                操作日志
              </button>
              <button
                onClick={() => setViewMode('report')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'report'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PieChart className="w-4 h-4 inline mr-2" />
                统计报表
              </button>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              导出CSV
            </button>
          </div>
        </div>
        <p className="text-gray-600">查看所有资产的操作记录和统计报表</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            筛选条件
          </button>
          <button
            onClick={viewMode === 'logs' ? fetchLogs : fetchReport}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          {(filters.action || filters.startDate || filters.endDate) && (
            <button
              onClick={resetFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              重置筛选
            </button>
          )}
        </div>

        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-50 rounded-lg p-4 mb-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">全部</option>
                  {Object.entries(LifecycleActionLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {viewMode === 'logs' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">暂无操作记录</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        资产
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作人
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        位置
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        变更
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        备注
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {formatDate(log.performedAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.asset?.name || log.assetUid}
                            </div>
                            <div className="text-xs text-gray-500">
                              UID: {log.assetUid}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${actionColors[log.action]}`}>
                            {actionIcons[log.action]}
                            <span className="ml-1">{LifecycleActionLabels[log.action]}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            {log.user?.name || '未知用户'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.location?.gps ? (
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                              {log.location.gps.lat.toFixed(4)}, {log.location.gps.lng.toFixed(4)}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.oldValue || log.newValue ? (
                            <div className="text-sm">
                              {log.oldValue && (
                                <span className="text-red-600 line-through mr-2">
                                  {AssetStatusLabels[log.oldValue as AssetStatus] || log.oldValue}
                                </span>
                              )}
                              {log.oldValue && log.newValue && <span className="text-gray-400">→</span>}
                              {log.newValue && (
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.newValue as AssetStatus)}`}>
                                  {AssetStatusLabels[log.newValue as AssetStatus] || log.newValue}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{log.note || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  共 {total} 条记录，第 {page} / {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600 px-2">{page}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          {report ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">扫码次数</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{report.totalScans}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Eye className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">盘点次数</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{report.totalInventory}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">状态变更</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{report.statusChanges}</p>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Tag className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">位置更新</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{report.locationUpdates}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <MapPin className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">操作类型分布</h3>
                  <div className="space-y-3">
                    {report.byAction.map((item, index) => (
                      <motion.div
                        key={item.action}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center"
                      >
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-24 ${actionColors[item.action]}`}>
                          {LifecycleActionLabels[item.action]}
                        </span>
                        <div className="ml-3 flex-1 bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${
                              actionColors[item.action].includes('blue') ? 'bg-blue-600' :
                              actionColors[item.action].includes('green') ? 'bg-green-600' :
                              actionColors[item.action].includes('yellow') ? 'bg-yellow-600' :
                              actionColors[item.action].includes('purple') ? 'bg-purple-600' :
                              'bg-gray-600'
                            }`}
                            style={{
                              width: `${(item.count / Math.max(...report.byAction.map(i => i.count))) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-700 w-12 text-right">
                          {item.count}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">活跃用户排行</h3>
                  <div className="space-y-3">
                    {report.byUser.map((item, index) => (
                      <motion.div
                        key={item.userId}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center"
                      >
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="ml-3 text-sm font-medium text-gray-900 w-32">
                          {item.userName}
                        </span>
                        <div className="ml-3 flex-1 bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-primary-600 h-2.5 rounded-full"
                            style={{
                              width: `${(item.count / Math.max(...report.byUser.map(i => i.count))) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-700 w-12 text-right">
                          {item.count}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">状态变更统计</h3>
                  <div className="space-y-3">
                    {report.byStatus.map((item, index) => (
                      <motion.div
                        key={item.status}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                          {AssetStatusLabels[item.status] || item.status}
                        </span>
                        <span className="text-xl font-bold text-gray-900">{item.count}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">报表时间范围</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm text-gray-600">开始时间</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(report.dateRange.start)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm text-gray-600">结束时间</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(report.dateRange.end)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
              <p className="mt-2 text-gray-500">加载报表中...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
