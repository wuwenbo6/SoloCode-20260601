import { useState, useEffect } from 'react';
import { History, Trash2, CheckCircle, XCircle, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { historyAPI } from '../services/api';
import type { PrintJob } from '../types';
import { formatDate, formatTime, cn } from '../utils';

interface PrintHistoryProps {
  refreshTrigger?: number;
}

export function PrintHistory({ refreshTrigger }: PrintHistoryProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const pageSize = 10;

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await historyAPI.getAll(pageSize, (page - 1) * pageSize);
      setJobs(result.jobs);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, refreshTrigger]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗?')) return;
    try {
      await historyAPI.delete(id);
      loadHistory();
    } catch (e) {
      console.error('Failed to delete job:', e);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusIcon = (job: PrintJob) => {
    if (job.status === 'printing') {
      return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
    }
    return job.success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getStatusText = (job: PrintJob) => {
    if (job.status === 'printing') return '打印中';
    return job.success ? '成功' : '失败';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <History className="w-5 h-5 text-primary-600" />
          打印历史
        </h3>
        <span className="text-sm text-gray-500">共 {total} 条记录</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>暂无打印记录</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">文件</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">状态</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">开始时间</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">耗时</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className={cn(
                      'border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors',
                      selectedJob?.id === job.id && 'bg-primary-50'
                    )}
                    onClick={() => setSelectedJob(job)}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                          {job.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job)}
                        <span className={cn(
                          'text-sm',
                          job.status === 'printing' ? 'text-blue-600' :
                          job.success ? 'text-green-600' : 'text-red-600'
                        )}>
                          {getStatusText(job)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-600">
                      {formatDate(job.start_time)}
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-600">
                      {job.duration ? formatTime(job.duration) : '-'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(job.id);
                        }}
                        className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedJob && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-gray-800">任务详情</h4>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">文件:</span>
                  <span className="ml-2 text-gray-800">{selectedJob.file_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">状态:</span>
                  <span className={cn(
                    'ml-2',
                    selectedJob.success ? 'text-green-600' : 'text-red-600'
                  )}>
                    {getStatusText(selectedJob)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">开始时间:</span>
                  <span className="ml-2 text-gray-800">{formatDate(selectedJob.start_time)}</span>
                </div>
                <div>
                  <span className="text-gray-500">结束时间:</span>
                  <span className="ml-2 text-gray-800">
                    {selectedJob.end_time ? formatDate(selectedJob.end_time) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">耗时:</span>
                  <span className="ml-2 text-gray-800">
                    {selectedJob.duration ? formatTime(selectedJob.duration) : '-'}
                  </span>
                </div>
                {selectedJob.notes && (
                  <div className="col-span-2">
                    <span className="text-gray-500">备注:</span>
                    <span className="ml-2 text-gray-800">{selectedJob.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
