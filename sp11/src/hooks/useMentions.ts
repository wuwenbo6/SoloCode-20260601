import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSignaling } from './useSignaling';
import { User } from '../types';

interface MentionMatch {
  userName: string;
  userId?: string;
  position: { line: number; column: number };
}

export const useMentions = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const {
    currentUser,
    roomMembers,
    addNotification,
  } = useStore();
  const { sendMentionNotification } = useSignaling();

  const lastContentRef = useRef<string>('');
  const sentMentionsRef = useRef<Set<string>>(new Set());

  const parseMentions = useCallback(
    (content: string): MentionMatch[] => {
      const mentions: MentionMatch[] = [];
      const lines = content.split('\n');

      lines.forEach((line, lineIndex) => {
        const regex = /@(\w+)/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          mentions.push({
            userName: match[1],
            position: {
              line: lineIndex,
              column: match.index,
            },
          });
        }
      });

      return mentions;
    },
    []
  );

  const findMatchingUser = useCallback(
    (userName: string): User | undefined => {
      return roomMembers.find(
        (member) =>
          member.nickname.toLowerCase() === userName.toLowerCase() ||
          member.nickname.toLowerCase().startsWith(userName.toLowerCase())
      );
    },
    [roomMembers]
  );

  const checkNewMentions = useCallback(
    (newContent: string, oldContent: string) => {
      if (!currentUser || !roomId) return;

      const newMentions = parseMentions(newContent);
      const oldMentions = parseMentions(oldContent);

      const oldMentionKeys = new Set(
        oldMentions.map((m) => `${m.userName}-${m.position.line}-${m.position.column}`)
      );

      newMentions.forEach((mention) => {
        const key = `${mention.userName}-${mention.position.line}-${mention.position.column}`;

        if (!oldMentionKeys.has(key) && !sentMentionsRef.current.has(key)) {
          const matchingUser = findMatchingUser(mention.userName);

          if (matchingUser && matchingUser.id !== currentUser.id) {
            sentMentionsRef.current.add(key);

            sendMentionNotification(
              roomId,
              matchingUser.id,
              currentUser,
              `在第 ${mention.position.line + 1} 行提到了你`,
              mention.position
            );
          }
        }
      });
    },
    [currentUser, roomId, parseMentions, findMatchingUser, sendMentionNotification]
  );

  const onContentChange = useCallback(
    (newContent: string) => {
      if (lastContentRef.current && lastContentRef.current !== newContent) {
        checkNewMentions(newContent, lastContentRef.current);
      }
      lastContentRef.current = newContent;
    },
    [checkNewMentions]
  );

  const resetMentions = useCallback(() => {
    sentMentionsRef.current.clear();
    lastContentRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      resetMentions();
    };
  }, [resetMentions]);

  return {
    parseMentions,
    findMatchingUser,
    onContentChange,
    resetMentions,
  };
};
