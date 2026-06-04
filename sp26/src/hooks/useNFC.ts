import { useState, useCallback, useEffect, useRef } from 'react';
import { parseReadEvent, buildWriteMessage, isNFCSupported, isIOSDevice, getNFCDisabledReason, generateIdempotencyKey } from '@/utils/nfc';
import type { NFCReadResult, NFCWriteOptions } from '../../shared/types';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { assetService } from '@/services/assetService';
import { lifecycleService } from '@/services/lifecycleService';

export function useNFC() {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<NFCReadResult | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  
  const readerRef = useRef<NDEFReader | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onReadCallbackRef = useRef<((result: NFCReadResult) => void) | null>(null);
  const onErrorCallbackRef = useRef<((error: Error) => void) | null>(null);
  const lastScanTimeRef = useRef<Map<string, number>>(new Map());
  const SCAN_DEBOUNCE_MS = 3000;

  useEffect(() => {
    const ios = isIOSDevice();
    setIsIOS(ios);
    
    const supported = isNFCSupported();
    setIsSupported(supported);
    setIsAvailable(supported);
    
    if (!supported) {
      setDisabledReason(getNFCDisabledReason());
    }
  }, []);

  const handleReading = useCallback((event: NDEFReadingEvent) => {
    const result = parseReadEvent(event);
    
    const now = Date.now();
    const lastScan = lastScanTimeRef.current.get(result.uid);
    if (lastScan && now - lastScan < SCAN_DEBOUNCE_MS) {
      return;
    }
    lastScanTimeRef.current.set(result.uid, now);
    
    result.idempotencyKey = generateIdempotencyKey();
    setLastRead(result);
    if (onReadCallbackRef.current) {
      onReadCallbackRef.current(result);
    }
  }, []);

  const handleReadingError = useCallback((event: Event) => {
    const errorMessage = 'NFC读取错误';
    setError(errorMessage);
    if (onErrorCallbackRef.current) {
      onErrorCallbackRef.current(new Error(errorMessage));
    }
  }, []);

  const startScan = useCallback(async (
    onRead?: (result: NFCReadResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> => {
    if (!isSupported) {
      const reason = getNFCDisabledReason();
      const err = new Error(reason);
      setError(reason);
      
      if (isIOS) {
        alert(
          '⚠️ iOS设备暂不支持Web NFC\n\n' +
          '建议使用以下替代方案：\n' +
          '1. 使用Android设备（Chrome浏览器）\n' +
          '2. 使用二维码扫描功能（点击下方按钮）\n\n' +
          '如需体验NFC功能，请使用Android手机的Chrome浏览器访问。'
        );
      }
      
      throw err;
    }

    if (isScanning) {
      return;
    }

    try {
      if (onRead) onReadCallbackRef.current = onRead;
      if (onError) onErrorCallbackRef.current = onError;

      abortControllerRef.current = new AbortController();
      readerRef.current = new NDEFReader();
      
      readerRef.current.addEventListener('reading', handleReading as unknown as EventListener);
      readerRef.current.addEventListener('readingerror', handleReadingError);
      
      await readerRef.current.scan({
        signal: abortControllerRef.current.signal,
      });
      
      setIsScanning(true);
      setError(null);
      setIsAvailable(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '启动NFC扫描失败';
      setError(errorMessage);
      setIsScanning(false);
      setIsAvailable(false);
      
      if (onErrorCallbackRef.current) {
        onErrorCallbackRef.current(new Error(errorMessage));
      }
      
      throw new Error(errorMessage);
    }
  }, [isSupported, isScanning, isIOS, handleReading, handleReadingError]);

  const stopScan = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (readerRef.current) {
      readerRef.current.removeEventListener('reading', handleReading as unknown as EventListener);
      readerRef.current.removeEventListener('readingerror', handleReadingError);
      readerRef.current = null;
    }
    
    setIsScanning(false);
    onReadCallbackRef.current = null;
    onErrorCallbackRef.current = null;
  }, [handleReading, handleReadingError]);

  const writeTag = useCallback(async (
    options: NFCWriteOptions,
    overwrite = true
  ): Promise<void> => {
    if (!isSupported) {
      const reason = getNFCDisabledReason();
      const err = new Error(reason);
      setError(reason);
      
      if (isIOS) {
        alert(
          '⚠️ iOS设备暂不支持Web NFC\n\n' +
          '标签写入功能需要使用Android设备的Chrome浏览器。\n\n' +
          '如需写入NFC标签，请使用Android手机操作。'
        );
      }
      
      throw err;
    }

    if (!isAvailable) {
      const err = new Error('NFC不可用');
      setError(err.message);
      throw err;
    }

    const { uid, lockAfterWrite = false } = options;

    try {
      const writer = new NDEFWriter();
      const message = buildWriteMessage(options);
      
      await writer.write(message, {
        overwrite,
      });

      if (lockAfterWrite) {
        try {
          if (typeof (writer as any).makeReadOnly === 'function') {
            await (writer as any).makeReadOnly();
          }
        } catch (lockError) {
          console.warn('标签锁定失败，可能不支持此功能:', lockError);
        }
      }
      
      setError(null);

      if (uid) {
        const authUser = useAuthStore.getState().user;
        if (authUser) {
          try {
            const locationStore = useLocationStore.getState();
            const { beacons } = locationStore;
            const locationData = locationStore.lastLocation
              ? {
                  gps: {
                    lat: locationStore.lastLocation.lat,
                    lng: locationStore.lastLocation.lng,
                    accuracy: locationStore.lastLocation.accuracy,
                  },
                  beacons,
                }
              : undefined;
            const idempotencyKey = generateIdempotencyKey();
            if (lockAfterWrite) {
              lifecycleService.createLog({
                assetUid: uid,
                action: 'lock_tag',
                performedBy: authUser.id,
                location: locationData,
                note: '标签已锁定',
                idempotencyKey,
              }).catch(() => {});
            } else {
              lifecycleService.createLog({
                assetUid: uid,
                action: 'write_tag',
                performedBy: authUser.id,
                location: locationData,
                note: '写入标签',
                idempotencyKey,
              }).catch(() => {});
            }
          } catch {}
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '写入NFC标签失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isSupported, isAvailable, isIOS]);

  const writeText = useCallback(async (
    text: string,
    lang = 'zh-CN',
    uid?: string
  ): Promise<void> => {
    return writeTag({
      uid,
      records: [
        {
          recordType: 'text',
          lang,
          data: text,
        },
      ],
    });
  }, [writeTag]);

  const writeUrl = useCallback(async (
    url: string,
    uid?: string
  ): Promise<void> => {
    return writeTag({
      uid,
      records: [
        {
          recordType: 'url',
          data: url,
        },
      ],
    });
  }, [writeTag]);

  const makeReadOnly = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      const err = new Error('NFC不受支持');
      setError(err.message);
      throw err;
    }

    try {
      const writer = new NDEFWriter();
      await writer.makeReadOnly();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '设置只读失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isSupported]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetLastRead = useCallback(() => {
    setLastRead(null);
  }, []);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  return {
    isSupported,
    isAvailable,
    isScanning,
    isIOS,
    disabledReason,
    error,
    lastRead,
    startScan,
    stopScan,
    writeTag,
    writeText,
    writeUrl,
    makeReadOnly,
    clearError,
    resetLastRead,
  };
}
