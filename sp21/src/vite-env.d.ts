/// <reference types="vite/client" />

interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}

interface USBAlternateInterface {
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
  claimed: boolean;
}

interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName: string | null;
  manufacturerName: string | null;
  serialNumber: string | null;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  opened: boolean;

  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
  controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
  clearHalt(direction: 'in' | 'out', endpointNumber: number): Promise<void>;
  reset(): Promise<void>;
  isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
  isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
  forget(): Promise<void>;
}

interface USBControlTransferParameters {
  requestType: 'standard' | 'class' | 'vendor' | 'reserved';
  recipient: 'device' | 'interface' | 'endpoint' | 'other';
  request: number;
  value: number;
  index: number;
}

interface USBOutTransferResult {
  status: 'ok' | 'stall' | 'babble';
  bytesWritten: number;
}

interface USBInTransferResult {
  status: 'ok' | 'stall' | 'babble';
  data?: DataView;
}

interface USBIsochronousOutTransferResult {
  packets: USBIsochronousOutTransferPacket[];
}

interface USBIsochronousOutTransferPacket {
  status: 'ok' | 'stall' | 'babble';
  bytesWritten: number;
}

interface USBIsochronousInTransferResult {
  packets: USBIsochronousInTransferPacket[];
  data?: DataView;
}

interface USBIsochronousInTransferPacket {
  status: 'ok' | 'stall' | 'babble';
  data?: DataView;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBPair {
  device: USBDevice;
  name: string;
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  addEventListener(type: 'connect', callback: (event: USBConnectionEvent) => void): void;
  addEventListener(type: 'disconnect', callback: (event: USBConnectionEvent) => void): void;
  removeEventListener(type: 'connect', callback: (event: USBConnectionEvent) => void): void;
  removeEventListener(type: 'disconnect', callback: (event: USBConnectionEvent) => void): void;
  getDevices?(): Promise<USBDevice[]>;
  setDevicePermissionHandler?(handler: (device: USBDevice) => Promise<boolean>): void;
  addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  dispatchEvent(event: Event): boolean;
}

interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

interface Navigator {
  readonly usb: USB;
}
