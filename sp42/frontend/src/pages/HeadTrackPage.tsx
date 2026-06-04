import { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Smartphone, Wifi, WifiOff, Compass } from 'lucide-react';
import { useHeadTracking } from '@/hooks/useHeadTracking';
import { useFPVStore } from '@/stores/fpvStore';
import { motion } from 'framer-motion';

function Orientation3D({ yaw, pitch, roll }: { yaw: number; pitch: number; roll: number }) {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="rgba(0,255,136,0.15)"
          strokeWidth="1"
        />
        <ellipse
          cx="100"
          cy="100"
          rx="70"
          ry="70"
          fill="none"
          stroke="rgba(0,255,136,0.1)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          transform={`rotate(${roll.toFixed(1)}, 100, 100)`}
        />
        <line
          x1="10"
          y1="100"
          x2="190"
          y2="100"
          stroke="rgba(0,255,136,0.15)"
          strokeWidth="0.5"
        />
        <line
          x1="100"
          y1="10"
          x2="100"
          y2="190"
          stroke="rgba(0,255,136,0.15)"
          strokeWidth="0.5"
        />

        <motion.ellipse
          cx="100"
          cy="100"
          rx="60"
          ry="25"
          fill="rgba(0,212,255,0.08)"
          stroke="rgba(0,212,255,0.5)"
          strokeWidth="1.5"
          style={{
            filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.3))',
          }}
          animate={{
            rotate: roll,
          }}
          transformOrigin="100 100"
        />

        <motion.g
          animate={{
            rotate: yaw,
          }}
          transformOrigin="100 100"
        >
          <line
            x1="100"
            y1="50"
            x2="100"
            y2="40"
            stroke="#00ff88"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.6))' }}
          />
          <polygon
            points="95,44 105,44 100,35"
            fill="#00ff88"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.6))' }}
          />
        </motion.g>

        <motion.line
          x1="100"
          y1="100"
          x2="100"
          y2={100 - pitch * 0.5}
          stroke="#ff9500"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 4px rgba(255,149,0,0.5))' }}
          animate={{
            y2: 100 - pitch * 0.5,
          }}
        />

        <circle cx="100" cy="100" r="4" fill="#00ff88" style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.7))' }} />

        <text x="100" y="18" textAnchor="middle" fill="rgba(0,255,136,0.5)" fontSize="10" fontFamily="Rajdhani">
          N
        </text>
        <text x="192" y="104" textAnchor="middle" fill="rgba(0,255,136,0.3)" fontSize="10" fontFamily="Rajdhani">
          E
        </text>
        <text x="100" y="198" textAnchor="middle" fill="rgba(0,255,136,0.3)" fontSize="10" fontFamily="Rajdhani">
          S
        </text>
        <text x="8" y="104" textAnchor="middle" fill="rgba(0,255,136,0.3)" fontSize="10" fontFamily="Rajdhani">
          W
        </text>
      </svg>
    </div>
  );
}

export default function HeadTrackPage() {
  const {
    filteredAngles,
    permission,
    requestPermission,
    isSupported,
  } = useHeadTracking({
    filterAlpha: 0.12,
    sendInterval: 33,
  });
  const setConnection = useFPVStore((s) => s.setConnection);
  const setGimbal = useFPVStore((s) => s.setGimbal);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { yaw, pitch, roll } = filteredAngles;

  const sendAngles = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'gimbal',
          yaw,
          pitch,
          roll,
        }),
      );
    }
  }, [yaw, pitch, roll]);

  const connectWS = useCallback(() => {
    const host = window.location.hostname;
    const url = `ws://${host}:8080/ws/headtrack`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setConnection({ webSocket: 'connected' });
      };

      ws.onclose = () => {
        setWsConnected(false);
        setConnection({ webSocket: 'disconnected' });
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimerRef.current = setTimeout(connectWS, 3000);
    }
  }, [setConnection]);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWS]);

  useEffect(() => {
    if (permission !== 'granted') return;
    setGimbal({ yaw, pitch, roll });
    sendAngles();
  }, [yaw, pitch, roll, permission, setGimbal, sendAngles]);

  return (
    <div className="h-full flex flex-col bg-hud-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border bg-hud-panel backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link to="/" className="hud-btn p-1.5">
            <ArrowLeft size={14} />
          </Link>
          <Smartphone size={16} className="text-hud-primary" />
          <span className="font-heading font-bold text-sm uppercase tracking-wider hud-text">
            Head Tracking
          </span>
        </div>
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <Wifi size={14} className="text-hud-primary" />
          ) : (
            <WifiOff size={14} className="text-hud-alert" />
          )}
          <span
            className="text-xs font-mono"
            style={{
              color: wsConnected ? '#00ff88' : '#ff3b30',
              textShadow: wsConnected
                ? '0 0 6px rgba(0,255,136,0.4)'
                : '0 0 6px rgba(255,59,48,0.3)',
            }}
          >
            {wsConnected ? 'WS CONNECTED' : 'WS DISCONNECTED'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        {permission === 'prompt' && (
          <div className="hud-panel p-6 text-center space-y-4 max-w-sm">
            <Compass size={32} className="text-hud-info mx-auto" />
            <p className="font-heading text-sm hud-text-info">
              Enable device orientation to control the gimbal
            </p>
            <button onClick={requestPermission} className="hud-btn hud-btn-warning">
              Enable Orientation
            </button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="hud-panel p-6 text-center space-y-4 max-w-sm">
            <Compass size={32} className="text-hud-alert mx-auto" />
            <p className="font-heading text-sm hud-text-alert">
              Device orientation permission denied
            </p>
            <p className="text-xs opacity-60 text-hud-text">
              Please enable orientation access in your browser settings
            </p>
          </div>
        )}

        {permission === 'unsupported' && (
          <div className="hud-panel p-6 text-center space-y-4 max-w-sm">
            <Compass size={32} className="text-hud-alert mx-auto" />
            <p className="font-heading text-sm hud-text-alert">
              Device orientation not available on this device
            </p>
          </div>
        )}

        {permission === 'granted' && (
          <>
            <Orientation3D yaw={yaw} pitch={pitch} roll={roll} />

            <div className="hud-panel p-4 w-full max-w-xs">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="hud-label mb-1">Yaw</div>
                  <div className="hud-value text-base">{yaw.toFixed(1)}°</div>
                </div>
                <div>
                  <div className="hud-label mb-1">Pitch</div>
                  <div className="hud-value text-base">{pitch.toFixed(1)}°</div>
                </div>
                <div>
                  <div className="hud-label mb-1">Roll</div>
                  <div className="hud-value text-base">{roll.toFixed(1)}°</div>
                </div>
              </div>
            </div>

            <div className="text-[10px] opacity-40 font-mono text-center hud-text">
              QUATERNION SLERP + LOW-PASS FILTER ACTIVE
            </div>
          </>
        )}
      </div>
    </div>
  );
}
