import { Loader2, X, CheckCircle, AlertCircle, Clock, Upload, FileVideo, Cpu, FileOutput } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { getStatusLabel, getStatusColor } from '../utils/format.js';
import type { TaskStatus } from '../../shared/types.js';
import type { TranscodeStage } from '../hooks/useFFmpeg.js';

interface ProgressBarProps {
  progress: number;
  status: TaskStatus;
  stage?: TranscodeStage;
  stageLabel?: string;
  onCancel?: () => void;
  showCancel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getStageIcon = (stage: TranscodeStage) => {
  switch (stage) {
    case 'loading':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'reading':
      return <FileVideo className="w-4 h-4" />;
    case 'transcoding':
      return <Cpu className="w-4 h-4" />;
    case 'writing':
      return <FileOutput className="w-4 h-4" />;
    case 'uploading':
      return <Upload className="w-4 h-4" />;
    default:
      return null;
  }
};

export const ProgressBar = ({
  progress,
  status,
  stage,
  stageLabel,
  onCancel,
  showCancel = true,
  size = 'md',
}: ProgressBarProps) => {
  const isProcessing = status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const isQueued = status === 'queued';

  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';

  const displayProgress = isCompleted ? 100 : progress;
  const showStageInfo = isProcessing && stage && stage !== 'idle';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isProcessing && showStageInfo ? (
            <>
              {getStageIcon(stage!)}
              <span className="text-sm font-medium text-cyan-400">
                {stageLabel || stage}
              </span>
            </>
          ) : (
            <>
              {isProcessing && (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              )}
              {isCompleted && (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              {isFailed && (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              {isCancelled && (
                <X className="w-4 h-4 text-orange-400" />
              )}
              {isQueued && (
                <Clock className="w-4 h-4 text-yellow-400" />
              )}
              <span className={cn('text-sm font-medium', getStatusColor(status))}>
                {getStatusLabel(status)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-cyan-400 font-mono">
            {displayProgress}%
          </span>
          {(isProcessing || isQueued) && showCancel && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm font-medium text-red-400 border border-red-500/50
                rounded-lg hover:bg-red-500/20 transition-all duration-200
                hover:border-red-400 hover:text-red-300"
            >
              取消
            </button>
          )}
        </div>
      </div>

      <div className={cn('w-full bg-slate-700/50 rounded-full overflow-hidden', heightClass)}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            isCompleted
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : isFailed
              ? 'bg-gradient-to-r from-red-500 to-red-400'
              : isCancelled
              ? 'bg-gradient-to-r from-orange-500 to-orange-400'
              : isProcessing
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-400'
              : 'bg-gradient-to-r from-yellow-500 to-yellow-400'
          )}
          style={{ width: `${displayProgress}%` }}
        />
      </div>

      {isProcessing && stage && (
        <div className="mt-2 flex gap-2 text-xs text-slate-500">
          <span className={cn('px-2 py-0.5 rounded', stage === 'loading' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50')}>
            加载
          </span>
          <span className={cn('px-2 py-0.5 rounded', stage === 'reading' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50')}>
            读取
          </span>
          <span className={cn('px-2 py-0.5 rounded', stage === 'transcoding' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50')}>
            转码
          </span>
          <span className={cn('px-2 py-0.5 rounded', stage === 'writing' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50')}>
            写入
          </span>
          <span className={cn('px-2 py-0.5 rounded', stage === 'uploading' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50')}>
            上传
          </span>
        </div>
      )}
    </div>
  );
};
