import { useRef, useCallback, useState, useEffect } from 'react';
import { useFPVStore } from '@/stores/fpvStore';

interface UseRecorderReturn {
  recording: boolean;
  elapsedMs: number;
  start: (canvas: HTMLCanvasElement) => void;
  stop: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storeRecording = useFPVStore((s) => s.setRecording);
  const storeElapsed = useFPVStore((s) => s.setRecordingElapsed);

  const start = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (mediaRecorderRef.current) return;

      const stream = canvas.captureStream(30);
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];

      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      if (!selectedMime) {
        console.error('[Recorder] No supported MIME type');
        return;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 5_000_000,
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
        a.download = `fpv-recording-${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        chunksRef.current = [];
        mediaRecorderRef.current = null;
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setRecording(true);
      storeRecording(true);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);
        storeElapsed(elapsed);
      }, 100);
    },
    [storeRecording, storeElapsed],
  );

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
    storeRecording(false);
    setElapsedMs(0);
    storeElapsed(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [storeRecording, storeElapsed]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { recording, elapsedMs, start, stop };
}
