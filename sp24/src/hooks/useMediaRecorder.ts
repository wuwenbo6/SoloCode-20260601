import { useState, useCallback, useRef, useEffect } from 'react';
import { RecordingConfig } from '@/types';

interface UseMediaRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  recordedChunks: Blob[];
  recordingTime: number;
  error: string | null;
  startRecording: (
    canvasStream: MediaStream,
    audioStream?: MediaStream | null
  ) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  downloadRecording: (filename?: string) => void;
  clearRecording: () => void;
  getRecordedUrl: () => string | null;
}

export function useMediaRecorder(
  config: RecordingConfig
): UseMediaRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const isSupported = typeof MediaRecorder !== 'undefined';

  const getMimeType = useCallback((): string => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }, []);

  const startRecording = useCallback(
    async (
      canvasStream: MediaStream,
      audioStream?: MediaStream | null
    ) => {
      if (!isSupported) {
        setError('MediaRecorder is not supported in this browser');
        return;
      }

      try {
        setError(null);
        setRecordedChunks([]);
        setRecordingTime(0);

        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl);
          setRecordedUrl(null);
        }

        let combinedStream: MediaStream;

        if (config.includeAudio && audioStream && audioStream.getAudioTracks().length > 0) {
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
        } else {
          combinedStream = canvasStream;
        }

        const mimeType = getMimeType();
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType || undefined,
          videoBitsPerSecond: config.bitrate,
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onerror = (event) => {
          const errorEvent = event as MediaRecorderErrorEvent;
          setError(errorEvent.error?.message || 'Recording error occurred');
          stopRecording();
        };

        mediaRecorder.onstop = () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (chunks.length > 0) {
            const blob = new Blob(chunks, {
              type: mediaRecorder.mimeType || 'video/webm',
            });
            const url = URL.createObjectURL(blob);
            setRecordedUrl(url);
            setRecordedChunks(chunks);
          }

          setIsRecording(false);
          setIsPaused(false);
          mediaRecorderRef.current = null;
        };

        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        setIsPaused(false);

        timerRef.current = window.setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start recording';
        setError(message);
      }
    },
    [isSupported, config.includeAudio, config.bitrate, getMimeType, recordedUrl]
  );

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;
      const chunksSnapshot = recordedChunks;

      recorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const allChunks = chunksSnapshot.length > 0 ? chunksSnapshot : [];
        if (recorder.stream && allChunks.length === 0) {
          resolve(null);
          setIsRecording(false);
          setIsPaused(false);
          mediaRecorderRef.current = null;
          return;
        }

        const blob = new Blob(allChunks, {
          type: recorder.mimeType || 'video/webm',
        });

        const url = URL.createObjectURL(blob);
        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl);
        }
        setRecordedUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        mediaRecorderRef.current = null;

        resolve(blob);
      };

      recorder.stop();
    });
  }, [isRecording, recordedChunks, recordedUrl]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isPaused]);

  const downloadRecording = useCallback(
    (filename?: string) => {
      if (!recordedUrl && recordedChunks.length === 0) return;

      let url = recordedUrl;
      if (!url && recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, {
          type: mediaRecorderRef.current?.mimeType || 'video/webm',
        });
        url = URL.createObjectURL(blob);
      }

      if (!url) return;

      const extension = config.format === 'mp4' ? 'mp4' : 'webm';
      const defaultFilename = `recording_${Date.now()}.${extension}`;
      const downloadName = filename || defaultFilename;

      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [recordedUrl, recordedChunks, config.format]
  );

  const clearRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedChunks([]);
    setRecordedUrl(null);
    setRecordingTime(0);
    setError(null);
  }, [recordedUrl]);

  const getRecordedUrl = useCallback((): string | null => {
    return recordedUrl;
  }, [recordedUrl]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  return {
    isRecording,
    isSupported,
    recordedChunks,
    recordingTime,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    clearRecording,
    getRecordedUrl,
  };
}
