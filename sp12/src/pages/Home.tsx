import { useState, useCallback, useRef } from 'react';
import { Video, RotateCcw, AlertTriangle } from 'lucide-react';
import { FileUpload } from '../components/FileUpload.js';
import { ParamsPanel } from '../components/ParamsPanel.js';
import { BatchTaskList } from '../components/BatchTaskList.js';
import { taskApi } from '../utils/api.js';
import { formatFileSize } from '../utils/format.js';
import type { TranscodeParams, TaskStatus } from '../../shared/types.js';

interface BatchTask {
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

const DEFAULT_PARAMS: TranscodeParams = {
  fps: 30,
  resolution: '720p',
  quality: 'high',
  format: 'mp4',
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [params, setParams] = useState<TranscodeParams>(DEFAULT_PARAMS);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFilesSelect = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setError(null);

    const newTasks: BatchTask[] = files.map((file) => ({
      id: generateId(),
      originalName: file.name,
      originalSize: file.size,
      params,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      file,
    }));
    setTasks(newTasks);
  }, [params]);

  const handleParamsChange = useCallback((newParams: TranscodeParams) => {
    setParams(newParams);
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        params: newParams,
      }))
    );
  }, []);

  const handleStartBatch = useCallback(async () => {
    if (tasks.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      for (const task of tasks) {
        if (task.status === 'completed' || task.status === 'failed') continue;

        setCurrentTaskId(task.id);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, localStatus: 'processing' as TaskStatus, localProgress: 0 }
              : t
          )
        );

        try {
          const result = await processSingleTask(task);

          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    localStatus: 'completed' as TaskStatus,
                    localProgress: 100,
                    outputFilename: result.outputFilename,
                    outputSize: result.outputSize,
                  }
                : t
            )
          );
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message === 'Cancelled') {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, localStatus: 'cancelled' as TaskStatus }
                  : t
              )
            );
          } else {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      localStatus: 'failed' as TaskStatus,
                      errorMessage: err.message || '转码失败',
                    }
                : t
              )
            );
          }
        }
      }
    } finally {
      setIsProcessing(false);
      setCurrentTaskId(null);
    }
  }, [tasks]);

  const processSingleTask = async (
    task: BatchTask
  ): Promise<{ outputFilename: string; outputSize: number }> => {
    if (!task.file) throw new Error('文件不存在');

    abortControllerRef.current = new AbortController();

    const updateProgress = (progress: number) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, localProgress: progress } : t))
      );
    };

    const worker = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), {
      type: 'module',
    });

    return new Promise((resolve, reject) => {
      let uploadedPath = '';

      worker.onmessage = async (e) => {
        const message = e.data;

        switch (message.type) {
          case 'worker_ready':
            const CHUNK_SIZE = 10 * 1024 * 1024;
            const totalChunks = Math.ceil(task.file!.size / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, task.file!.size);
              const chunk = task.file!.slice(start, end);
              worker.postMessage({
                type: 'file_chunk',
                chunkIndex: i,
                totalChunks,
                data: chunk,
                filename: task.originalName,
              });
              updateProgress(Math.round((i / totalChunks) * 10));
            }
            break;

          case 'file_complete':
            worker.postMessage({
              type: 'start_transcode',
              params,
              inputName: task.originalName,
            });
            break;

          case 'transcode_progress':
            const transcodeProgress = 10 + Math.round(message.payload.progress * 0.85);
            updateProgress(transcodeProgress);
            break;

          case 'transcode_complete':
            updateProgress(95);
            try {
              const result = message.payload;
              const blob = new Blob([result.data], { type: result.mimeType });
              const uploadedTask = await taskApi.uploadResult(
                task.id,
                blob,
                `${task.originalName.replace('.mp4', '')}.${result.format}`,
                (progress) => {
                  updateProgress(95 + Math.round(progress * 0.05));
                }
              );
              uploadedPath = uploadedTask.outputFilename || '';
              updateProgress(100);
              resolve({
                outputFilename: uploadedPath,
                outputSize: result.data.byteLength,
              });
            } catch (err: any) {
              reject(err);
            } finally {
              worker.terminate();
            }
            break;

          case 'transcode_error':
            worker.terminate();
            reject(new Error(message.payload.message));
            break;

          case 'worker_error':
            worker.terminate();
            reject(new Error(message.payload.message));
            break;
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message));
      };

      abortControllerRef.current?.signal.addEventListener('abort', () => {
        worker.terminate();
        reject(new Error('Cancelled'));
      });
    });
  };

  const handleCancelTask = useCallback((taskId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.localStatus === 'completed');
    if (completedTasks.length === 0) return;

    const ids = completedTasks.map((t) => t.id);
    const downloadUrl = taskApi.getBatchDownloadUrl(ids);
    window.open(downloadUrl, '_blank');
  }, [tasks]);

  const handleReset = useCallback(() => {
    setSelectedFiles([]);
    setTasks([]);
    setCurrentTaskId(null);
    setIsProcessing(false);
    setError(null);
    setParams(DEFAULT_PARAMS);
  }, []);

  const canStart = tasks.some((t) => t.status === 'queued' || t.localStatus === 'queued') && !isProcessing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="relative max-w-5xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-cyan-500/10 rounded-full border border-cyan-500/20 mb-4">
            <Video className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">WebAssembly 加速</span>
          </div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-3">
            视频批量转码工具
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            在浏览器中安全、快速地完成视频转码，支持多种输出格式
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <FileUpload
            onFilesSelect={handleFilesSelect}
            selectedFiles={selectedFiles}
            disabled={isProcessing}
          />

          <ParamsPanel
            params={params}
            onChange={handleParamsChange}
            disabled={isProcessing}
          />

          <BatchTaskList
            tasks={tasks}
            currentTaskId={currentTaskId}
            onStartBatch={handleStartBatch}
            onCancelTask={handleCancelTask}
            onDownloadAll={handleDownloadAll}
            isProcessing={isProcessing}
            canStart={canStart}
          />

          {tasks.length > 0 && (
            <div className="flex justify-center gap-4">
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-2.5 text-slate-400 hover:text-slate-300
                  hover:bg-slate-700/50 rounded-lg transition-all duration-200
                  flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                重新开始
              </button>
            </div>
          )}
        </div>

        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>所有处理均在您的浏览器本地完成，文件不会上传至任何云端服务器</p>
        </footer>
      </div>
    </div>
  );
}
