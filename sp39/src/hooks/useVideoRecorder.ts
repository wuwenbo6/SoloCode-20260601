import { useRef, useCallback, useEffect, useState } from 'react';

interface UseVideoRecorderReturn {
  isRecording: boolean;
  recordedUrl: string | null;
  startRecording: (canvas: HTMLCanvasElement) => void;
  stopRecording: () => void;
  clearRecording: () => void;
  isPlaying: boolean;
  playbackProgress: number;
  startPlayback: () => void;
  stopPlayback: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoRecorder(): UseVideoRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback((canvas: HTMLCanvasElement) => {
    if (isRecording) return;

    const stream = canvas.captureStream(60);
    streamRef.current = stream;
    chunksRef.current = [];

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
      console.error('No supported video format found');
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: 8_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: selectedMime });
      const url = URL.createObjectURL(blob);

      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      setRecordedUrl(url);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setIsRecording(true);
  }, [isRecording, recordedUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, [recordedUrl]);

  const startPlayback = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration > 0) {
        setPlaybackProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [recordedUrl]);

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isRecording,
    recordedUrl,
    startRecording,
    stopRecording,
    clearRecording,
    isPlaying,
    playbackProgress,
    startPlayback,
    stopPlayback,
    videoRef,
  };
}
