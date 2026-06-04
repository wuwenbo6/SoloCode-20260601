import { Download, Clock, XCircle, CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import type { Task } from '../../shared/types.js';
import { taskApi } from '../utils/api.js';
import {
  formatFileSize,
  formatDuration,
  formatDate,
  getStatusLabel,
  getStatusBgColor,
  getStatusColor,
} from '../utils/format.js';
import { cn } from '../lib/utils.js';

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'processing':
      return <Loader className="w-4 h-4 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4" />;
    case 'failed':
      return <AlertTriangle className="w-4 h-4" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

export const TaskList = ({ tasks, loading }: TaskListProps) => {
  const handleDownload = (task: Task) => {
    if (task.outputFilename) {
      window.open(taskApi.getDownloadUrl(task.outputFilename), '_blank');
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="animate-pulse h-6 bg-slate-700 rounded w-1/4" />
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-20 bg-slate-700/30 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-6 border-b border-slate-700/50">
        <h3 className="font-semibold text-slate-100 text-lg">任务历史</h3>
        <p className="text-sm text-slate-400">共 {tasks.length} 个任务</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/30">
            <tr>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                文件
              </th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                参数
              </th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                状态
              </th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                进度
              </th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                创建时间
              </th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  暂无任务记录
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-medium text-slate-200 truncate max-w-xs">
                      {task.originalName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatFileSize(task.originalSize)} · {formatDuration(task.metadata.duration)}
                    </div>
                    {task.outputSize && (
                      <div className="text-xs text-emerald-400">
                        输出: {formatFileSize(task.outputSize)}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-300">
                      {task.params.fps} fps · {task.params.resolution} · {task.params.quality === 'high' ? '高' : '低'}质量
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                        getStatusBgColor(task.status),
                        getStatusColor(task.status)
                      )}
                    >
                      <StatusIcon status={task.status} />
                      {getStatusLabel(task.status)}
                    </span>
                    {task.errorMessage && (
                      <div className="text-xs text-red-400 mt-1 max-w-xs truncate">
                        {task.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="w-24">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            task.status === 'completed'
                              ? 'bg-emerald-500'
                              : task.status === 'failed'
                              ? 'bg-red-500'
                              : task.status === 'cancelled'
                              ? 'bg-orange-500'
                              : 'bg-cyan-500'
                          )}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{task.progress}%</div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {formatDate(task.createdAt)}
                  </td>
                  <td className="p-4">
                    {task.status === 'completed' && task.outputFilename && (
                      <button
                        onClick={() => handleDownload(task)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                          text-emerald-400 bg-emerald-500/10 border border-emerald-500/30
                          rounded-lg hover:bg-emerald-500/20 transition-all duration-200
                          hover:border-emerald-400 hover:text-emerald-300
                          hover:shadow-lg hover:shadow-emerald-500/20"
                      >
                        <Download className="w-4 h-4" />
                        下载
                      </button>
                    )}
                    {task.status === 'processing' && (
                      <span className="text-sm text-cyan-400 animate-pulse">
                        转码中...
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
