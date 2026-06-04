export interface Stats {
  packets: number;
  templates: number;
  observers: number;
  flows: number;
}

export interface Observer {
  sourceId: number;
  address: string;
  lastSeen: string;
  templateCount: number;
  flowCount: number;
}

export interface FieldDef {
  type: number;
  typeName: string;
  length: number;
  isEnterprise: boolean;
  enterpriseNumber?: number;
}

export interface Template {
  templateId: number;
  fieldCount: number;
  fields: FieldDef[];
  lastRefresh: string;
}

export interface FlowResponse {
  flows: FlowRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FlowRecord {
  sourceId: number;
  templateId: number;
  fields: Record<string, unknown>;
  receivedAt: string;
}

const BASE = '/api';

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`);
  return res.json();
}

export async function fetchObservers(): Promise<Observer[]> {
  const res = await fetch(`${BASE}/observers`);
  return res.json();
}

export async function fetchTemplates(sourceId: number): Promise<Template[]> {
  const res = await fetch(`${BASE}/observers/${sourceId}/templates`);
  return res.json();
}

export async function exportTemplatesJSON(sourceId: number) {
  window.open(`${BASE}/observers/${sourceId}/templates/export`, '_blank');
}

export async function fetchFlows(
  sourceId: number,
  templateId?: number,
  page = 1,
  pageSize = 20
): Promise<FlowResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (templateId) params.set('templateId', String(templateId));
  const res = await fetch(`${BASE}/observers/${sourceId}/flows?${params}`);
  return res.json();
}
