import { useEffect, useRef, useCallback } from 'react';
import { useFPVStore } from '@/stores/fpvStore';

interface UseTelemetryOptions {
  source: 'poll' | 'webtransport';
  pollUrl?: string;
  pollInterval?: number;
  datagramStream?: { readable: ReadableStream; writable: WritableStream } | null;
  dataStream?: ReadableStream | null;
}

export function useTelemetry({
  source,
  pollUrl = '/api/telemetry',
  pollInterval = 500,
  datagramStream,
  dataStream,
}: UseTelemetryOptions) {
  const setTelemetry = useFPVStore((s) => s.setTelemetry);
  const setGimbal = useFPVStore((s) => s.setGimbal);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  const handleTelemetryData = useCallback(
    (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>;
        setTelemetry({
          altitude: typeof d.altitude === 'number' ? d.altitude : 0,
          speed: typeof d.speed === 'number' ? d.speed : 0,
          gpsLat: typeof d.latitude === 'number' ? d.latitude : (typeof d.gpsLat === 'number' ? d.gpsLat : 0),
          gpsLon: typeof d.longitude === 'number' ? d.longitude : (typeof d.gpsLon === 'number' ? d.gpsLon : 0),
          batteryVoltage: typeof d.battery === 'number' ? d.battery : (typeof d.batteryVoltage === 'number' ? d.batteryVoltage : 0),
          signalStrength: typeof d.signal === 'number' ? d.signal : (typeof d.signalStrength === 'number' ? d.signalStrength : 0),
          heading: typeof d.heading === 'number' ? d.heading : 0,
          pitch: typeof d.pitch === 'number' ? d.pitch : 0,
          roll: typeof d.roll === 'number' ? d.roll : 0,
        });
        if (d.gimbal && typeof d.gimbal === 'object') {
          const g = d.gimbal as Record<string, unknown>;
          setGimbal({
            yaw: typeof g.yaw === 'number' ? g.yaw : 0,
            pitch: typeof g.pitch === 'number' ? g.pitch : 0,
            roll: typeof g.roll === 'number' ? g.roll : 0,
          });
        }
      }
    },
    [setTelemetry, setGimbal],
  );

  useEffect(() => {
    if (source === 'poll') {
      const controller = new AbortController();
      abortRef.current = controller;

      let running = true;
      const poll = async () => {
        while (running) {
          try {
            const res = await fetch(pollUrl, { signal: controller.signal });
            if (res.ok) {
              const data = await res.json();
              handleTelemetryData(data);
            }
          } catch {
            // abort or network error
          }
          await new Promise<void>((r) => {
            const t = setTimeout(r, pollInterval);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(t);
              r();
            }, { once: true });
          });
        }
      };
      poll();

      return () => {
        running = false;
        controller.abort();
      };
    }
  }, [source, pollUrl, pollInterval, handleTelemetryData]);

  useEffect(() => {
    if (source === 'webtransport' && datagramStream) {
      const reader = datagramStream.readable.getReader();
      readerRef.current = reader;

      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = new TextDecoder().decode(value);
              try {
                const data = JSON.parse(text);
                handleTelemetryData(data);
              } catch {
                // ignore parse error
              }
            }
          }
        } catch {
          // stream closed
        }
      };
      readLoop();

      return () => {
        reader.cancel().catch(() => {});
      };
    }
  }, [source, datagramStream, handleTelemetryData]);

  useEffect(() => {
    if (source === 'webtransport' && dataStream) {
      const reader = dataStream.getReader();
      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = new TextDecoder().decode(value);
              try {
                const data = JSON.parse(text);
                handleTelemetryData(data);
              } catch {
                // ignore parse error
              }
            }
          }
        } catch {
          // stream closed
        }
      };
      readLoop();

      return () => {
        reader.cancel().catch(() => {});
      };
    }
  }, [source, dataStream, handleTelemetryData]);
}
