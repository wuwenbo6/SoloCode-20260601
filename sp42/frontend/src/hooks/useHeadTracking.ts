import { useEffect, useRef, useState, useCallback } from 'react';

interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

interface FilteredAngles {
  yaw: number;
  pitch: number;
  roll: number;
}

interface HeadTrackingOptions {
  filterAlpha?: number;
  sendInterval?: number;
  onAngles?: (angles: FilteredAngles) => void;
}

interface HeadTrackingReturn {
  rawAngles: { yaw: number; pitch: number; roll: number };
  filteredAngles: FilteredAngles;
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
  requestPermission: () => Promise<boolean>;
  isSupported: boolean;
}

const deg2rad = (deg: number) => (deg * Math.PI) / 180;
const rad2deg = (rad: number) => (rad * 180) / Math.PI;

function quatFromEuler(yaw: number, pitch: number, roll: number): Quaternion {
  const y = deg2rad(yaw) / 2;
  const p = deg2rad(pitch) / 2;
  const r = deg2rad(roll) / 2;

  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cr = Math.cos(r);
  const sr = Math.sin(r);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

function quatToEuler(q: Quaternion): { yaw: number; pitch: number; roll: number } {
  const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
  const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  let pitch = 0;
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * (Math.PI / 2);
  } else {
    pitch = Math.asin(sinp);
  }

  const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return {
    yaw: rad2deg(yaw),
    pitch: rad2deg(pitch),
    roll: rad2deg(roll),
  };
}

function quatNormalize(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (len === 0) return { w: 1, x: 0, y: 0, z: 0 };
  return {
    w: q.w / len,
    x: q.x / len,
    y: q.y / len,
    z: q.z / len,
  };
}

function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

  if (dot < 0) {
    b = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
    dot = -dot;
  }

  if (dot > 0.9995) {
    return quatNormalize({
      w: a.w + (b.w - a.w) * t,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);

  const s1 = Math.sin((1 - t) * theta) / sinTheta;
  const s2 = Math.sin(t * theta) / sinTheta;

  return {
    w: s1 * a.w + s2 * b.w,
    x: s1 * a.x + s2 * b.x,
    y: s1 * a.y + s2 * b.y,
    z: s1 * a.z + s2 * b.z,
  };
}

function lowPassFilter(current: number, prev: number, alpha: number): number {
  return current * alpha + prev * (1 - alpha);
}

export function useHeadTracking({
  filterAlpha = 0.15,
  sendInterval = 33,
  onAngles,
}: HeadTrackingOptions = {}): HeadTrackingReturn {
  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'prompt' | 'unsupported'
  >('prompt');
  const [rawAngles, setRawAngles] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [filteredAngles, setFilteredAngles] = useState<FilteredAngles>({ yaw: 0, pitch: 0, roll: 0 });

  const rawQuatRef = useRef<Quaternion>({ w: 1, x: 0, y: 0, z: 0 });
  const filteredQuatRef = useRef<Quaternion>({ w: 1, x: 0, y: 0, z: 0 });
  const lastSendTime = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const permissionRequested = useRef(false);

  const isSupported =
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const event = window.DeviceOrientationEvent as any;
    if (typeof event.requestPermission === 'function') {
      try {
        const result = await event.requestPermission();
        const granted = result === 'granted';
        setPermission(granted ? 'granted' : 'denied');
        return granted;
      } catch (err) {
        setPermission('denied');
        return false;
      }
    }

    setPermission('granted');
    return true;
  }, [isSupported]);

  const smoothLoop = useCallback(() => {
    const raw = rawQuatRef.current;
    const filtered = filteredQuatRef.current;

    const interpolated = quatSlerp(filtered, raw, filterAlpha);
    filteredQuatRef.current = quatNormalize(interpolated);

    const euler = quatToEuler(interpolated);
    const prev = filteredAngles;
    const smoothed: FilteredAngles = {
      yaw: lowPassFilter(euler.yaw, prev.yaw, 0.3),
      pitch: lowPassFilter(euler.pitch, prev.pitch, 0.3),
      roll: lowPassFilter(euler.roll, prev.roll, 0.3),
    };

    setFilteredAngles(smoothed);

    const now = performance.now();
    if (now - lastSendTime.current >= sendInterval && onAngles) {
      lastSendTime.current = now;
      onAngles(smoothed);
    }

    animationFrameRef.current = requestAnimationFrame(smoothLoop);
  }, [filterAlpha, sendInterval, onAngles]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const alpha = event.alpha ?? 0;
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;

    setRawAngles({ yaw: alpha, pitch: beta, roll: gamma });

    const quat = quatFromEuler(alpha, beta, gamma);
    rawQuatRef.current = quat;
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;

    window.addEventListener('deviceorientation', handleOrientation, true);
    animationFrameRef.current = requestAnimationFrame(smoothLoop);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [permission, handleOrientation, smoothLoop]);

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
    }
  }, [isSupported]);

  useEffect(() => {
    if (
      isSupported &&
      typeof (window.DeviceOrientationEvent as any).requestPermission !== 'function' &&
      !permissionRequested.current
    ) {
      permissionRequested.current = true;
      setPermission('granted');
    }
  }, [isSupported]);

  return {
    rawAngles,
    filteredAngles,
    permission,
    requestPermission,
    isSupported,
  };
}
