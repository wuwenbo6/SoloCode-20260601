import { useState, useCallback, useEffect } from 'react';
import { templateApi, getNetworkStatus, syncPendingOperations } from '../utils/api';
import { templateCache } from '../utils/templateCache';
import type { PrintTemplate, TemplateVariable } from '../../shared/types';

export function useTemplates() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchTemplates = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const response = await templateApi.getAll(page, pageSize);
      if (response.success) {
        setTemplates(response.data || []);
        setTotal(response.total || 0);
        setIsFromCache(response.message?.includes('缓存') || false);
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模板列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplateById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await templateApi.getById(id);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模板详情失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: {
    name: string;
    description: string;
    content: string;
    variables: TemplateVariable[];
    width: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await templateApi.create(data);
      if (response.success && response.data) {
        await fetchTemplates();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建模板失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      content: string;
      variables: TemplateVariable[];
      width: number;
    }>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await templateApi.update(id, data);
      if (response.success && response.data) {
        await fetchTemplates();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新模板失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await templateApi.delete(id);
      if (response.success) {
        await fetchTemplates();
        return true;
      }
      throw new Error(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除模板失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTemplates]);

  const extractVariables = useCallback((content: string): TemplateVariable[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = content.match(regex) || [];
    const varNames = [...new Set(matches.map(m => m.slice(1, -1)))];

    return varNames.map(name => ({
      name,
      label: name,
      type: 'string' as const,
      required: true,
      defaultValue: ''
    }));
  }, []);

  const fillTemplate = useCallback((template: string, data: Record<string, any>): string => {
    let result = template;
    const regex = /\{([^}]+)\}/g;

    result = result.replace(regex, (match, key) => {
      const value = data[key.trim()];
      if (value === undefined || value === null || value === '') {
        return match;
      }
      return String(value);
    });

    return result;
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const handleOnline = async () => {
      const synced = await syncPendingOperations();
      if (synced > 0) {
        await fetchTemplates();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    total,
    isFromCache,
    fetchTemplates,
    fetchTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    extractVariables,
    fillTemplate
  };
}
