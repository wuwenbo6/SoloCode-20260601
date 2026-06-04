import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WorkerMessage,
  MainThreadMessage,
  FrameData,
  MaskData,
  ModelConfig,
  SegmentationConfig,
} from '@/types';

interface UseSegmentationWorkerReturn {
  isWorkerReady: boolean;
  isModelLoaded: boolean;
  isProcessing: boolean;
  error: string | null;
  currentFps: number;
  loadModel: (config: ModelConfig) => Promise<void>;
  processFrame: (frame: FrameData) => void;
  updateConfig: (config: SegmentationConfig) => void;
  unloadModel: () => void;
  onFrameProcessed: (callback: (mask: MaskData) => void) => void;
  terminate: () => void;
}

export function useSegmentationWorker(): UseSegmentationWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFps, setCurrentFps] = useState(0);
  const frameProcessedCallbackRef =
    useRef<((mask: MaskData) => void) | null>(null);
  const processingQueueRef = useRef(0);

  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    try {
      const worker = new Worker(
        new URL('../workers/segmentation.worker.ts', import.meta.url),
        {
          type: 'module',
        }
      );

      worker.onmessage = (event: MessageEvent<MainThreadMessage>) => {
        const message = event.data;

        switch (message.type) {
          case 'MODEL_LOADED':
            setIsModelLoaded(true);
            setIsProcessing(false);
            break;
          case 'MODEL_LOAD_ERROR':
            setError(message.error);
            setIsModelLoaded(false);
            setIsProcessing(false);
            break;
          case 'FRAME_PROCESSED':
            processingQueueRef.current = Math.max(
              0,
              processingQueueRef.current - 1
            );
            if (processingQueueRef.current === 0) {
              setIsProcessing(false);
            }
            if (frameProcessedCallbackRef.current) {
              frameProcessedCallbackRef.current(message.mask);
            }
            break;
          case 'PROCESS_ERROR':
            setError(message.error);
            processingQueueRef.current = Math.max(
              0,
              processingQueueRef.current - 1
            );
            if (processingQueueRef.current === 0) {
              setIsProcessing(false);
            }
            break;
          case 'FPS_UPDATE':
            setCurrentFps(message.fps);
            break;
        }
      };

      worker.onerror = (event) => {
        setError(event.message);
        setIsProcessing(false);
        processingQueueRef.current = 0;
      };

      workerRef.current = worker;
      setIsWorkerReady(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create worker';
      setError(message);
      setIsWorkerReady(false);
    }
  }, []);

  const loadModel = useCallback(
    async (config: ModelConfig) => {
      if (!workerRef.current) {
        initWorker();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!workerRef.current) {
        throw new Error('Worker not initialized');
      }

      setIsProcessing(true);
      setError(null);
      workerRef.current.postMessage({
        type: 'LOAD_MODEL',
        config,
      } as WorkerMessage);
    },
    [initWorker]
  );

  const processFrame = useCallback((frame: FrameData) => {
    if (!workerRef.current || !isModelLoaded) return;

    if (processingQueueRef.current >= 2) {
      return;
    }

    setIsProcessing(true);
    processingQueueRef.current++;

    workerRef.current.postMessage(
      {
        type: 'PROCESS_FRAME',
        frame,
        transfer: [frame.buffer],
      } as WorkerMessage,
      [frame.buffer]
    );
  }, [isModelLoaded]);

  const updateConfig = useCallback((config: SegmentationConfig) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      type: 'UPDATE_CONFIG',
      config,
    } as WorkerMessage);
  }, []);

  const unloadModel = useCallback(() => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      type: 'UNLOAD_MODEL',
    } as WorkerMessage);

    setIsModelLoaded(false);
    setIsProcessing(false);
    processingQueueRef.current = 0;
  }, []);

  const onFrameProcessed = useCallback(
    (callback: (mask: MaskData) => void) => {
      frameProcessedCallbackRef.current = callback;
    },
    []
  );

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsWorkerReady(false);
    setIsModelLoaded(false);
    setIsProcessing(false);
    processingQueueRef.current = 0;
  }, []);

  useEffect(() => {
    initWorker();

    return () => {
      terminate();
    };
  }, [initWorker, terminate]);

  return {
    isWorkerReady,
    isModelLoaded,
    isProcessing,
    error,
    currentFps,
    loadModel,
    processFrame,
    updateConfig,
    unloadModel,
    onFrameProcessed,
    terminate,
  };
}
