import type { PrinterStatus, PrinterDevice, ManagedPrinter } from '../../shared/types';
import { parseStatus, SUPPORTED_PRINTERS } from './escpos';

export interface PrinterInstance {
  id: string;
  device: USBDevice;
  endpointIn: number;
  endpointOut: number;
  interfaceNumber: number;
  statusPollingTimer: ReturnType<typeof setInterval> | null;
  onStatusChange?: (id: string, status: PrinterStatus) => void;
}

export interface WebUSBCapability {
  supported: boolean;
  isSecureContext: boolean;
  isHTTPS: boolean;
  isLocalhost: boolean;
  hasUSBApi: boolean;
  reason?: string;
}

export function checkWebUSBCapability(): WebUSBCapability {
  const isSecureContext = window.isSecureContext;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const isHTTPS = protocol === 'https:';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const hasUSBApi = 'usb' in navigator;

  if (!isSecureContext && !isLocalhost) {
    return {
      supported: false,
      isSecureContext,
      isHTTPS,
      isLocalhost,
      hasUSBApi,
      reason: 'WebUSB 需要安全上下文（HTTPS）。请通过 HTTPS 访问本应用，或将部署在 localhost 上。'
    };
  }

  if (!hasUSBApi) {
    return {
      supported: false,
      isSecureContext,
      isHTTPS,
      isLocalhost,
      hasUSBApi,
      reason: '当前浏览器不支持 WebUSB API，请使用 Chrome 61+ 或其他基于 Chromium 的浏览器。'
    };
  }

  return {
    supported: true,
    isSecureContext,
    isHTTPS,
    isLocalhost,
    hasUSBApi
  };
}

let userGestureActive = false;

export function beginUserGesture(): void {
  userGestureActive = true;
  setTimeout(() => {
    userGestureActive = false;
  }, 3000);
}

export function isUserGestureActive(): boolean {
  return userGestureActive;
}

function generatePrinterId(): string {
  return `printer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDeviceIdentifier(device: USBDevice): string {
  const serial = device.serialNumber || 'no_serial';
  return `${device.vendorId.toString(16)}_${device.productId.toString(16)}_${serial}`;
}

class SinglePrinter {
  id: string;
  device: USBDevice;
  endpointIn: number = 0;
  endpointOut: number = 0;
  interfaceNumber: number = 0;
  statusPollingTimer: ReturnType<typeof setInterval> | null = null;
  alias?: string;

  constructor(device: USBDevice, id?: string) {
    this.device = device;
    this.id = id || generatePrinterId();
  }

  getDeviceInfo(): PrinterDevice {
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName || '未知设备',
      manufacturerName: this.device.manufacturerName || '未知厂商',
      serialNumber: this.device.serialNumber || ''
    };
  }

  getManagedInfo(status: PrinterStatus, isDefault: boolean = false): ManagedPrinter {
    return {
      id: this.id,
      device: this.getDeviceInfo(),
      status,
      isDefault,
      alias: this.alias,
      connectedAt: new Date().toISOString()
    };
  }

  async connect(): Promise<void> {
    if (!this.device) {
      throw new Error('打印机设备不存在');
    }

    try {
      if (!this.device.opened) {
        await this.device.open();
      }

      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      const config = this.device.configuration;
      let found = false;

      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 7) {
            this.interfaceNumber = iface.interfaceNumber;
            if (!iface.claimed) {
              await this.device.claimInterface(this.interfaceNumber);
            }

            for (const endpoint of alt.endpoints) {
              if (endpoint.direction === 'in') {
                this.endpointIn = endpoint.endpointNumber;
              } else if (endpoint.direction === 'out') {
                this.endpointOut = endpoint.endpointNumber;
              }
            }
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        for (const iface of config.interfaces) {
          if (iface.claimed) continue;
          if (iface.alternates.length > 0) {
            this.interfaceNumber = iface.interfaceNumber;
            try {
              await this.device.claimInterface(this.interfaceNumber);
            } catch {
              continue;
            }

            for (const endpoint of iface.alternates[0].endpoints) {
              if (endpoint.direction === 'in') {
                this.endpointIn = endpoint.endpointNumber;
              } else if (endpoint.direction === 'out') {
                this.endpointOut = endpoint.endpointNumber;
              }
            }
            found = true;
            break;
          }
        }
      }

      if (!found) {
        throw new Error('未找到可用的打印机接口');
      }
    } catch (error) {
      await this.disconnect();
      if (error instanceof Error && error.name === 'SecurityError') {
        throw new Error(
          '接口占用或权限不足。请确保：\n' +
          '1. 打印机未被其他程序占用\n' +
          '2. 浏览器已获取 USB 设备权限'
        );
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopStatusPolling();
    if (this.device) {
      try {
        if (this.device.opened) {
          try {
            await this.device.releaseInterface(this.interfaceNumber);
          } catch {
            // interface may already be released
          }
          await this.device.close();
        }
      } catch (error) {
        console.error('Error disconnecting printer:', error);
      }
    }
  }

  async sendData(data: ArrayBuffer | Uint8Array): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('打印机未连接');
    }

    if (this.endpointOut === 0) {
      throw new Error('未找到输出端点');
    }

    const buffer = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

    try {
      const CHUNK_SIZE = 4096;
      if (buffer.byteLength <= CHUNK_SIZE) {
        const result = await this.device.transferOut(this.endpointOut, buffer);
        if (result.status !== 'ok') {
          throw new Error(`数据传输失败: ${result.status}`);
        }
      } else {
        let offset = 0;
        while (offset < buffer.byteLength) {
          const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
          const result = await this.device.transferOut(this.endpointOut, chunk);
          if (result.status !== 'ok') {
            throw new Error(`数据传输失败 (偏移 ${offset}): ${result.status}`);
          }
          offset += CHUNK_SIZE;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async receiveData(length: number = 64): Promise<Uint8Array | null> {
    if (!this.device || !this.device.opened) {
      throw new Error('打印机未连接');
    }

    if (this.endpointIn === 0) {
      return null;
    }

    try {
      const result = await this.device.transferIn(this.endpointIn, length);
      if (result.status === 'ok' && result.data) {
        return new Uint8Array(result.data.buffer);
      }
      return null;
    } catch (error) {
      console.error('Error receiving data:', error);
      return null;
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.device || !this.device.opened) {
      return {
        connected: false,
        online: false,
        paperOk: false,
        temperatureOk: false,
        coverOpen: false,
        errorMessage: '打印机未连接'
      };
    }

    try {
      const statusCmd = new Uint8Array([0x10, 0x04, 0x01]);
      await this.sendData(statusCmd);

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await this.receiveData(8);

      if (response && response.length > 0) {
        const status = parseStatus(response);
        return {
          connected: true,
          ...status
        };
      }

      const paperCmd = new Uint8Array([0x10, 0x04, 0x04]);
      await this.sendData(paperCmd);
      await new Promise(resolve => setTimeout(resolve, 100));
      const paperResponse = await this.receiveData(8);

      if (paperResponse && paperResponse.length > 0) {
        const status = parseStatus(paperResponse);
        return {
          connected: true,
          ...status
        };
      }

      return {
        connected: true,
        online: true,
        paperOk: true,
        temperatureOk: true,
        coverOpen: false
      };
    } catch (error) {
      return {
        connected: false,
        online: false,
        paperOk: false,
        temperatureOk: false,
        coverOpen: false,
        errorMessage: error instanceof Error ? error.message : '获取状态失败'
      };
    }
  }

  async print(commands: ArrayBuffer | Uint8Array): Promise<void> {
    const status = await this.getStatus();

    if (!status.connected) {
      throw new Error(status.errorMessage || '打印机未连接');
    }

    if (!status.online) {
      throw new Error(status.errorMessage || '打印机离线');
    }

    if (!status.paperOk) {
      throw new Error(status.errorMessage || '缺纸，请更换纸卷');
    }

    if (!status.temperatureOk) {
      throw new Error(status.errorMessage || '打印头过热，请稍后再试');
    }

    if (status.coverOpen) {
      throw new Error(status.errorMessage || '请关闭打印机机盖');
    }

    await this.sendData(commands);
  }

  startStatusPolling(interval: number = 3000, callback?: (status: PrinterStatus) => void): void {
    this.stopStatusPolling();
    this.statusPollingTimer = setInterval(async () => {
      const status = await this.getStatus();
      callback?.(status);
    }, interval);
  }

  stopStatusPolling(): void {
    if (this.statusPollingTimer !== null) {
      clearInterval(this.statusPollingTimer);
      this.statusPollingTimer = null;
    }
  }
}

class MultiPrinterManager {
  private printers: Map<string, SinglePrinter> = new Map();
  private defaultPrinterId: string | null = null;
  private onPrinterChange: (() => void) | null = null;
  private cleanupEvents: (() => void) | null = null;

  isSupported(): boolean {
    return checkWebUSBCapability().supported;
  }

  getCapability(): WebUSBCapability {
    return checkWebUSBCapability();
  }

  setOnPrinterChange(callback: () => void): void {
    this.onPrinterChange = callback;
  }

  private emitChange(): void {
    this.onPrinterChange?.();
  }

  async requestAndAddPrinter(): Promise<string> {
    const capability = checkWebUSBCapability();
    if (!capability.supported) {
      throw new Error(capability.reason || '当前环境不支持 WebUSB');
    }

    if (!userGestureActive) {
      console.warn('[WebUSB] requestDevice 应由用户手势触发');
    }

    const filters = SUPPORTED_PRINTERS.map(p => ({ vendorId: p.vendorId }));

    try {
      const device = await navigator.usb.requestDevice({ filters });
      return this.addPrinter(device);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error('未选择任何设备');
        }
        if (error.name === 'SecurityError') {
          throw new Error(
            '浏览器安全策略阻止了 USB 设备访问。请确保：\n' +
            '1. 通过 HTTPS 或 localhost 访问\n' +
            '2. 由用户手势（如按钮点击）触发连接\n' +
            '3. 浏览器未禁用 WebUSB 权限'
          );
        }
      }
      throw error;
    }
  }

  async addPrinter(device: USBDevice): Promise<string> {
    const deviceId = getDeviceIdentifier(device);

    for (const [id, printer] of this.printers) {
      if (getDeviceIdentifier(printer.device) === deviceId) {
        throw new Error('该打印机已连接');
      }
    }

    const printer = new SinglePrinter(device);
    await printer.connect();

    this.printers.set(printer.id, printer);

    if (this.printers.size === 1) {
      this.defaultPrinterId = printer.id;
    }

    this.emitChange();
    return printer.id;
  }

  async removePrinter(printerId: string): Promise<boolean> {
    const printer = this.printers.get(printerId);
    if (!printer) return false;

    await printer.disconnect();
    this.printers.delete(printerId);

    if (this.defaultPrinterId === printerId) {
      const remaining = Array.from(this.printers.keys());
      this.defaultPrinterId = remaining.length > 0 ? remaining[0] : null;
    }

    this.emitChange();
    return true;
  }

  getPrinter(printerId: string): SinglePrinter | undefined {
    return this.printers.get(printerId);
  }

  getDefaultPrinter(): SinglePrinter | null {
    if (!this.defaultPrinterId) return null;
    return this.printers.get(this.defaultPrinterId) || null;
  }

  setDefaultPrinter(printerId: string): boolean {
    if (!this.printers.has(printerId)) return false;
    this.defaultPrinterId = printerId;
    this.emitChange();
    return true;
  }

  getAllPrinters(): Array<{ id: string; printer: SinglePrinter }> {
    return Array.from(this.printers.entries()).map(([id, printer]) => ({ id, printer }));
  }

  getPrinterCount(): number {
    return this.printers.size;
  }

  hasPrinter(printerId: string): boolean {
    return this.printers.has(printerId);
  }

  async reconnectPairedPrinters(): Promise<string[]> {
    const reconnected: string[] = [];

    try {
      const devices = await navigator.usb.getDevices();
      const supportedDevices = devices.filter(d =>
        SUPPORTED_PRINTERS.some(p => p.vendorId === d.vendorId)
      );

      for (const device of supportedDevices) {
        try {
          const id = await this.addPrinter(device);
          reconnected.push(id);
        } catch {
          // skip failed
        }
      }
    } catch {
      // ignore
    }

    return reconnected;
  }

  setPrinterAlias(printerId: string, alias: string): boolean {
    const printer = this.printers.get(printerId);
    if (!printer) return false;
    printer.alias = alias;
    this.emitChange();
    return true;
  }

  async getPrinterStatus(printerId: string): Promise<PrinterStatus | null> {
    const printer = this.printers.get(printerId);
    if (!printer) return null;
    return printer.getStatus();
  }

  async getAllStatuses(): Promise<Map<string, PrinterStatus>> {
    const result = new Map<string, PrinterStatus>();
    for (const [id, printer] of this.printers) {
      result.set(id, await printer.getStatus());
    }
    return result;
  }

  async printToPrinter(printerId: string, commands: ArrayBuffer | Uint8Array): Promise<void> {
    const printer = this.printers.get(printerId);
    if (!printer) {
      throw new Error('打印机不存在');
    }
    await printer.print(commands);
  }

  async printToDefault(commands: ArrayBuffer | Uint8Array): Promise<void> {
    const printer = this.getDefaultPrinter();
    if (!printer) {
      throw new Error('没有默认打印机');
    }
    await printer.print(commands);
  }

  registerUSBEvents(): () => void {
    const onConnect = async (event: USBConnectionEvent) => {
      const isSupported = SUPPORTED_PRINTERS.some(p => p.vendorId === event.device.vendorId);
      if (isSupported) {
        try {
          await this.addPrinter(event.device);
        } catch {
          // may already be connected
        }
      }
    };

    const onDisconnect = (event: USBConnectionEvent) => {
      const deviceId = getDeviceIdentifier(event.device);
      for (const [id, printer] of this.printers) {
        if (getDeviceIdentifier(printer.device) === deviceId) {
          this.printers.delete(id);
          if (this.defaultPrinterId === id) {
            const remaining = Array.from(this.printers.keys());
            this.defaultPrinterId = remaining.length > 0 ? remaining[0] : null;
          }
          this.emitChange();
          break;
        }
      }
    };

    navigator.usb.addEventListener('connect', onConnect);
    navigator.usb.addEventListener('disconnect', onDisconnect);

    const cleanup = () => {
      navigator.usb.removeEventListener('connect', onConnect);
      navigator.usb.removeEventListener('disconnect', onDisconnect);
    };

    this.cleanupEvents = cleanup;
    return cleanup;
  }

  async cleanup(): Promise<void> {
    this.cleanupEvents?.();
    for (const printer of this.printers.values()) {
      await printer.disconnect();
    }
    this.printers.clear();
    this.defaultPrinterId = null;
  }
}

export const printerManager = new MultiPrinterManager();
export { SinglePrinter };
