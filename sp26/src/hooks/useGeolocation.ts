import { useState, useCallback, useEffect, useRef } from 'react';
import { isGeolocationSupported, getCurrentPosition, createLocationData, getLocationWithFallback } from '@/utils/location';
import type { LocationData, BeaconInfo, BeaconPosition } from '../../shared/types';

interface PositionState {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
  source?: 'gps' | 'beacon';
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
  gpsFallbackToBeacon?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watch = false,
    gpsFallbackToBeacon = true,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const onPositionChangeRef = useRef<((position: PositionState) => void) | null>(null);
  const knownBeaconsRef = useRef<Map<string, BeaconPosition>>(new Map());

  useEffect(() => {
    setIsSupported(isGeolocationSupported());
  }, []);

  const setKnownBeacons = useCallback((beacons: Map<string, BeaconPosition> | BeaconPosition[]) => {
    if (Array.isArray(beacons)) {
      const map = new Map<string, BeaconPosition>();
      beacons.forEach(b => map.set(b.id, b));
      knownBeaconsRef.current = map;
    } else {
      knownBeaconsRef.current = beacons;
    }
  }, []);

  const handleSuccess = useCallback((
    pos: GeolocationPosition | { coords: { latitude: number; longitude: number; accuracy?: number }; timestamp: number },
    source: 'gps' | 'beacon' = 'gps'
  ) => {
    const positionState: PositionState = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      source,
    };
    setPosition(positionState);
    setError(null);
    setIsLoading(false);
    
    if (onPositionChangeRef.current) {
      onPositionChangeRef.current(positionState);
    }
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let errorMessage: string;
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMessage = '位置权限被拒绝';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMessage = '位置信息不可用';
        break;
      case err.TIMEOUT:
        errorMessage = '获取位置超时';
        break;
      default:
        errorMessage = '获取位置失败';
    }
    setError(errorMessage);
    setIsLoading(false);
    throw new Error(errorMessage);
  }, []);

  const getCurrent = useCallback(async (
    beacons: BeaconInfo[] = []
  ): Promise<PositionState> => {
    if (!isSupported) {
      const err = new Error('地理定位不受支持');
      setError(err.message);
      throw err;
    }

    setIsLoading(true);
    
    try {
      if (gpsFallbackToBeacon) {
        const result = await getLocationWithFallback({
          enableHighAccuracy,
          timeout,
          maximumAge,
          beacons,
          knownBeacons: knownBeaconsRef.current,
        });
        
        const mockPosition: GeolocationPosition = {
          coords: {
            latitude: result.gps.lat,
            longitude: result.gps.lng,
            accuracy: result.gps.accuracy ?? 0,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        };
        
        handleSuccess(mockPosition, result.source);
        return {
          lat: result.gps.lat,
          lng: result.gps.lng,
          accuracy: result.gps.accuracy,
          timestamp: Date.now(),
          source: result.source,
        };
      }
      
      const pos = await getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge,
      });
      
      const positionState: PositionState = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
        source: 'gps',
      };
      
      setPosition(positionState);
      setError(null);
      setIsLoading(false);
      
      return positionState;
    } catch (err) {
      setIsLoading(false);
      if (err instanceof GeolocationPositionError) {
        handleError(err);
      }
      throw err;
    }
  }, [isSupported, enableHighAccuracy, timeout, maximumAge, gpsFallbackToBeacon, handleSuccess, handleError]);

  const startWatching = useCallback((
    onPositionChange?: (position: PositionState) => void
  ): void => {
    if (!isSupported) {
      const err = new Error('地理定位不受支持');
      setError(err.message);
      throw err;
    }

    if (isWatching || watchIdRef.current !== null) {
      return;
    }

    if (onPositionChange) {
      onPositionChangeRef.current = onPositionChange;
    }

    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    watchIdRef.current = id;
    setIsWatching(true);
  }, [isSupported, isWatching, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const stopWatching = useCallback((): void => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
    onPositionChangeRef.current = null;
  }, []);

  const getLocationData = useCallback((
    beacons: BeaconInfo[] = []
  ): LocationData | null => {
    if (!position) return null;
    
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: position.lat,
        longitude: position.lng,
        accuracy: position.accuracy ?? 0,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: position.timestamp || Date.now(),
      toJSON: () => ({}),
    };
    
    const locationData = createLocationData(mockPosition, beacons);
    return {
      ...locationData,
      gps: {
        ...locationData.gps,
      },
    };
  }, [position]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    stopWatching();
    setPosition(null);
    setError(null);
    setIsLoading(false);
  }, [stopWatching]);

  useEffect(() => {
    if (watch && isSupported) {
      startWatching();
    }
    return () => {
      stopWatching();
    };
  }, [watch, isSupported, startWatching, stopWatching]);

  return {
    isSupported,
    isWatching,
    isLoading,
    position,
    error,
    getCurrent,
    startWatching,
    stopWatching,
    getLocationData,
    clearError,
    reset,
    setKnownBeacons,
  };
}
