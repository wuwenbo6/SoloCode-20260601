const API_BASE = '/api';
const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
})();

export interface IOWindow {
  id: string;
  startOffsetMs: number;
  durationMs: number;
}

export interface SimulatorConfig {
  cycleMs: number;
  windows: IOWindow[];
  autoSubmitIntervalMs: number;
}

export interface Stats {
  totalAttempts: number;
  successCount: number;
  rejectedCount: number;
}

export interface IOResult {
  id: string;
  timestamp: number;
  windowOpen: boolean;
  success: boolean;
  errorMessage?: string;
  inFlight?: number;
}

export interface NamespaceStatus {
  name: string;
  running: boolean;
  currentWindowOpen: boolean;
  nextWindowOpenInMs: number;
  cyclePositionMs: number;
  cycleMs: number;
  stats: Stats;
  recentResults: IOResult[];
  windows: IOWindow[];
  inFlight: number;
  cycleUtilPct: number;
}

export interface WindowUtilization {
  windowId: string;
  windowIndex: number;
  startOffsetMs: number;
  durationMs: number;
  endOffsetMs: number;
  cycleUtilPct: number;
  effectiveUtilPct: number;
  ioSuccessCount: number;
  ioRejectedCount: number;
}

export interface UtilizationReport {
  namespace: string;
  cycleMs: number;
  totalWindowMs: number;
  totalGapMs: number;
  cycleUtilPct: number;
  effectiveUtilPct: number;
  totalIoSuccess: number;
  totalIoRejected: number;
  overallSuccessRate: number;
  windows: WindowUtilization[];
  generatedAt: number;
}

export interface WSMessage {
  type: 'status' | 'io_result' | 'window_change';
  namespace: string;
  payload: NamespaceStatus | IOResult | { windowOpen: boolean };
}

export async function fetchNamespaces(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/namespaces`);
  return res.json();
}

export async function createNamespace(name: string): Promise<NamespaceStatus> {
  const res = await fetch(`${API_BASE}/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteNamespace(name: string): Promise<void> {
  await fetch(`${API_BASE}/namespaces?ns=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function fetchStatus(namespace = 'ns0'): Promise<NamespaceStatus> {
  const res = await fetch(`${API_BASE}/status?ns=${encodeURIComponent(namespace)}`);
  return res.json();
}

export async function fetchAllStatus(): Promise<Record<string, NamespaceStatus>> {
  const res = await fetch(`${API_BASE}/status/all`);
  return res.json();
}

export async function updateConfig(namespace: string, config: SimulatorConfig): Promise<NamespaceStatus> {
  const res = await fetch(`${API_BASE}/config?ns=${encodeURIComponent(namespace)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function startSimulator(namespace = 'ns0'): Promise<{ namespace: string; running: boolean }> {
  const res = await fetch(`${API_BASE}/start?ns=${encodeURIComponent(namespace)}`, { method: 'POST' });
  return res.json();
}

export async function stopSimulator(namespace = 'ns0'): Promise<{ namespace: string; running: boolean }> {
  const res = await fetch(`${API_BASE}/stop?ns=${encodeURIComponent(namespace)}`, { method: 'POST' });
  return res.json();
}

export async function submitIO(namespace = 'ns0'): Promise<IOResult> {
  const res = await fetch(`${API_BASE}/io/submit?ns=${encodeURIComponent(namespace)}`, { method: 'POST' });
  return res.json();
}

export async function fetchLogs(namespace = 'ns0'): Promise<IOResult[]> {
  const res = await fetch(`${API_BASE}/logs?ns=${encodeURIComponent(namespace)}`);
  return res.json();
}

export async function fetchReport(namespace?: string): Promise<UtilizationReport | UtilizationReport[]> {
  const params = namespace ? `?ns=${encodeURIComponent(namespace)}` : '';
  const res = await fetch(`${API_BASE}/report${params}`);
  return res.json();
}

export function getReportUrl(format: 'json' | 'csv', namespace?: string): string {
  const params = new URLSearchParams({ format });
  if (namespace) params.set('ns', namespace);
  return `${API_BASE}/report?${params.toString()}`;
}

export interface WSMessageWithNS extends WSMessage {
  namespace: string;
}

export function connectWebSocket(
  onMessage: (msg: WSMessageWithNS) => void,
): WebSocket {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (event) => {
    try {
      const msg: WSMessageWithNS = JSON.parse(event.data);
      onMessage(msg);
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  };
  ws.onclose = () => {
    setTimeout(() => {
      connectWebSocket(onMessage);
    }, 2000);
  };
  ws.onerror = () => {
    ws.close();
  };
  return ws;
}
