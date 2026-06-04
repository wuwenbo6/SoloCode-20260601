import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSignaling } from './useSignaling';
import * as Diff from 'diff';

export const useOfflineSync = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const {
    currentUser,
    editorContent,
    contentVersion,
    isOnline,
    offlineEdits,
    setOnline,
    addOfflineEdit,
    clearOfflineEdits,
    setEditorContent,
    setContentVersion,
    addNotification,
  } = useStore();

  const { sendContentSync } = useSignaling();
  const lastOnlineContentRef = useRef<string>('');
  const lastOnlineVersionRef = useRef<number>(0);
  const isOnlineRef = useRef<boolean>(isOnline);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      lastOnlineContentRef.current = editorContent;
      lastOnlineVersionRef.current = contentVersion;
    }
  }, [isOnline, editorContent, contentVersion]);

  const goOnline = useCallback(() => {
    console.log('Network is online');
    setOnline(true);

    if (offlineEdits.length > 0 && currentUser && roomId) {
      const latestOfflineEdit = offlineEdits[offlineEdits.length - 1];
      const offlineContent = latestOfflineEdit.content;
      const currentServerContent = lastOnlineContentRef.current;

      if (offlineContent !== currentServerContent) {
        const diff = Diff.diffLines(currentServerContent, offlineContent);

        if (diff.length > 0) {
          const hasConflicts = diff.some((part) => part.added || part.removed);

          if (hasConflicts) {
            const latestEdit = offlineEdits[offlineEdits.length - 1];
            const offlineTime = new Date(latestEdit.timestamp).toLocaleTimeString();

            const latestTime = Math.max(...offlineEdits.map((e) => e.timestamp));
            if (latestTime > lastOnlineVersionRef.current) {
              setEditorContent(offlineContent, contentVersion + 1);
              setContentVersion(contentVersion + 1);
              sendContentSync(roomId, currentUser.id, offlineContent);

              addNotification({
                type: 'success',
                title: '离线编辑已合并',
                message: `您在 ${offlineTime} 的离线编辑已自动合并到共享文档（以时间戳为准）。`,
              });
            } else {
              addNotification({
                type: 'conflict',
                title: '编辑冲突',
                message: '检测到编辑冲突，服务器版本更新，已保留服务器内容。',
                data: {
                  offlineContent,
                  serverContent: currentServerContent,
                },
              });
            }
          } else {
            addNotification({
              type: 'success',
              title: '同步完成',
              message: '您的离线编辑已成功同步。',
            });
          }

          clearOfflineEdits();
        }
      } else {
        clearOfflineEdits();
      }
    }
  }, [
    offlineEdits,
    currentUser,
    roomId,
    contentVersion,
    setOnline,
    setEditorContent,
    setContentVersion,
    sendContentSync,
    addNotification,
    clearOfflineEdits,
  ]);

  const goOffline = useCallback(() => {
    console.log('Network is offline');
    setOnline(false);
    lastOnlineContentRef.current = editorContent;
    lastOnlineVersionRef.current = contentVersion;

    addNotification({
      type: 'warning',
      title: '网络已断开',
      message: '您可以继续编辑，网络恢复后将自动同步。',
    });
  }, [editorContent, contentVersion, setOnline, addNotification]);

  useEffect(() => {
    const handleOnline = () => {
      setTimeout(() => {
        goOnline();
      }, 500);
    };

    const handleOffline = () => {
      goOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [goOnline, goOffline]);

  const recordOfflineEdit = useCallback(
    (content: string) => {
      if (!isOnlineRef.current && currentUser) {
        addOfflineEdit({
          id: `edit-${Date.now()}`,
          content,
          timestamp: Date.now(),
          baseVersion: lastOnlineVersionRef.current,
        });
      }
    },
    [currentUser, addOfflineEdit]
  );

  return {
    isOnline,
    offlineEdits,
    recordOfflineEdit,
    goOnline,
    goOffline,
  };
};
