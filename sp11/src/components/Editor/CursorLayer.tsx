import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { CursorPosition, User } from '../../types';

interface CursorLayerProps {
  remoteCursors: Map<string, CursorPosition>;
  editorContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  currentUserId: string;
  members: User[];
  editorView?: EditorView | null;
}

interface CursorDisplay {
  userId: string;
  top: number;
  left: number;
  height: number;
  color: string;
  nickname: string;
}

export const CursorLayer = ({
  remoteCursors,
  editorContainerRef,
  currentUserId,
  members,
  editorView,
}: CursorLayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorDisplays, setCursorDisplays] = useState<CursorDisplay[]>([]);
  const cursorUpdateTimerRef = useRef<number | null>(null);

  const calculateCursorPositions = useCallback(() => {
    if (!editorView || !containerRef.current || !editorContainerRef.current) return;

    const displays: CursorDisplay[] = [];
    const state = editorView.state;
    const scrollDom = editorView.scrollDOM;

    if (!scrollDom) return;

    remoteCursors.forEach((cursor, userId) => {
      if (userId === currentUserId) return;

      try {
        let pos = 0;
        const targetLine = Math.min(cursor.line + 1, state.doc.lines);
        if (targetLine >= 1 && targetLine <= state.doc.lines) {
          const line = state.doc.line(targetLine);
          pos = line.from + Math.min(cursor.column, line.length);
        }

        const coords = editorView.coordsAtPos(pos);

        if (coords && scrollDom) {
          const scrollRect = scrollDom.getBoundingClientRect();
          const containerRect = containerRef.current!.getBoundingClientRect();

          const member = members.find((m) => m.id === userId);
          const color = member?.color || '#FF6B6B';
          const nickname = member?.nickname || 'Unknown';

          const charHeight = coords.bottom - coords.top;
          const adjustedTop = coords.top - scrollRect.top + containerRect.top - 2;

          displays.push({
            userId,
            top: adjustedTop,
            left: coords.left - scrollRect.left + containerRect.left,
            height: charHeight,
            color,
            nickname,
          });
        }
      } catch (e) {
        console.warn('Error calculating cursor position:', e);
      }
    });

    setCursorDisplays(displays);
  }, [editorView, remoteCursors, currentUserId, members, editorContainerRef]);

  useEffect(() => {
    const debouncedCalculate = () => {
      if (cursorUpdateTimerRef.current) {
        cancelAnimationFrame(cursorUpdateTimerRef.current);
      }
      cursorUpdateTimerRef.current = requestAnimationFrame(() => {
        calculateCursorPositions();
      });
    };

    debouncedCalculate();

    return () => {
      if (cursorUpdateTimerRef.current) {
        cancelAnimationFrame(cursorUpdateTimerRef.current);
      }
    };
  }, [calculateCursorPositions]);

  useEffect(() => {
    if (!editorView) return;

    const scrollHandler = () => {
      if (cursorUpdateTimerRef.current) {
        cancelAnimationFrame(cursorUpdateTimerRef.current);
      }
      cursorUpdateTimerRef.current = requestAnimationFrame(() => {
        calculateCursorPositions();
      });
    };

    const dom = editorView.dom;
    if (dom) {
      dom.addEventListener('scroll', scrollHandler, { passive: true });
    }
    window.addEventListener('resize', scrollHandler, { passive: true });

    return () => {
      if (dom) {
        dom.removeEventListener('scroll', scrollHandler);
      }
      window.removeEventListener('resize', scrollHandler);
      if (cursorUpdateTimerRef.current) {
        cancelAnimationFrame(cursorUpdateTimerRef.current);
      }
    };
  }, [editorView, calculateCursorPositions]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      {cursorDisplays.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute"
          style={{
            top: cursor.top,
            left: cursor.left,
          }}
        >
          <div
            style={{
              width: '2px',
              height: cursor.height,
              backgroundColor: cursor.color,
              boxShadow: `0 0 8px ${cursor.color}, 0 0 16px ${cursor.color}40`,
              animation: 'cursorBlink 1s infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-22px',
              left: '0',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 500,
              color: 'white',
              whiteSpace: 'nowrap',
              borderRadius: '4px 4px 4px 0',
              fontFamily: "'JetBrains Mono', monospace",
              backgroundColor: cursor.color,
              boxShadow: `0 2px 8px ${cursor.color}40`,
              zIndex: 11,
            }}
          >
            {cursor.nickname}
          </div>
        </div>
      ))}
    </div>
  );
};
