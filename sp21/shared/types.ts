export interface TemplateVariable {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: string;
}

export interface PrintTemplate {
  _id: string;
  name: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
  width: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrintHistory {
  _id: string;
  templateId: string;
  templateName: string;
  data: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  printerName: string;
  printerId?: string;
  printedAt: string;
  queueId?: string;
}

export interface PrinterStatus {
  connected: boolean;
  online: boolean;
  paperOk: boolean;
  temperatureOk: boolean;
  coverOpen: boolean;
  errorMessage?: string;
}

export interface PrinterDevice {
  vendorId: number;
  productId: number;
  productName: string;
  manufacturerName: string;
  serialNumber: string;
}

export interface ManagedPrinter {
  id: string;
  device: PrinterDevice;
  status: PrinterStatus;
  isDefault: boolean;
  alias?: string;
  connectedAt: string;
}

export interface PrintQueueItem {
  id: string;
  templateId: string;
  templateName: string;
  templateContent: string;
  data: Record<string, any>;
  printerId?: string;
  printerName?: string;
  status: 'queued' | 'printing' | 'failed' | 'completed';
  priority: number;
  createdAt: string;
  scheduledAt?: string;
  errorMessage?: string;
  retries: number;
  maxRetries: number;
  copies: number;
}

export interface ApiResponse<T> {
  data?: T;
  message: string;
  success: boolean;
  total?: number;
}

export type AlignType = 'left' | 'center' | 'right';
export type FontSizeType = 'normal' | 'double-height' | 'double-width' | 'quad';
export type BarcodeType = 'UPC-A' | 'UPC-E' | 'EAN-13' | 'EAN-8' | 'CODE-39' | 'ITF' | 'CODEBAR' | 'CODE-93' | 'CODE-128';
export type QrCodeErrorLevel = 'L' | 'M' | 'Q' | 'H';
