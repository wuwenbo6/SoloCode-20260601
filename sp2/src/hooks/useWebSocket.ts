import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { fetchStats, fetchObservers } from '@/lib/api';
import type { TemplateWarning } from './useStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const setStats = useStore((s) => s.setStats);
  const setObservers = useStore((s) => s.setObservers);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const selectedObserver = useStore((s) => s.selectedObserver);
  const setTemplates = useStore((s) => s.setTemplates);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const setFlows = useStore((s) => s.setFlows);
  const addFlowRate = useStore((s) => s.addFlowRate);
  const addWarning = useStore((s) => s.addWarning);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'stats_update') {
            setStats(msg.stats);
            addFlowRate(msg.stats?.flows || 0);
            fetchObservers().then(setObservers).catch(() => {});
          }

          if (msg.type === 'template_update' && msg.sourceId === selectedObserver) {
            fetchTemplates(msg.sourceId).then(setTemplates).catch(() => {});
          }

          if (msg.type === 'flow_record' && msg.sourceId === selectedObserver) {
            if (!selectedTemplate || msg.templateId === selectedTemplate) {
              addFlowRate(1);
            }
          }

          if (msg.type === 'template_warning') {
            const warning: TemplateWarning = {
              id: `${msg.sourceId}-${msg.templateId}-${Date.now()}`,
              sourceId: msg.sourceId,
              templateId: msg.templateId,
              reason: msg.rejectReason || 'Unknown mismatch',
              timestamp: Date.now(),
            };
            addWarning(warning);
          }
        } catch {
          // ignore parse errors
        }
      };
    };

    connect();

    const pollInterval = setInterval(() => {
      fetchStats().then(setStats).catch(() => {});
      fetchObservers().then(setObservers).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedObserver, selectedTemplate, setStats, setObservers, setWsConnected, setTemplates, setFlows, addFlowRate, addWarning]);

  return wsRef;
}

async function fetchTemplates(sourceId: number) {
  const res = await fetch(`/api/observers/${sourceId}/templates`);
  return res.json();
}
