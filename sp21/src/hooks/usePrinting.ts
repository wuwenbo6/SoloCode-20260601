import { useState, useCallback, useRef, useEffect } from 'react';
import { ESCPOSCommand } from '../utils/escpos';
import { printerManager } from '../utils/webusb';
import { printQueue } from '../utils/printQueue';
import { usePrinterStore } from '../store/printerStore';
import { historyApi } from '../utils/api';
import type { PrintTemplate, PrintQueueItem } from '../../shared/types';

export function usePrinting() {
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [printQueueItems, setPrintQueueItems] = useState<PrintQueueItem[]>([]);
  const { printers, selectedPrinterId, selectedTemplate, setPrinting } = usePrinterStore();
  const abortRef = useRef(false);

  useEffect(() => {
    const unsubscribe = printQueue.subscribe((queue) => {
      setPrintQueueItems(queue);
    });

    printQueue.startProcessing();

    return () => {
      unsubscribe();
      printQueue.stopProcessing();
    };
  }, []);

  const generatePrintData = useCallback((template: PrintTemplate, data: Record<string, any>) => {
    const content = ESCPOSCommand.parseTemplate(template.content, data);
    const cmd = ESCPOSCommand.textToCommands(content, template.width);
    return cmd.toUint8Array();
  }, []);

  const getPrintableContent = useCallback((template: PrintTemplate, data: Record<string, any>) => {
    return ESCPOSCommand.parseTemplate(template.content, data);
  }, []);

  const print = useCallback(async (
    template: PrintTemplate,
    formData: Record<string, any>,
    printerId?: string
  ) => {
    const targetPrinterId = printerId || selectedPrinterId;
    const printer = targetPrinterId
      ? printerManager.getPrinter(targetPrinterId)
      : printerManager.getDefaultPrinter();

    if (!printer) {
      throw new Error('请先连接打印机');
    }

    setIsPrinting(true);
    setPrinting(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      const commands = generatePrintData(template, formData);

      setProgress(30);

      if (abortRef.current) {
        throw new Error('打印已取消');
      }

      await printer.print(commands);

      setProgress(100);

      const deviceInfo = printer.getDeviceInfo();
      await historyApi.create({
        templateId: template._id,
        templateName: template.name,
        data: formData,
        status: 'success',
        printerName: deviceInfo.productName,
        printerId: targetPrinterId,
        printedAt: new Date().toISOString()
      });

      setTimeout(() => {
        setIsPrinting(false);
        setPrinting(false);
        setProgress(0);
      }, 500);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '打印失败';
      setError(errorMsg);

      const deviceInfo = printer.getDeviceInfo();
      await historyApi.create({
        templateId: template._id,
        templateName: template.name,
        data: formData,
        status: 'failed',
        errorMessage: errorMsg,
        printerName: deviceInfo.productName,
        printerId: targetPrinterId,
        printedAt: new Date().toISOString()
      });

      setIsPrinting(false);
      setPrinting(false);
      setProgress(0);
      throw err;
    }
  }, [selectedPrinterId, selectedTemplate, generatePrintData, setPrinting]);

  const enqueuePrint = useCallback((
    template: PrintTemplate,
    formData: Record<string, any>,
    printerId?: string,
    options?: { priority?: number; copies?: number }
  ) => {
    const targetPrinterId = printerId || selectedPrinterId;
    const printer = targetPrinterId
      ? printerManager.getPrinter(targetPrinterId)
      : printerManager.getDefaultPrinter();

    const printableContent = getPrintableContent(template, formData);

    const job = printQueue.addJob({
      templateId: template._id,
      templateName: template.name,
      templateContent: printableContent,
      data: formData,
      printerId: targetPrinterId,
      printerName: printer?.getDeviceInfo().productName || '未指定打印机',
      priority: options?.priority,
      copies: options?.copies
    });

    return job;
  }, [selectedPrinterId, getPrintableContent]);

  const cancelQueueJob = useCallback((jobId: string) => {
    return printQueue.cancelJob(jobId);
  }, []);

  const retryQueueJob = useCallback((jobId: string) => {
    return printQueue.retryJob(jobId);
  }, []);

  const cancelPrint = useCallback(() => {
    abortRef.current = true;
  }, []);

  const testPrint = useCallback(async (printerId?: string) => {
    const targetPrinterId = printerId || selectedPrinterId;
    const printer = targetPrinterId
      ? printerManager.getPrinter(targetPrinterId)
      : printerManager.getDefaultPrinter();

    if (!printer) {
      throw new Error('请先连接打印机');
    }

    setIsPrinting(true);
    setError(null);

    try {
      const testContent = `测试打印
----------------
打印机状态: 正常
打印时间: ${new Date().toLocaleString()}
----------------
恭喜！打印机连接成功！
----------------`;

      const cmd = ESCPOSCommand.textToCommands(testContent, 58);
      await printer.print(cmd.toUint8Array());

      setTimeout(() => {
        setIsPrinting(false);
      }, 500);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '测试打印失败';
      setError(errorMsg);
      setIsPrinting(false);
      throw err;
    }
  }, [selectedPrinterId]);

  const printBarcode = useCallback(async (
    content: string,
    type: 'CODE-128' | 'EAN-13' | 'QR' = 'CODE-128',
    printerId?: string
  ) => {
    const targetPrinterId = printerId || selectedPrinterId;
    const printer = targetPrinterId
      ? printerManager.getPrinter(targetPrinterId)
      : printerManager.getDefaultPrinter();

    if (!printer) {
      throw new Error('请先连接打印机');
    }

    setIsPrinting(true);
    setError(null);

    try {
      const cmd = new ESCPOSCommand();
      cmd.initialize();
      cmd.selectChineseMode(true);

      cmd.setAlign('center');
      cmd.line('条形码测试');
      cmd.feedLines(1);

      if (type === 'QR') {
        cmd.qrCode(content, 8, 'M');
      } else {
        cmd.barcode(content, type, 100, 3);
      }

      cmd.feedLines(2);
      cmd.cut('partial');

      await printer.print(cmd.toUint8Array());

      setTimeout(() => {
        setIsPrinting(false);
      }, 500);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '打印失败';
      setError(errorMsg);
      setIsPrinting(false);
      throw err;
    }
  }, [selectedPrinterId]);

  const queueStats = printQueue.getStats();

  return {
    print,
    enqueuePrint,
    cancelQueueJob,
    retryQueueJob,
    cancelPrint,
    testPrint,
    printBarcode,
    isPrinting,
    progress,
    error,
    printQueue: printQueueItems,
    queueStats,
    processQueue: () => printQueue.processQueue()
  };
}
