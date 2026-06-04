import { useState, useRef, useCallback, useEffect } from 'react';
import type { TranscodeParams } from '../../shared/types.js';
import type { ProgressPayload, TranscodeCompletePayload } from '../types/worker.js';

export type TranscodeStage = 'idle' | 'loading' | 'reading' | 'transcoding' | 'writing' | 'uploading' | 'complete' | 'error' | 'cancelled';

export interface TranscodeResult {
  blob: Blob;
  format: string;
  mimeType: string;
}

interface UseFFmpegReturn {
  loadFFmpeg: () => Promise<void>;
  transcode: (
    file: File,
    params: TranscodeParams,
    onProgress?: (progress: number, stage: TranscodeStage) => void
  ) => Promise<TranscodeResult>;
  cancel: () => void;
  loading: boolean;
  progress: number;
  stage: TranscodeStage;
  isLoaded: boolean;
  error: string | null;
  isCancelled: boolean;
}

const STAGE_LABELS: Record<TranscodeStage, string> = {
  idle: '就绪',
  loading: '加载 FFmpeg',
  reading: '读取文件',
  transcoding: '转码中',
  writing: '写入输出',
  uploading: '上传结果',
  complete: '完成',
  error: '错误',
  cancelled: '已取消',
};

export { STAGE_LABELS };

export const useFFmpeg = (): UseFFmpegReturn => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<TranscodeStage>('idle');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const transcodePromiseRef = useRef<{
    resolve: (result: TranscodeResult) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const readFileAsArrayBuffer = useCallback(
    (file: File, onProgress?: (progress: number) => void): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
        const chunkSize = 10 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / chunkSize);
        const chunks: ArrayBuffer[] = [];
        let currentChunk = 0;

        const reader = new FileReader();

        const readNextChunk = () => {
          const start = currentChunk * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const blob = file.slice(start, end);
          reader.readAsArrayBuffer(blob);
        };

        reader.onload = (e) => {
          if (e.target?.result) {
            chunks.push(e.target.result as ArrayBuffer);
            currentChunk++;

            const readProgress = Math.round((currentChunk / totalChunks) * 100);
            if (onProgress) {
              onProgress(readProgress);
            }

            if (currentChunk < totalChunks) {
              setTimeout(readNextChunk, 0);
            } else {
              const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
              const result = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of chunks) {
                result.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
              }
              resolve(result.buffer);
            }
          }
        };

        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };

        readNextChunk();
      });
    },
    []
  );

  const initWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(
      new URL('../workers/ffmpeg.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'load_progress':
          setProgress((payload as ProgressPayload).progress);
          setStage((payload as ProgressPayload).stage as TranscodeStage);
          break;

        case 'load_complete':
          setIsLoaded(true);
          setLoading(false);
          setStage('idle');
          if (loadPromiseRef.current) {
            loadPromiseRef.current = null;
          }
          break;

        case 'transcode_progress':
          setProgress((payload as ProgressPayload).progress);
          setStage((payload as ProgressPayload).stage as TranscodeStage);
          break;

        case 'transcode_complete': {
          setProgress(100);
          setStage('complete');
          const completePayload = payload as TranscodeCompletePayload;
          if (transcodePromiseRef.current) {
            const blob = new Blob([completePayload.data], { type: completePayload.mimeType });
            transcodePromiseRef.current.resolve({
              blob,
              format: completePayload.format,
              mimeType: completePayload.mimeType,
            });
            transcodePromiseRef.current = null;
          }
          break;
        }

        case 'error':
          setError(payload.message);
          setStage('error');
          if (loadPromiseRef.current) {
            loadPromiseRef.current = null;
          }
          if (transcodePromiseRef.current) {
            if (payload.message.includes('cancelled')) {
              setIsCancelled(true);
              setStage('cancelled');
            }
            transcodePromiseRef.current.reject(new Error(payload.message));
            transcodePromiseRef.current = null;
          }
          break;

        case 'log':
          console.log('[FFmpeg Worker]', payload.message);
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      setError('Worker error: ' + err.message);
      setStage('error');
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const loadFFmpeg = useCallback(async (): Promise<void> => {
    if (isLoaded) return;

    const worker = initWorker();
    setLoading(true);
    setError(null);
    setStage('loading');
    setProgress(0);

    loadPromiseRef.current = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('FFmpeg load timeout'));
      }, 120000);

      const checkLoaded = setInterval(() => {
        if (isLoaded) {
          clearTimeout(timeout);
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);

      worker.postMessage({ type: 'load' });
    });

    return loadPromiseRef.current;
  }, [initWorker, isLoaded]);

  const transcode = useCallback(
    async (
      file: File,
      params: TranscodeParams,
      onProgress?: (progress: number, stage: TranscodeStage) => void
    ): Promise<TranscodeResult> => {
      const worker = initWorker();

      if (!isLoaded) {
        await loadFFmpeg();
      }

      setLoading(true);
      setError(null);
      setIsCancelled(false);
      setStage('reading');
      setProgress(0);

      try {
        const arrayBuffer = await readFileAsArrayBuffer(file, (readProgress) => {
          const mappedProgress = Math.round(readProgress * 0.05);
          setProgress(mappedProgress);
          if (onProgress) {
            onProgress(mappedProgress, 'reading');
          }
        });

        setStage('transcoding');

        return new Promise((resolve, reject) => {
          transcodePromiseRef.current = {
            resolve: (result) => {
              setLoading(false);
              resolve(result);
            },
            reject: (err) => {
              setLoading(false);
              reject(err);
            },
          };

          worker.postMessage(
            {
              type: 'transcode',
              payload: {
                fileArrayBuffer: arrayBuffer,
                params,
                fileName: file.name,
              },
            },
            [arrayBuffer]
          );
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcoding failed');
        setStage('error');
        setLoading(false);
        throw err;
      }
    },
    [initWorker, isLoaded, loadFFmpeg, readFileAsArrayBuffer]
  );

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' });
    }
    setIsCancelled(true);
    setStage('cancelled');
    setLoading(false);

    if (transcodePromiseRef.current) {
      transcodePromiseRef.current.reject(new Error('Transcoding cancelled'));
      transcodePromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    loadFFmpeg,
    transcode,
    cancel,
    loading,
    progress,
    stage,
    isLoaded,
    error,
    isCancelled,
  };
};
