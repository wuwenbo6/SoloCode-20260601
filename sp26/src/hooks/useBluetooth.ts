import { useState, useCallback, useEffect, useRef } from 'react';
import { isBluetoothSupported, parseBeaconData, mergeBeaconData } from '@/utils/location';
import type { BeaconInfo } from '../../shared/types';

interface UseBluetoothOptions {
  scanDuration?: number;
  maxAge?: number;
  minRssi?: number;
  autoStop?: boolean;
}

export function useBluetooth(options: UseBluetoothOptions = {}) {
  const {
    scanDuration = 10000,
    maxAge = 30000,
    minRssi = -100,
    autoStop = true,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BeaconInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const discoveredDevicesRef = useRef<Map<string, BeaconInfo>>(new Map());
  const onDeviceFoundRef = useRef<((device: BeaconInfo) => void) | null>(null);
  const onScanCompleteRef = useRef<((devices: BeaconInfo[]) => void) | null>(null);

  useEffect(() => {
    setIsSupported(isBluetoothSupported());
  }, []);

  const processAdvertisement = useCallback((
    device: BluetoothDevice,
    rssi: number
  ) => {
    if (rssi < minRssi) return;

    const beaconInfo = parseBeaconData(device, rssi);
    
    discoveredDevicesRef.current.set(device.id, beaconInfo);
    
    const allDevices = Array.from(discoveredDevicesRef.current.values())
      .sort((a, b) => b.rssi - a.rssi);
    
    setDevices(allDevices);
    
    if (onDeviceFoundRef.current) {
      onDeviceFoundRef.current(beaconInfo);
    }
  }, [minRssi]);

  const requestLEScan = async (
    onDeviceFound?: (device: BeaconInfo) => void,
    onScanComplete?: (devices: BeaconInfo[]) => void
  ): Promise<BeaconInfo[]> => {
    if (!isSupported) {
      const err = new Error('蓝牙不受支持');
      setError(err.message);
      throw err;
    }

    if (isScanning) {
      return devices;
    }

    try {
      if (onDeviceFound) onDeviceFoundRef.current = onDeviceFound;
      if (onScanComplete) onScanCompleteRef.current = onScanComplete;

      abortControllerRef.current = new AbortController();
      discoveredDevicesRef.current.clear();
      
      const scanOptions: RequestLEScanOptions = {
        acceptAllAdvertisements: true,
        keepRepeatedDevices: true,
        signal: abortControllerRef.current.signal,
      };
      
      const scan = await (navigator.bluetooth as any).requestLEScan(scanOptions);
      
      const handleAdvertisement = (event: any) => {
        const rssi = event.rssi || -100;
        processAdvertisement(event.device, rssi);
      };
      
      (navigator.bluetooth as any).addEventListener('advertisementreceived', handleAdvertisement);
      
      setIsScanning(true);
      setError(null);
      
      if (autoStop) {
        scanTimeoutRef.current = window.setTimeout(() => {
          stopScan();
        }, scanDuration);
      }
      
      return new Promise((resolve) => {
        const checkComplete = () => {
          if (!isScanning) {
            const finalDevices = Array.from(discoveredDevicesRef.current.values())
              .sort((a, b) => b.rssi - a.rssi);
            resolve(finalDevices);
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        setTimeout(checkComplete, 100);
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '蓝牙扫描失败';
      setError(errorMessage);
      setIsScanning(false);
      throw new Error(errorMessage);
    }
  };

  const startScan = useCallback(async (
    onDeviceFound?: (device: BeaconInfo) => void,
    onScanComplete?: (devices: BeaconInfo[]) => void
  ): Promise<BeaconInfo[]> => {
    return requestLEScan(onDeviceFound, onScanComplete);
  }, [isSupported, isScanning, devices, autoStop, scanDuration, processAdvertisement]);

  const stopScan = useCallback((): BeaconInfo[] => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    setIsScanning(false);
    
    const finalDevices = Array.from(discoveredDevicesRef.current.values())
      .sort((a, b) => b.rssi - a.rssi);
    
    if (onScanCompleteRef.current) {
      onScanCompleteRef.current(finalDevices);
    }
    
    onDeviceFoundRef.current = null;
    onScanCompleteRef.current = null;
    
    return finalDevices;
  }, []);

  const getNearestDevice = useCallback((): BeaconInfo | null => {
    if (devices.length === 0) return null;
    return devices[0];
  }, [devices]);

  const getDevicesByProximity = useCallback((
    threshold: number = -60
  ): BeaconInfo[] => {
    return devices.filter(d => d.rssi >= threshold);
  }, [devices]);

  const refreshDevices = useCallback((): void => {
    const now = Date.now();
    setDevices(prev => {
      const filtered = prev.filter(d => {
        if (!('lastSeen' in d)) return true;
        const lastSeen = (d as BeaconInfo & { lastSeen: number }).lastSeen;
        return now - lastSeen < maxAge;
      });
      return filtered;
    });
  }, [maxAge]);

  const clearDevices = useCallback((): void => {
    discoveredDevicesRef.current.clear();
    setDevices([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    stopScan();
    clearDevices();
    clearError();
  }, [stopScan, clearDevices, clearError]);

  useEffect(() => {
    const interval = setInterval(refreshDevices, 5000);
    return () => clearInterval(interval);
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  return {
    isSupported,
    isScanning,
    devices,
    error,
    startScan,
    stopScan,
    getNearestDevice,
    getDevicesByProximity,
    refreshDevices,
    clearDevices,
    clearError,
    reset,
  };
}
