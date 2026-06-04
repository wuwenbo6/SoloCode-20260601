import { useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { fetchStats, fetchObservers, fetchTemplates, fetchFlows } from '@/lib/api';

export function useDataLoader() {
  const selectedObserver = useStore((s) => s.selectedObserver);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const flowPage = useStore((s) => s.flowPage);
  const flowPageSize = useStore((s) => s.flowPageSize);
  const setStats = useStore((s) => s.setStats);
  const setObservers = useStore((s) => s.setObservers);
  const setTemplates = useStore((s) => s.setTemplates);
  const setFlows = useStore((s) => s.setFlows);

  const loadInitial = useCallback(async () => {
    try {
      const [stats, observers] = await Promise.all([fetchStats(), fetchObservers()]);
      setStats(stats);
      setObservers(observers);
    } catch {}
  }, [setStats, setObservers]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (selectedObserver === null) return;
    fetchTemplates(selectedObserver).then(setTemplates).catch(() => {});
  }, [selectedObserver, setTemplates]);

  useEffect(() => {
    if (selectedObserver === null) return;
    fetchFlows(selectedObserver, selectedTemplate || undefined, flowPage, flowPageSize)
      .then((res) => setFlows(res.flows, res.total, res.page, res.pageSize))
      .catch(() => {});
  }, [selectedObserver, selectedTemplate, flowPage, flowPageSize, setFlows]);
}
