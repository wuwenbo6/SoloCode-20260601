import { useState, useCallback } from 'react';
import type { VideoMetadata } from '../../shared/types.js';

export const useVideoMetadata = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractMetadata = useCallback(async (file: File): Promise<VideoMetadata> => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        setLoading(false);
        resolve({
          name: file.name,
          size: file.size,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          codec: 'H.264',
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        setLoading(false);
        const err = new Error('Failed to read video metadata');
        setError(err.message);
        reject(err);
      };

      video.src = URL.createObjectURL(file);
    });
  }, []);

  return {
    extractMetadata,
    loading,
    error,
  };
};
