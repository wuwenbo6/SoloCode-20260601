import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';

const AUTO_SAVE_INTERVAL = 5 * 60 * 1000;

export const useAutoSave = (roomId: string) => {
  const { currentUser, editorContent, versions, setVersions, addVersion, setError } = useStore();
  const lastSavedContentRef = useRef<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveVersion = useCallback(
    async (autoSaved: boolean = true, message?: string) => {
      if (!currentUser || !roomId) return null;

      const content = useStore.getState().editorContent;
      if (!content || content.trim().length === 0) return null;
      if (content === lastSavedContentRef.current && autoSaved) return null;

      try {
        const result = await api.saveVersion(roomId, currentUser.id, {
          content,
          autoSaved,
          message,
        });

        lastSavedContentRef.current = content;
        addVersion(result.version);
        return result.version;
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        }
        return null;
      }
    },
    [currentUser, roomId, addVersion, setError]
  );

  const loadVersions = useCallback(async () => {
    if (!roomId) return;

    try {
      const result = await api.getVersions(roomId, 1, 50);
      setVersions(result.versions);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  }, [roomId, setVersions, setError]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!currentUser || !roomId) return null;

      try {
        const version = await api.restoreVersion(roomId, versionId, currentUser.id);
        addVersion(version);
        return version;
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        }
        return null;
      }
    },
    [currentUser, roomId, addVersion, setError]
  );

  const startAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      saveVersion(true, 'Auto-save');
    }, AUTO_SAVE_INTERVAL);
  }, [saveVersion]);

  const stopAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadVersions();
    startAutoSave();

    return () => {
      stopAutoSave();
    };
  }, [loadVersions, startAutoSave, stopAutoSave]);

  return {
    saveVersion,
    loadVersions,
    restoreVersion,
    startAutoSave,
    stopAutoSave,
    versions,
  };
};
