import type { LocationData, BeaconInfo } from '../../shared/types';

export const isGeolocationSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
};

export const isBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const rssiToDistance = (rssi: number, txPower = -59): number => {
  if (rssi === 0) return -1;
  const ratio = rssi * 1.0 / txPower;
  if (ratio < 1) {
    return Math.pow(ratio, 10);
  }
  return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
};

export const formatCoordinates = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
};

export const formatAccuracy = (accuracy?: number): string => {
  if (!accuracy) return '未知';
  if (accuracy < 5) return '高精度';
  if (accuracy < 20) return '良好';
  if (accuracy < 100) return '一般';
  return '低精度';
};

export const getCurrentPosition = (
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
};

export const createLocationData = (
  position: GeolocationPosition,
  beacons: BeaconInfo[] = []
): LocationData => {
  return {
    gps: {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    },
    beacons,
  };
};

export const getNearestBeacon = (beacons: BeaconInfo[]): BeaconInfo | null => {
  if (beacons.length === 0) return null;
  return beacons.reduce((nearest, beacon) => {
    return beacon.rssi > nearest.rssi ? beacon : nearest;
  });
};

export const filterBeaconsByProximity = (
  beacons: BeaconInfo[],
  minRssi = -80
): BeaconInfo[] => {
  return beacons.filter(beacon => beacon.rssi >= minRssi);
};

export const parseBeaconData = (
  device: BluetoothDevice,
  rssi: number
): BeaconInfo => {
  const manufacturerData = (device as any).manufacturerData;
  let uuid: string | undefined;
  let major: number | undefined;
  let minor: number | undefined;

  if (manufacturerData && manufacturerData.size > 0) {
    try {
      for (const [, dataView] of manufacturerData) {
        if (dataView.byteLength >= 23) {
          const uuidBytes = new Uint8Array(dataView.buffer, dataView.byteOffset, 16);
          uuid = Array.from(uuidBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
          major = dataView.getUint16(20, false);
          minor = dataView.getUint16(22, false);
          break;
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return {
    id: device.id,
    name: device.name,
    rssi,
    uuid,
    major,
    minor,
  };
};

export const mergeBeaconData = (
  existing: BeaconInfo[],
  newBeacons: BeaconInfo[],
  maxAge = 30000
): BeaconInfo[] => {
  const now = Date.now();
  const beaconMap = new Map<string, BeaconInfo & { lastSeen: number }>();

  existing.forEach(b => beaconMap.set(b.id, { ...b, lastSeen: now - maxAge + 1000 }));
  newBeacons.forEach(b => beaconMap.set(b.id, { ...b, lastSeen: now }));

  return Array.from(beaconMap.values())
    .filter(b => now - b.lastSeen < maxAge)
    .map(({ lastSeen, ...beacon }) => beacon)
    .sort((a, b) => b.rssi - a.rssi);
};

export interface BeaconPosition {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export const performTrilateration = (
  beacons: (BeaconInfo & { position: BeaconPosition })[]
): { lat: number; lng: number; accuracy: number } | null => {
  if (beacons.length < 3) {
    return null;
  }

  const sortedBeacons = [...beacons].sort((a, b) => b.rssi - a.rssi).slice(0, 4);

  const points: { x: number; y: number; distance: number }[] = [];
  
  for (const beacon of sortedBeacons) {
    const distance = rssiToDistance(beacon.rssi);
    if (distance > 0 && distance < 50) {
      points.push({
        x: beacon.position.x,
        y: beacon.position.y,
        distance,
      });
    }
  }

  if (points.length < 3) {
    return null;
  }

  let bestLat = 0;
  let bestLng = 0;
  let minError = Infinity;
  
  const [p1, p2, p3] = points;
  
  const A = 2 * (p2.x - p1.x);
  const B = 2 * (p2.y - p1.y);
  const C = p1.distance * p1.distance - p2.distance * p2.distance - p1.x * p1.x + p2.x * p2.x - p1.y * p1.y + p2.y * p2.y;
  
  const D = 2 * (p3.x - p2.x);
  const E = 2 * (p3.y - p2.y);
  const F = p2.distance * p2.distance - p3.distance * p3.distance - p2.x * p2.x + p3.x * p3.x - p2.y * p2.y + p3.y * p3.y;
  
  const denominator = A * E - D * B;
  if (Math.abs(denominator) < 0.0001) {
    return null;
  }
  
  const x = (C * E - F * B) / denominator;
  const y = (A * F - D * C) / denominator;
  
  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLng = 0;
  
  for (const beacon of sortedBeacons) {
    const distance = rssiToDistance(beacon.rssi);
    if (distance <= 0 || distance > 50) continue;
    
    const weight = 1 / (distance * distance);
    weightedLat += beacon.position.lat * weight;
    weightedLng += beacon.position.lng * weight;
    totalWeight += weight;
  }
  
  if (totalWeight <= 0) {
    return null;
  }
  
  bestLat = weightedLat / totalWeight;
  bestLng = weightedLng / totalWeight;
  
  const avgDistance = points.reduce((sum, p) => sum + p.distance, 0) / points.length;
  const accuracy = Math.max(avgDistance, 2);

  return {
    lat: bestLat,
    lng: bestLng,
    accuracy,
  };
};

export const estimateLocationFromBeacons = (
  beacons: BeaconInfo[],
  knownBeacons: Map<string, BeaconPosition>
): { lat: number; lng: number; accuracy: number; source: 'gps' | 'beacon' } | null => {
  const beaconsWithPosition = beacons
    .filter(b => knownBeacons.has(b.id))
    .map(b => ({
      ...b,
      position: knownBeacons.get(b.id)!,
    }));

  if (beaconsWithPosition.length < 3) {
    if (beaconsWithPosition.length >= 1) {
      const strongest = beaconsWithPosition.sort((a, b) => b.rssi - a.rssi)[0];
      const distance = rssiToDistance(strongest.rssi);
      return {
        lat: strongest.position.lat,
        lng: strongest.position.lng,
        accuracy: Math.max(distance, 3),
        source: 'beacon',
      };
    }
    return null;
  }

  const trilaterationResult = performTrilateration(beaconsWithPosition);
  
  if (trilaterationResult) {
    return {
      ...trilaterationResult,
      source: 'beacon',
    };
  }

  const nearest = beaconsWithPosition.sort((a, b) => b.rssi - a.rssi)[0];
  if (nearest) {
    return {
      lat: nearest.position.lat,
      lng: nearest.position.lng,
      accuracy: Math.max(rssiToDistance(nearest.rssi), 3),
      source: 'beacon',
    };
  }

  return null;
};

export const getLocationWithFallback = async (
  options: PositionOptions & {
    beacons?: BeaconInfo[];
    knownBeacons?: Map<string, BeaconPosition>;
    gpsTimeout?: number;
  } = {}
): Promise<{
  gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  beacons: BeaconInfo[];
  source: 'gps' | 'beacon';
}> => {
  const { beacons = [], knownBeacons, gpsTimeout = 10000, ...positionOptions } = options;

  try {
    const gpsPromise = getCurrentPosition({
      enableHighAccuracy: true,
      timeout: gpsTimeout,
      maximumAge: 0,
      ...positionOptions,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new GeolocationPositionError());
        Object.defineProperty(reject, 'code', { value: GeolocationPositionError.TIMEOUT });
      }, gpsTimeout);
    });

    try {
      const position = await Promise.race([gpsPromise, timeoutPromise]);
      return {
        gps: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
        beacons,
        source: 'gps',
      };
    } catch (gpsError) {
      console.log('GPS定位失败，尝试蓝牙信标定位');
      
      if (knownBeacons && beacons.length > 0) {
        const beaconLocation = estimateLocationFromBeacons(beacons, knownBeacons);
        
        if (beaconLocation) {
          console.log('蓝牙信标定位成功:', beaconLocation);
          return {
            gps: {
              lat: beaconLocation.lat,
              lng: beaconLocation.lng,
              accuracy: beaconLocation.accuracy,
            },
            beacons,
            source: 'beacon',
          };
        }
      }

      if (beacons.length > 0) {
        const strongest = beacons.sort((a, b) => b.rssi - a.rssi)[0];
        const distance = rssiToDistance(strongest.rssi);
        
        console.log('使用最强信标估算位置');
        
        if (knownBeacons?.has(strongest.id)) {
          const pos = knownBeacons.get(strongest.id)!;
          return {
            gps: {
              lat: pos.lat,
              lng: pos.lng,
              accuracy: Math.max(distance, 3),
            },
            beacons,
            source: 'beacon',
          };
        }
      }

      throw gpsError;
    }
  } catch (error) {
    throw error;
  }
};
