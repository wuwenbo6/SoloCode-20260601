import { useState, useEffect, useCallback } from 'react';
import { Upload, HardDrive, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { firmwareAPI } from '../services/api';
import type { FirmwareProgress } from '../types';
import { cn } from '../utils';

interface FirmwareUpgradeProps {
  disabled?: boolean;
}

export function FirmwareUpgrade({ disabled }: FirmwareUpgradeProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hexContent, setHexContent] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<FirmwareProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const p = await firmwareAPI.getProgress();
      setProgress(p);
      setPaused(p.paused);
      
      if (p.inProgress && !p.paused) {
        setUpgrading(true);
      } else if (p.paused) {
        setError(p.lastError || '升级已暂停，可点击继续恢复');
        setUpgrading(false);
      } else if (p.lastError && !p.inProgress && p.progress > 0) {
        setError(p.lastError);
        setUpgrading(false);
      } else if (p.progress >= 100 && !p.inProgress && !p.lastError) {
        setSuccess(true);
        setUpgrading(false);
        setPaused(false);
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    if (upgrading) {
      interval = window.setInterval(loadProgress, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [upgrading, loadProgress]);

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.hex')) {
      setError('请选择 .hex 格式的固件文件');
      return;
    }
    setSelectedFile(file);
    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHexContent(content);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    try {
      const result = await firmwareAPI.upload(selectedFile);
      setHexContent(result.content);
    } catch (e) {
      setError('上传文件失败');
    } finally {
      setUploading(false);
    }
  };

  const handleStartUpgrade = async () => {
    if (!hexContent) return;

    setUpgrading(true);
    setError(null);
    setSuccess(false);
    try {
      await firmwareAPI.startUpgrade(hexContent);
    } catch (e) {
      setError('启动固件升级失败');
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await firmwareAPI.cancel();
      setUpgrading(false);
      setPaused(false);
      setProgress(null);
    } catch (e) {
      console.error('Failed to cancel:', e);
    }
  };

  const handlePause = async () => {
    try {
      await firmwareAPI.pauseUpgrade();
      setPaused(true);
      setUpgrading(false);
    } catch (e) {
      console.error('Failed to pause:', e);
    }
  };

  const handleResume = async () => {
    try {
      await firmwareAPI.resumeUpgrade(hexContent);
      setPaused(false);
      setUpgrading(true);
      setError(null);
    } catch (e) {
      console.error('Failed to resume:', e);
      setError('恢复升级失败');
    }
  };

  const handleReset = async () => {
    try {
      await firmwareAPI.resetUpgrade();
    } catch (e) {
      console.error('Failed to reset:', e);
    }
    setSelectedFile(null);
    setHexContent('');
    setProgress(null);
    setError(null);
    setSuccess(false);
    setPaused(false);
    setUpgrading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-primary-600" />
        固件升级
      </h3>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">固件升级成功!</p>
            <p className="text-sm text-green-600">打印机将重启以应用新固件</p>
          </div>
        </div>
      )}

      {error && (
        <div className={cn(
          'mb-4 p-4 border rounded-lg flex items-center gap-3',
          paused ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
        )}>
          {paused ? (
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className={cn('font-medium', paused ? 'text-yellow-800' : 'text-red-800')}>
              {paused ? '升级已暂停' : '出错了'}
            </p>
            <p className={cn('text-sm', paused ? 'text-yellow-600' : 'text-red-600')}>
              {error}
            </p>
          </div>
          {paused && (
            <button
              onClick={handleResume}
              disabled={disabled}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                disabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              继续
            </button>
          )}
        </div>
      )}

      {(upgrading || paused) && progress && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">升级进度</span>
            <span className="text-sm text-gray-600">
              {progress.currentPage} / {progress.totalPages} 页
              {paused && <span className="ml-2 text-yellow-600">(已暂停)</span>}
            </span>
          </div>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                paused
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                  : 'bg-gradient-to-r from-primary-500 to-primary-600'
              )}
              style={{ width: `${progress.progress}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              {progress.progress.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {paused ? (
              <>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                升级已暂停，可点击继续恢复
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在写入固件...请勿断开连接
              </>
            )}
          </div>
        </div>
      )}

      {!upgrading && (
        <>
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              dragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
              disabled && 'opacity-50 pointer-events-none'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".hex"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
              id="firmware-file"
              disabled={disabled}
            />
            <label htmlFor="firmware-file" className="cursor-pointer">
              <Upload className={cn(
                'w-12 h-12 mx-auto mb-3',
                dragActive ? 'text-primary-500' : 'text-gray-400'
              )} />
              <p className="text-gray-700 font-medium mb-1">
                {selectedFile ? selectedFile.name : '点击选择或拖拽固件文件'}
              </p>
              <p className="text-sm text-gray-500">
                支持 .hex 格式的固件文件
              </p>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium text-gray-700">{selectedFile.name}</p>
                  <p className="text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  移除
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">注意事项</p>
                  <ul className="text-yellow-700 mt-1 space-y-1 list-disc list-inside">
                    <li>升级过程中请勿断开打印机连接</li>
                    <li>确保打印机已接通电源</li>
                    <li>升级完成后打印机将自动重启</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleStartUpgrade}
                  disabled={disabled || uploading}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors',
                    disabled || uploading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4" />
                      开始升级
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(upgrading || paused) && (
        <div className="flex gap-2 mt-4">
          {!paused && (
            <button
              onClick={handlePause}
              className="flex-1 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg font-medium transition-colors"
            >
              暂停升级
            </button>
          )}
          {paused && (
            <button
              onClick={handleResume}
              disabled={disabled}
              className={cn(
                'flex-1 py-2 rounded-lg font-medium transition-colors',
                disabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-100 hover:bg-green-200 text-green-700'
              )}
            >
              继续升级
            </button>
          )}
          <button
            onClick={handleCancel}
            className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
          >
            取消升级
          </button>
        </div>
      )}

      {(success || error) && !upgrading && (
        <button
          onClick={handleReset}
          className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          选择新固件
        </button>
      )}
    </div>
  );
}
