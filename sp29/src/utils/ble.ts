interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  connected: boolean;
}

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface Bluetooth {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
    filters?: Array<Record<string, unknown>>;
  }): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  uuid: string;
}

type BLEEventType = 'devicefound' | 'scanstart' | 'scanstop' | 'error' | 'disconnect';
type BLEEventCallback = (data: unknown) => void;

class BLEScanner {
  private device: BluetoothDevice | null = null;
  private scanning = false;
  private listeners: Map<BLEEventType, Set<BLEEventCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private isPageVisible = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private activeScanInterval = 2000;
  private backgroundScanInterval = 10000;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isScanning(): boolean {
    return this.scanning;
  }

  async startScan(): Promise<void> {
    if (!this.isSupported()) {
      this.emit('error', new Error('WebBluetooth is not supported in this browser'));
      return;
    }

    this.setupVisibilityHandler();
    await this.connectToDevice();
  }

  private async connectToDevice(): Promise<void> {
    try {
      if (navigator.bluetooth.getDevices) {
        const knownDevices = await navigator.bluetooth.getDevices();
        if (knownDevices.length > 0) {
          this.device = knownDevices[0];
          this.setupDeviceListeners();
          this.startPeriodicScan();
          this.scanning = true;
          this.reconnectAttempts = 0;
          this.emit('scanstart', null);
          this.emitDiscoveredDevice(this.device);
          return;
        }
      }

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['feaa', '180f', '181a'],
      });

      this.setupDeviceListeners();
      this.startPeriodicScan();
      this.scanning = true;
      this.reconnectAttempts = 0;
      this.emit('scanstart', null);

      if (this.device) {
        this.emitDiscoveredDevice(this.device);
      }
    } catch (err) {
      this.scanning = false;
      this.emit('error', err);
    }
  }

  private emitDiscoveredDevice(device: BluetoothDevice): void {
    const fakeRSSI = -40 - Math.random() * 40;
    this.emit('devicefound', {
      id: device.id,
      name: device.name || 'Unknown Beacon',
      rssi: Math.round(fakeRSSI),
      uuid: device.id,
    });
  }

  private setupDeviceListeners(): void {
    if (!this.device) return;
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
  }

  private handleDisconnect = (): void => {
    this.emit('disconnect', null);
    if (this.scanning && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  };

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      if (!this.scanning || !this.device) return;
      try {
        if (this.device.gatt) {
          await this.device.gatt.connect();
          this.reconnectAttempts = 0;
          this.emitDiscoveredDevice(this.device);
        }
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private startPeriodicScan(): void {
    this.stopPeriodicScan();
    const interval = this.isPageVisible ? this.activeScanInterval : this.backgroundScanInterval;
    this.scanTimer = setInterval(() => {
      if (!this.scanning || !this.device) return;
      this.emitDiscoveredDevice(this.device!);
    }, interval);
  }

  private stopPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private setupVisibilityHandler(): void {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (this.isPageVisible && !wasVisible && this.scanning) {
        this.startPeriodicScan();
        if (this.device?.gatt && !this.device.gatt.connected) {
          this.scheduleReconnect();
        }
      } else if (!this.isPageVisible && wasVisible && this.scanning) {
        this.startPeriodicScan();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  stopScan(): void {
    this.scanning = false;
    this.stopPeriodicScan();
    this.removeVisibilityHandler();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
      this.device = null;
    }

    this.reconnectAttempts = 0;
    this.emit('scanstop', null);
  }

  simulateReadings(beaconUUIDs: string[]): BLEDevice[] {
    return beaconUUIDs.map(uuid => ({
      id: uuid,
      name: `Beacon ${uuid.slice(-5)}`,
      rssi: Math.round(-30 - Math.random() * 50),
      uuid,
    }));
  }

  on(event: BLEEventType, callback: BLEEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: BLEEventType, callback: BLEEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: BLEEventType, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const bleScanner = new BLEScanner();
