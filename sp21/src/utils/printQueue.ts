import type { PrintQueueItem } from '../../shared/types';
import { ESCPOSCommand } from './escpos';
import { printerManager } from './webusb';
import { historyApi } from './api';

const QUEUE_STORAGE_KEY = 'thermal_printer_queue';
const PROCESSING_INTERVAL = 10000;
const MAX_RETRIES = 3;

type QueueCallback = (queue: PrintQueueItem[]) => void;

class PrintQueueManager {
  private queue: PrintQueueItem[] = [];
  private processingTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private callbacks: Set<QueueCallback> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private generateId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    try {
      const cleanQueue = this.queue.filter(q => q.status !== 'completed');
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(cleanQueue));
    } catch {
      // ignore
    }
  }

  private emitChange(): void {
    const snapshot = [...this.queue];
    this.callbacks.forEach(cb => {
      try {
        cb(snapshot);
      } catch {
        // ignore callback errors
      }
    });
  }

  subscribe(callback: QueueCallback): () => void {
    this.callbacks.add(callback);
    callback([...this.queue]);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  addJob(params: {
    templateId: string;
    templateName: string;
    templateContent: string;
    data: Record<string, any>;
    printerId?: string;
    printerName?: string;
    priority?: number;
    copies?: number;
  }): PrintQueueItem {
    const job: PrintQueueItem = {
      id: this.generateId(),
      templateId: params.templateId,
      templateName: params.templateName,
      templateContent: params.templateContent,
      data: params.data,
      printerId: params.printerId,
      printerName: params.printerName,
      status: 'queued',
      priority: params.priority || 5,
      createdAt: new Date().toISOString(),
      retries: 0,
      maxRetries: MAX_RETRIES,
      copies: params.copies || 1
    };

    this.queue.push(job);
    this.queue.sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
    this.saveToStorage();
    this.emitChange();
    this.processQueue();

    return job;
  }

  cancelJob(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId);
    if (!job || job.status === 'printing') return false;

    this.queue = this.queue.filter(j => j.id !== jobId);
    this.saveToStorage();
    this.emitChange();
    return true;
  }

  clearCompleted(): void {
    this.queue = this.queue.filter(j => j.status !== 'completed');
    this.saveToStorage();
    this.emitChange();
  }

  clearFailed(): void {
    this.queue = this.queue.filter(j => j.status !== 'failed');
    this.saveToStorage();
    this.emitChange();
  }

  retryJob(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId);
    if (!job) return false;

    job.status = 'queued';
    job.retries = 0;
    job.errorMessage = undefined;
    this.saveToStorage();
    this.emitChange();
    this.processQueue();
    return true;
  }

  getQueue(): PrintQueueItem[] {
    return [...this.queue];
  }

  getJob(jobId: string): PrintQueueItem | undefined {
    return this.queue.find(j => j.id === jobId);
  }

  getStats(): {
    queued: number;
    printing: number;
    completed: number;
    failed: number;
  } {
    return {
      queued: this.queue.filter(j => j.status === 'queued').length,
      printing: this.queue.filter(j => j.status === 'printing').length,
      completed: this.queue.filter(j => j.status === 'completed').length,
      failed: this.queue.filter(j => j.status === 'failed').length
    };
  }

  startProcessing(interval: number = PROCESSING_INTERVAL): void {
    this.stopProcessing();
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, interval);
  }

  stopProcessing(): void {
    if (this.processingTimer !== null) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  private async printJob(job: PrintQueueItem): Promise<void> {
    const printer = job.printerId
      ? printerManager.getPrinter(job.printerId)
      : printerManager.getDefaultPrinter();

    if (!printer) {
      throw new Error(job.printerId ? '指定的打印机不可用' : '没有可用的打印机');
    }

    const cmd = ESCPOSCommand.textToCommands(job.templateContent, 58);
    const data = cmd.toUint8Array();

    for (let i = 0; i < job.copies; i++) {
      await printer.print(data);
      if (i < job.copies - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  private async recordHistory(job: PrintQueueItem, success: boolean, errorMessage?: string): Promise<void> {
    try {
      const printer = job.printerId
        ? printerManager.getPrinter(job.printerId)
        : printerManager.getDefaultPrinter();

      await historyApi.create({
        templateId: job.templateId,
        templateName: job.templateName,
        data: job.data,
        status: success ? 'success' : 'failed',
        printerName: job.printerName || printer?.getDeviceInfo().productName || '未知打印机',
        printerId: job.printerId,
        printedAt: new Date().toISOString(),
        queueId: job.id,
        errorMessage
      });
    } catch {
      // history recording is best-effort
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = this.queue.filter(j => j.status === 'queued');

      for (const job of pendingJobs) {
        const idx = this.queue.findIndex(j => j.id === job.id);
        if (idx === -1) continue;

        this.queue[idx].status = 'printing';
        this.emitChange();

        try {
          await this.printJob(job);
          this.queue[idx].status = 'completed';
          this.queue[idx].scheduledAt = new Date().toISOString();
          await this.recordHistory(job, true);
        } catch (error) {
          this.queue[idx].retries++;
          const errMsg = error instanceof Error ? error.message : '打印失败';

          if (this.queue[idx].retries >= this.queue[idx].maxRetries) {
            this.queue[idx].status = 'failed';
            this.queue[idx].errorMessage = errMsg;
            await this.recordHistory(job, false, errMsg);
          } else {
            this.queue[idx].status = 'queued';
            this.queue[idx].errorMessage = `${errMsg} (重试 ${this.queue[idx].retries}/${this.queue[idx].maxRetries})`;
          }
        }

        this.saveToStorage();
        this.emitChange();
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const printQueue = new PrintQueueManager();

export type { PrintQueueItem };
