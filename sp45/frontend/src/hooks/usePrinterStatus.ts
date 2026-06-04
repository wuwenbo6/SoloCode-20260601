import { useState, useEffect, useCallback, useRef } from 'react';
import type { PrinterStatus, TemperaturePoint } from '../types';
import { createWebSocket } from '../services/api';

export function usePrinterStatus() {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempHistory, setTempHistory] = useState<TemperaturePoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = createWebSocket('/api/ws/status');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data: PrinterStatus = JSON.parse(event.data);
          setStatus(data);

          setTempHistory((prev) => {
            const newPoint: TemperaturePoint = {
              timestamp: new Date().toISOString(),
              nozzle: data.nozzle_temp,
              bed: data.bed_temp,
            };
            const updated = [...prev, newPoint];
            if (updated.length > 60) {
              return updated.slice(-60);
            }
            return updated;
          });
        } catch (e) {
          console.error('Failed to parse status message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setError('Connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (e) {
      setError('Failed to connect');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    connected,
    error,
    tempHistory,
    reconnect: connect,
    disconnect,
  };
}
