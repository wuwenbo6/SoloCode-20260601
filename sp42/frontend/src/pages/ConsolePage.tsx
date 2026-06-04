import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Eye, Smartphone, Users, Wifi, WifiOff, Gauge, MapPin, Battery, Signal } from 'lucide-react';
import { useFPVStore } from '@/stores/fpvStore';
import { useTelemetry } from '@/hooks/useTelemetry';
import StreamControl from '@/components/StreamControl';
import GimbalIndicator from '@/components/GimbalIndicator';

function NavBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-hud-border bg-hud-panel backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Plane size={20} className="text-hud-primary" style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.5))' }} />
        <span className="font-heading font-bold text-lg hud-text tracking-wider">FPV DRONE</span>
      </div>
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="hud-btn text-xs flex items-center gap-1.5"
        >
          <Gauge size={14} />
          Console
        </Link>
        <Link
          to="/fpv"
          className="hud-btn text-xs flex items-center gap-1.5"
        >
          <Eye size={14} />
          FPV View
        </Link>
        <Link
          to="/headtrack"
          className="hud-btn text-xs flex items-center gap-1.5"
        >
          <Smartphone size={14} />
          Head Track
        </Link>
      </div>
    </nav>
  );
}

function ConnectionMonitor() {
  const streamStatus = useFPVStore((s) => s.streamStatus);
  const connection = useFPVStore((s) => s.connection);

  return (
    <div className="hud-panel p-4 space-y-4 h-full">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-hud-info" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider hud-text-info">
          Connections
        </h3>
      </div>

      <div className="flex items-center gap-2">
        {connection.webTransport === 'connected' ? (
          <Wifi size={14} className="text-hud-primary" />
        ) : (
          <WifiOff size={14} className="text-hud-alert" />
        )}
        <span className="text-xs font-mono" style={{
          color: connection.webTransport === 'connected' ? '#00ff88' : '#ff3b30',
        }}>
          WebTransport: {connection.webTransport.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="hud-label">Clients</span>
          <span className="hud-value text-base">{streamStatus.clientCount}</span>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {streamStatus.clients.length > 0 ? (
            streamStatus.clients.map((client, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded bg-hud-primary/5 border border-hud-primary/10"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-hud-primary" />
                <span className="hud-text text-xs">{client}</span>
              </div>
            ))
          ) : (
            <span className="text-xs font-mono opacity-30">No connected clients</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TelemetryDashboard() {
  const telemetry = useFPVStore((s) => s.telemetry);

  const batteryColor =
    telemetry.batteryVoltage > 14
      ? '#00ff88'
      : telemetry.batteryVoltage > 12
        ? '#ff9500'
        : '#ff3b30';

  const signalBars = 5;
  const signalFilled = Math.round((telemetry.signalStrength / 100) * signalBars);

  return (
    <div className="hud-panel p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-hud-warning" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider hud-text-warning">
          Telemetry
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="hud-label">Altitude</span>
          <div className="flex items-baseline gap-1">
            <span className="hud-value text-2xl">{telemetry.altitude.toFixed(1)}</span>
            <span className="text-xs opacity-50">m</span>
          </div>
          <div className="w-full h-2 bg-hud-primary/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (telemetry.altitude / 500) * 100)}%`,
                backgroundColor: '#00ff88',
                boxShadow: '0 0 6px rgba(0,255,136,0.4)',
              }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <span className="hud-label">Speed</span>
          <div className="flex items-baseline gap-1">
            <span className="hud-value text-2xl">{telemetry.speed.toFixed(1)}</span>
            <span className="text-xs opacity-50">km/h</span>
          </div>
          <div className="w-full h-2 bg-hud-info/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (telemetry.speed / 150) * 100)}%`,
                backgroundColor: '#00d4ff',
                boxShadow: '0 0 6px rgba(0,212,255,0.4)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin size={12} className="text-hud-info opacity-60" />
          <span className="hud-label">GPS</span>
        </div>
        <div className="font-mono text-xs">
          <span className="hud-text-info">{telemetry.gpsLat.toFixed(6)}</span>
          <span className="opacity-30">, </span>
          <span className="hud-text-info">{telemetry.gpsLon.toFixed(6)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Battery size={12} style={{ color: batteryColor }} className="opacity-60" />
          <span className="hud-label">Battery</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-mono font-bold" style={{
            color: batteryColor,
            textShadow: `0 0 6px ${batteryColor}66`,
          }}>
            {telemetry.batteryVoltage.toFixed(1)}
          </span>
          <span className="text-xs opacity-50">V</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Signal size={12} className="text-hud-primary opacity-60" />
          <span className="hud-label">Signal</span>
        </div>
        <div className="flex items-end gap-1">
          {Array.from({ length: signalBars }).map((_, i) => (
            <div
              key={i}
              className="w-3 transition-all duration-300 rounded-sm"
              style={{
                height: `${6 + i * 4}px`,
                backgroundColor: i < signalFilled ? '#00ff88' : 'rgba(0,255,136,0.15)',
                boxShadow: i < signalFilled ? '0 0 4px rgba(0,255,136,0.4)' : 'none',
              }}
            />
          ))}
          <span className="text-xs font-mono ml-2 hud-text">{telemetry.signalStrength.toFixed(0)}%</span>
        </div>
      </div>

      <GimbalIndicator />
    </div>
  );
}

export default function ConsolePage() {
  const setStreamStatus = useFPVStore((s) => s.setStreamStatus);

  useTelemetry({ source: 'poll', pollUrl: '/api/telemetry', pollInterval: 500 });

  const pollStreamStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/stream/status');
      if (res.ok) {
        const data = await res.json();
        setStreamStatus({
          running: data.running ?? false,
          resolution: data.resolution ?? '',
          fps: data.fps ?? 0,
          uptime: data.uptime ?? 0,
          clientCount: data.clientCount ?? 0,
          clients: data.clients ?? [],
        });
      }
    } catch {
      // ignore
    }
  }, [setStreamStatus]);

  useEffect(() => {
    pollStreamStatus();
    const interval = setInterval(pollStreamStatus, 2000);
    return () => clearInterval(interval);
  }, [pollStreamStatus]);

  const handleStart = useCallback(async () => {
    try {
      await fetch('/api/stream/start', { method: 'POST' });
    } catch {
      // ignore
    }
    setTimeout(() => {
      pollStreamStatus();
    }, 500);
  }, [pollStreamStatus]);

  const handleStop = useCallback(async () => {
    try {
      await fetch('/api/stream/stop', { method: 'POST' });
    } catch {
      // ignore
    }
    setTimeout(() => {
      pollStreamStatus();
    }, 500);
  }, [pollStreamStatus]);

  return (
    <div className="h-full flex flex-col bg-hud-bg">
      <NavBar />
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-auto">
        <div className="space-y-4">
          <StreamControl onStart={handleStart} onStop={handleStop} />
        </div>
        <div>
          <ConnectionMonitor />
        </div>
        <div>
          <TelemetryDashboard />
        </div>
      </div>
    </div>
  );
}
