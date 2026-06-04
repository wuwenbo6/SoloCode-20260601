import { Download, Play, Pause, X, Loader2, CheckCircle, AlertCircle, Clock, FileVideo } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { formatFileSize, getStatusLabel, getStatusColor, getStatusBgColor } from '../utils/format.js';
import type { TaskStatus, TranscodeParams } from '../../shared/types.js';

interface BatchTaskItem {
  id: string;
  originalName: string;
  originalSize: number;
  params: TranscodeParams;
  status: TaskStatus;
  progress: number;
  createdAt: number;
  file?: File;
  localProgress?: number;
  localStatus?: TaskStatus;
  outputFilename?: string;
  outputSize?: number;
  errorMessage?: string;
}

interface BatchTaskListProps {
  tasks: BatchTaskItem[];
  currentTaskId: string | null;
  onStartBatch?: () => void;
  onCancelTask?: (taskId: string) => void;
  onDownloadAll?: () => void;
  isProcessing?: boolean;
  canStart?: boolean;
}

export const BatchTaskList = ({
  tasks,
  currentTaskId,
  onStartBatch,
  onCancelTask,
  onDownloadAll,
  isProcessing,
  canStart,
}: BatchTaskListProps) => {
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const hasCompleted = completedTasks.length > 0;

  const getTaskIcon = (status: TaskStatus) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      case 'cancelled':
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getDisplayProgress = (task: BatchTaskItem): number => {
    if (task.localProgress !== undefined) {
      return task.localProgress;
    }
    return task.progress;
  };

  const getDisplayStatus = (task: BatchTaskItem): TaskStatus => {
    if (task.localStatus) {
      return task.localStatus;
    }
    return task.status;
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-100">批量转码队列</h3>
          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">
            {tasks.length} 个文件
          </span>
          {hasCompleted && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
              {completedTasks.length} 已完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasCompleted && onDownloadAll && (
            <button
              onClick={onDownloadAll}
              className="px-3 py-1.5 text-sm font-medium text-emerald-400
                bg-emerald-500/10 border border-emerald-500/30 rounded-lg
                hover:bg-emerald-500/20 transition-all duration-200
                flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              打包下载 ZIP
            </button>
          )}
          {canStart && onStartBatch && (
            <button
              onClick={onStartBatch}
              disabled={isProcessing}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg
                flex items-center gap-2 transition-all duration-200
                ${isProcessing
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40'
                }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始转码
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>请选择视频文件</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {tasks.map((task, index) => {
              const displayProgress = getDisplayProgress(task);
              const displayStatus = getDisplayStatus(task);
              const isCurrent = task.id === currentTaskId;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'p-4 transition-all duration-200',
                    isCurrent && 'bg-cyan-500/5',
                    displayStatus === 'completed' && 'bg-emerald-500/5'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          isCurrent ? 'bg-cyan-500/20' : 'bg-slate-700/50'
                        )}
                      >
                        <span className="text-xs font-medium text-slate-300">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 text-sm truncate max-w-xs">
                          {task.originalName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(task.originalSize)} · {task.params.format.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          getStatusBgColor(displayStatus),
                          getStatusColor(displayStatus)
                        )}
                      >
                        {getTaskIcon(displayStatus)}
                        {getStatusLabel(displayStatus)}
                      </span>
                      {displayStatus === 'processing' && onCancelTask && (
                        <button
                          onClick={() => onCancelTask(task.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20
                            text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {displayStatus === 'processing' || displayStatus === 'queued' ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>进度</span>
                        <span className="font-mono">{displayProgress}%</span>
                      </div>
                      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            isCurrent
                              ? 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                              : 'bg-slate-600'
                          )}
                          style={{ width: `${displayProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : displayStatus === 'completed' && task.outputSize ? (
                    <div className="mt-2 text-xs text-emerald-400">
                      输出大小: {formatFileSize(task.outputSize)}
                    </div>
                  ) : displayStatus === 'failed' && task.errorMessage ? (
                    <div className="mt-2 text-xs text-red-400 truncate">
                      {task.errorMessage}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
