import type { NFCReadResult, NFCWriteOptions } from '../../shared/types';

export const isNFCSupported = (): boolean => {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
};

export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || 
         (ua.includes('mac') && 'ontouchend' in document);
};

export const getNFCDisabledReason = (): string => {
  if (isIOSDevice()) {
    return 'iOS设备暂不支持Web NFC API，请使用Android设备或二维码扫描';
  }
  if (!isNFCSupported()) {
    return '当前浏览器不支持Web NFC，请使用Chrome浏览器';
  }
  if (typeof window !== 'undefined' && location.protocol !== 'https:') {
    return 'NFC功能需要HTTPS环境才能使用';
  }
  return 'NFC不可用';
};

export const generateIdempotencyKey = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `idempot_${timestamp}_${random}`;
};

export const decodeNDEFMessage = (message: NDEFMessage): NDEFRecordInit[] => {
  return Array.from(message.records).map(record => {
    const recordInit: NDEFRecordInit = {
      recordType: record.recordType as NDEFRecordInit['recordType'],
      mediaType: record.mediaType,
      id: record.id,
    };

    if (record.data && record.data.byteLength > 0) {
      const textDecoder = new TextDecoder();
      recordInit.data = textDecoder.decode(record.data);
    }

    if (record.lang) {
      recordInit.lang = record.lang;
    }

    return recordInit;
  });
};

export const createTextRecord = (text: string, lang = 'zh-CN'): NDEFRecordInit => {
  const encoder = new TextEncoder();
  return {
    recordType: 'text',
    lang,
    data: Array.from(encoder.encode(text)),
  };
};

export const createUrlRecord = (url: string): NDEFRecordInit => {
  const encoder = new TextEncoder();
  return {
    recordType: 'url',
    data: Array.from(encoder.encode(url)),
  };
};

export const createMimeRecord = (mediaType: string, data: string | ArrayBuffer): NDEFRecordInit => {
  const encodedData = typeof data === 'string' 
    ? Array.from(new TextEncoder().encode(data))
    : Array.from(new Uint8Array(data));
  
  return {
    recordType: 'mime',
    mediaType,
    data: encodedData,
  };
};

export const parseReadEvent = (event: NDEFReadingEvent): NFCReadResult => {
  const serialNumber = event.serialNumber;
  const uid = serialNumber || generateUID();
  const message = decodeNDEFMessage(event.message);

  return {
    uid,
    serialNumber,
    message,
  };
};

export const generateUID = (): string => {
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
};

export const formatUID = (uid: string): string => {
  return uid
    .replace(/[^0-9A-Fa-f]/g, '')
    .toUpperCase()
    .match(/.{1,2}/g)
    ?.join(':') || uid;
};

export const validateUID = (uid: string): boolean => {
  const cleanUid = uid.replace(/[^0-9A-Fa-f]/g, '');
  return /^[0-9A-F]{14}$/i.test(cleanUid);
};

export const buildWriteMessage = (options: NFCWriteOptions): NDEFRecordInit[] => {
  const records: NDEFRecordInit[] = [];

  if (options.uid) {
    records.push(createTextRecord(options.uid, 'en'));
  }

  records.push(...options.records);

  return records;
};

export const extractUIDFromMessage = (records: NDEFRecordInit[]): string | null => {
  for (const record of records) {
    if (record.recordType === 'text' && typeof record.data === 'string') {
      const uid = record.data.trim();
      if (validateUID(uid)) {
        return uid;
      }
    }
  }
  return null;
};

export const getRecordAsText = (record: NDEFRecordInit): string | null => {
  if (record.recordType === 'text' && record.data) {
    if (typeof record.data === 'string') {
      return record.data;
    }
    if (Array.isArray(record.data)) {
      return new TextDecoder().decode(new Uint8Array(record.data));
    }
  }
  return null;
};

export const getRecordAsUrl = (record: NDEFRecordInit): string | null => {
  if (record.recordType === 'url' && record.data) {
    if (typeof record.data === 'string') {
      return record.data;
    }
    if (Array.isArray(record.data)) {
      return new TextDecoder().decode(new Uint8Array(record.data));
    }
  }
  return null;
};
