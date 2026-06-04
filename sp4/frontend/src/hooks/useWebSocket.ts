import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '../types';
import { useStore } from '../store';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const setProcesses = useStore((s) => s.setProcesses);
  const setSystemMetrics = useStore((s) => s.setSystemMetrics);
  const setWsConnected = useStore((s) => s.setWsConnected);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8080/ws/metrics`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      reconnectRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === 'metrics_update') {
          const data = msg.data;
          setSystemMetrics(data.system);
          setProcesses(data.processes);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        console.error('WebSocket error:', event);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnectRef.current = Math.min(reconnectRef.current + 1, 10);
      const delay = Math.pow(2, reconnectRef.current) * 500;
      setTimeout(connect, delay);
    };

    wsRef.current = ws;
  }, [setProcesses, setSystemMetrics, setWsConnected]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { disconnect };
}
