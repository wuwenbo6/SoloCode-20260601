import { create } from 'zustand';
import type { PrinterStatus, PrinterDevice, PrintTemplate, ManagedPrinter } from '../../shared/types';
import { printerManager, beginUserGesture } from '../utils/webusb';
import type { WebUSBCapability } from '../utils/webusb';

interface PrinterState {
  printers: Map<string, ManagedPrinter>;
  defaultPrinterId: string | null;
  selectedPrinterId: string | null;
  selectedTemplate: PrintTemplate | null;
  templates: PrintTemplate[];
  isConnecting: boolean;
  isPrinting: boolean;
  error: string | null;
  capability: WebUSBCapability | null;
}

interface PrinterActions {
  setSelectedTemplate: (template: PrintTemplate | null) => void;
  setTemplates: (templates: PrintTemplate[]) => void;
  setSelectedPrinter: (printerId: string | null) => void;
  setDefaultPrinter: (printerId: string) => boolean;
  setPrinterAlias: (printerId: string, alias: string) => boolean;
  addPrinter: () => Promise<string>;
  removePrinter: (printerId: string) => Promise<boolean>;
  refreshPrinterStatus: (printerId: string) => Promise<void>;
  refreshAllStatuses: () => Promise<void>;
  refreshAllPrinters: () => Promise<void>;
  checkCapability: () => WebUSBCapability;
  reconnectPaired: () => Promise<string[]>;
  setError: (error: string | null) => void;
  setPrinting: (printing: boolean) => void;
  reset: () => void;
}

const initialPrinters = new Map<string, ManagedPrinter>();

export const usePrinterStore = create<PrinterState & PrinterActions>((set, get) => ({
  printers: initialPrinters,
  defaultPrinterId: null,
  selectedPrinterId: null,
  selectedTemplate: null,
  templates: [],
  isConnecting: false,
  isPrinting: false,
  error: null,
  capability: null,

  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setTemplates: (templates) => set({ templates }),
  setSelectedPrinter: (printerId) => set({ selectedPrinterId: printerId }),

  setDefaultPrinter: (printerId) => {
    const success = printerManager.setDefaultPrinter(printerId);
    if (success) {
      set({ defaultPrinterId: printerId });
    }
    return success;
  },

  setPrinterAlias: (printerId, alias) => {
    const success = printerManager.setPrinterAlias(printerId, alias);
    if (success) {
      get().refreshAllPrinters();
    }
    return success;
  },

  checkCapability: () => {
    const capability = printerManager.getCapability();
    set({ capability });
    return capability;
  },

  addPrinter: async () => {
    set({ isConnecting: true, error: null });
    try {
      beginUserGesture();
      const id = await printerManager.requestAndAddPrinter();
      await get().refreshAllPrinters();
      const state = get();
      if (state.selectedPrinterId === null) {
        set({ selectedPrinterId: id });
      }
      return id;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '连接失败' });
      throw error;
    } finally {
      set({ isConnecting: false });
    }
  },

  removePrinter: async (printerId) => {
    const success = await printerManager.removePrinter(printerId);
    if (success) {
      const state = get();
      const newPrinters = new Map(state.printers);
      newPrinters.delete(printerId);
      set({
        printers: newPrinters,
        defaultPrinterId: printerManager.getDefaultPrinter()?.id || null,
        selectedPrinterId: state.selectedPrinterId === printerId ? null : state.selectedPrinterId
      });
    }
    return success;
  },

  refreshPrinterStatus: async (printerId) => {
    const status = await printerManager.getPrinterStatus(printerId);
    if (status) {
      const state = get();
      const printer = state.printers.get(printerId);
      if (printer) {
        const newPrinters = new Map(state.printers);
        newPrinters.set(printerId, { ...printer, status });
        set({ printers: newPrinters });
      }
    }
  },

  refreshAllStatuses: async () => {
    const statuses = await printerManager.getAllStatuses();
    const state = get();
    const newPrinters = new Map(state.printers);
    for (const [id, status] of statuses) {
      const printer = newPrinters.get(id);
      if (printer) {
        newPrinters.set(id, { ...printer, status });
      }
    }
    set({ printers: newPrinters });
  },

  refreshAllPrinters: async () => {
    const all = printerManager.getAllPrinters();
    const newPrinters = new Map<string, ManagedPrinter>();
    const defaultPrinter = printerManager.getDefaultPrinter();

    for (const { id, printer } of all) {
      const status = await printer.getStatus();
      newPrinters.set(id, {
        id,
        device: printer.getDeviceInfo(),
        status,
        isDefault: defaultPrinter?.id === id,
        alias: printer.alias,
        connectedAt: new Date().toISOString()
      });
    }

    set({
      printers: newPrinters,
      defaultPrinterId: defaultPrinter?.id || null
    });
  },

  reconnectPaired: async () => {
    const ids = await printerManager.reconnectPairedPrinters();
    if (ids.length > 0) {
      await get().refreshAllPrinters();
    }
    return ids;
  },

  setError: (error) => set({ error }),
  setPrinting: (printing) => set({ isPrinting: printing }),

  reset: () => {
    set({
      printers: new Map(),
      defaultPrinterId: null,
      selectedPrinterId: null,
      selectedTemplate: null,
      isConnecting: false,
      isPrinting: false,
      error: null
    });
  }
}));

export { printerManager };
