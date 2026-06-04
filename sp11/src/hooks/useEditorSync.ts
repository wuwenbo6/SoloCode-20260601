import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { CursorPosition } from '../types';
import { useSignaling } from './useSignaling';

export const useEditorSync = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser, editorContent, setEditorContent } = useStore();
  const { sendCursorUpdate, broadcastToPeers, sendContentSync } = useSignaling();
  const lastContentRef = useRef<string>(editorContent);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    lastContentRef.current = editorContent;
  }, [editorContent]);

  const handleEditorUpdate = useCallback(
    (content: string) => {
      if (!currentUser || !roomId) return;
      if (content === lastContentRef.current) return;

      lastContentRef.current = content;
      setEditorContent(content);

      broadcastToPeers({
        type: 'text-change',
        userId: currentUser.id,
        data: content,
        timestamp: Date.now(),
      });

      sendContentSync(roomId, currentUser.id, content);
    },
    [currentUser, roomId, setEditorContent, broadcastToPeers, sendContentSync]
  );

  const handleCursorChange = useCallback(
    (cursor: CursorPosition) => {
      if (!currentUser || !roomId) return;

      const cursorWithUserId = { ...cursor, userId: currentUser.id };

      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }

      cursorTimeoutRef.current = setTimeout(() => {
        sendCursorUpdate(roomId, currentUser.id, cursorWithUserId);

        broadcastToPeers({
          type: 'cursor',
          userId: currentUser.id,
          data: cursorWithUserId,
          timestamp: Date.now(),
        });
      }, 30);
    },
    [currentUser, roomId, sendCursorUpdate, broadcastToPeers]
  );

  useEffect(() => {
    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleEditorUpdate,
    handleCursorChange,
  };
};
