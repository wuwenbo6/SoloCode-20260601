import type { PrintTemplate } from '../../shared/types';

const CACHE_KEY_PREFIX = 'thermal_printer_';
const TEMPLATES_CACHE_KEY = `${CACHE_KEY_PREFIX}templates`;
const TEMPLATE_CACHE_PREFIX = `${CACHE_KEY_PREFIX}template_`;
const CACHE_TIMESTAMP_KEY = `${CACHE_KEY_PREFIX}cache_ts`;
const CACHE_TTL = 30 * 60 * 1000;

export const templateCache = {
  saveTemplates(templates: PrintTemplate[]): void {
    try {
      localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(templates));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('[Cache] Failed to save templates:', e);
      this.evictIfNeeded();
      try {
        localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(templates));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch {
        // storage full, give up
      }
    }
  },

  loadTemplates(): PrintTemplate[] | null {
    try {
      const raw = localStorage.getItem(TEMPLATES_CACHE_KEY);
      if (!raw) return null;

      const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (ts) {
        const age = Date.now() - parseInt(ts, 10);
        if (age > CACHE_TTL) {
          return JSON.parse(raw) as PrintTemplate[];
        }
      }

      return JSON.parse(raw) as PrintTemplate[];
    } catch {
      return null;
    }
  },

  saveTemplate(template: PrintTemplate): void {
    try {
      localStorage.setItem(
        `${TEMPLATE_CACHE_PREFIX}${template._id}`,
        JSON.stringify(template)
      );
    } catch {
      // ignore
    }
  },

  loadTemplate(id: string): PrintTemplate | null {
    try {
      const raw = localStorage.getItem(`${TEMPLATE_CACHE_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  removeTemplate(id: string): void {
    localStorage.removeItem(`${TEMPLATE_CACHE_PREFIX}${id}`);
  },

  clearAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  isCacheStale(): boolean {
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > CACHE_TTL;
  },

  getCacheAge(): number {
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!ts) return Infinity;
    return Date.now() - parseInt(ts, 10);
  },

  evictIfNeeded(): void {
    const cacheKeys: { key: string; ts: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        cacheKeys.push({ key, ts: 0 });
      }
    }
    cacheKeys.sort(() => Math.random() - 0.5);
    const toRemove = cacheKeys.slice(0, Math.ceil(cacheKeys.length * 0.3));
    toRemove.forEach(item => localStorage.removeItem(item.key));
  }
};

const PENDING_QUEUE_KEY = `${CACHE_KEY_PREFIX}pending_ops`;

interface PendingOp {
  id: string;
  type: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
}

export const pendingOps = {
  enqueue(op: PendingOp): void {
    const queue = this.getQueue();
    const existingIdx = queue.findIndex(q => q.id === op.id && q.type === op.type);
    if (existingIdx >= 0) {
      queue[existingIdx] = op;
    } else {
      queue.push(op);
    }
    try {
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
  },

  getQueue(): PendingOp[] {
    try {
      const raw = localStorage.getItem(PENDING_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  remove(id: string, type: string): void {
    const queue = this.getQueue().filter(q => !(q.id === id && q.type === type));
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  },

  clear(): void {
    localStorage.removeItem(PENDING_QUEUE_KEY);
  },

  hasPending(): boolean {
    return this.getQueue().length > 0;
  }
};
