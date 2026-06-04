'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface DiffResult {
  titleDiff: any[];
  tagsDiff: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  lineByLineDiff: {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
    oldLineNum: number | null;
    newLineNum: number | null;
  }[];
  stats: {
    addedLines: number;
    removedLines: number;
    unchangedLines: number;
    timeMs: number;
  };
}

export function useDiffWorker() {
  const [isLoading, setIsLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker('/diff.worker.js');

      workerRef.current.onmessage = (e) => {
        setDiffResult(e.data);
        setIsLoading(false);
      };

      workerRef.current.onerror = (err) => {
        setError(err.message);
        setIsLoading(false);
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const computeDiff = useCallback((
    oldText: string,
    newText: string,
    oldTitle: string,
    newTitle: string,
    oldTags: string[],
    newTags: string[]
  ) => {
    if (!workerRef.current) {
      setError('Worker not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiffResult(null);

    workerRef.current.postMessage({
      oldText,
      newText,
      oldTitle,
      newTitle,
      oldTags,
      newTags,
    });
  }, []);

  const clearDiff = useCallback(() => {
    setDiffResult(null);
    setError(null);
  }, []);

  return {
    isLoading,
    diffResult,
    error,
    computeDiff,
    clearDiff,
  };
}
