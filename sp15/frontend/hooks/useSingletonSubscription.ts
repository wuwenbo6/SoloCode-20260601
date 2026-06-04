'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSubscription } from '@apollo/client';

interface SingletonSubscriptionOptions {
  document: any;
  onData: (data: any) => void;
  skip?: boolean;
  channelId: string;
}

export function useSingletonSubscription({
  document,
  onData,
  skip = false,
  channelId,
}: SingletonSubscriptionOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef(false);
  const leaderCheckIntervalRef = useRef<number | null>(null);

  const broadcast = useCallback((type: string, payload: any) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type, payload, timestamp: Date.now() });
    }
  }, []);

  useSubscription(document, {
    onData: ({ data }) => {
      if (isLeaderRef.current) {
        broadcast('subscription-data', data);
        onData(data);
      }
    },
    skip: skip || !isLeaderRef.current,
  });

  useEffect(() => {
    if (skip || typeof window === 'undefined') return;

    const tabId = `${channelId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    channelRef.current = new BroadcastChannel(channelId);

    const requestLeader = () => {
      broadcast('request-leader', { tabId });
    };

    const becomeLeader = () => {
      isLeaderRef.current = true;
      broadcast('i-am-leader', { tabId });
    };

    const checkLeaderAlive = () => {
      broadcast('leader-ping', { tabId });
      setTimeout(() => {
        if (!isLeaderRef.current) {
          becomeLeader();
        }
      }, 50);
    };

    channelRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'subscription-data':
          if (!isLeaderRef.current) {
            onData(payload);
          }
          break;

        case 'request-leader':
          if (isLeaderRef.current) {
            broadcast('i-am-leader', { tabId: 'current-leader' });
          }
          break;

        case 'i-am-leader':
          if (payload.tabId !== tabId) {
            isLeaderRef.current = false;
          }
          break;

        case 'leader-ping':
          if (isLeaderRef.current) {
            broadcast('leader-pong', { tabId });
          }
          break;

        case 'leader-pong':
          isLeaderRef.current = false;
          break;
      }
    };

    requestLeader();

    const timeout = setTimeout(() => {
      if (!isLeaderRef.current) {
        becomeLeader();
      }
    }, 100);

    leaderCheckIntervalRef.current = window.setInterval(() => {
      if (!isLeaderRef.current) {
        checkLeaderAlive();
      }
    }, 5000);

    const handleBeforeUnload = () => {
      if (isLeaderRef.current) {
        broadcast('leader-resigning', { tabId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(timeout);
      if (leaderCheckIntervalRef.current) {
        clearInterval(leaderCheckIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      channelRef.current?.close();
      channelRef.current = null;
      isLeaderRef.current = false;
    };
  }, [document, onData, skip, channelId, broadcast]);

  return {
    isLeader: isLeaderRef.current,
  };
}
