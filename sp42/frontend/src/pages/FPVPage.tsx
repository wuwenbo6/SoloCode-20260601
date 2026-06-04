import { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Maximize } from 'lucide-react';
import { useFPVStore } from '@/stores/fpvStore';
import { useWebTransport } from '@/hooks/useWebTransport';
import { useH264Decoder } from '@/hooks/useH264Decoder';
import { useTelemetry } from '@/hooks/useTelemetry';
import { useRecorder } from '@/hooks/useRecorder';
import VideoCanvas from '@/components/VideoCanvas';
import OSDOverlay from '@/components/OSDOverlay';
import RecordButton from '@/components/RecordButton';

const FRAME_TYPE_H264 = 0x01;
const FRAME_TYPE_RGBA = 0x02;
const FRAME_TYPE_TELEMETRY = 0x03;
const FRAME_HEADER_SIZE = 17;
const TELEMETRY_HEADER_SIZE = 13;
const BUFFER_TARGET_US = 50_000;
const MAX_BUFFER_SIZE = 30;

interface BufferedFrame {
  pts: number;
  type: 'h264' | 'rgba';
  data: Uint8Array;
  width: number;
  height: number;
}

interface BufferedTelemetry {
  pts: number;
  data: any;
}

function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

function getWebTransportUrl(): string {
  const host = window.location.hostname;
  return `webtransport://${host}:4433/wt`;
}

export default function FPVPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qualityInfo, setQualityInfo] = useState({ level: 2, rtt: 50 });
  const frameBuffer = useRef<BufferedFrame[]>([]);
  const telemBuffer = useRef<BufferedTelemetry[]>([]);
  const baseTime = useRef<number>(performance.now() * 1000);
  const decoderReady = useRef(false);
  const ackTimer = useRef<number | null>(null);

  const { connected, connect, disconnect, incomingStreams, sendDatagram } = useWebTransport({
    url: getWebTransportUrl(),
    autoReconnect: true,
    reconnectDelay: 3000,
  });
  const decoder = useH264Decoder();
  const { recording, elapsedMs, start: startRecording, stop: stopRecording } = useRecorder();
  const setConnection = useFPVStore((s) => s.setConnection);
  const setTelemetry = useFPVStore((s) => s.setTelemetry);
  const setGimbal = useFPVStore((s) => s.setGimbal);

  useEffect(() => {
    setConnection({ webTransport: connected ? 'connected' : 'disconnected' });
  }, [connected, setConnection]);

  useEffect(() => {
    baseTime.current = performance.now() * 1000;
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    if (!connected || !sendDatagram) return;
    const sendAck = () => {
      try {
        sendDatagram(new Uint8Array([0xaa]));
      } catch {}
    };
    ackTimer.current = window.setInterval(sendAck, 500);
    sendAck();
    return () => {
      if (ackTimer.current) clearInterval(ackTimer.current);
    };
  }, [connected, sendDatagram]);

  useEffect(() => {
    decoder.setOnFrame((frame: VideoFrame) => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          if (
            canvasRef.current.width !== frame.displayWidth ||
            canvasRef.current.height !== frame.displayHeight
          ) {
            canvasRef.current.width = frame.displayWidth;
            canvasRef.current.height = frame.displayHeight;
          }
          ctx.drawImage(frame, 0, 0);
        }
      }
      frame.close();
    });
  }, [decoder]);

  const findMatchingTelemetry = useCallback((targetPts: number): any | null => {
    const buf = telemBuffer.current;
    let best: any | null = null;
    let bestDiff = Infinity;
    for (let i = 0; i < buf.length; i++) {
      const diff = Math.abs(buf[i].pts - targetPts);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = buf[i].data;
      }
    }
    return best;
  }, []);

  useEffect(() => {
    let animationId: number;
    const renderLoop = () => {
      const now = (performance.now() * 1000) - baseTime.current;
      const targetPts = now - BUFFER_TARGET_US;

      while (frameBuffer.current.length > 0 && frameBuffer.current[0].pts <= targetPts) {
        const frame = frameBuffer.current.shift()!;
        renderFrame(frame);
        const telem = findMatchingTelemetry(frame.pts);
        if (telem) {
          applyTelemetry(telem);
        }
      }

      if (frameBuffer.current.length > MAX_BUFFER_SIZE) {
        frameBuffer.current = frameBuffer.current.slice(-MAX_BUFFER_SIZE / 2);
      }

      animationId = requestAnimationFrame(renderLoop);
    };
    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [findMatchingTelemetry]);

  const renderFrame = useCallback((frame: BufferedFrame) => {
    if (frame.type === 'h264') {
      const nalType = frame.data[0] & 0x1f;
      const isKey = nalType === 5 || nalType === 7 || nalType === 8;
      if (nalType === 7 || nalType === 8) {
        decoderReady.current = true;
      }
      if (decoderReady.current) {
        try {
          decoder.decode({
            type: isKey ? 'key' : 'delta',
            timestamp: frame.pts,
            data: frame.data,
          });
        } catch {}
      }
    } else if (frame.type === 'rgba') {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          if (canvasRef.current.width !== frame.width || canvasRef.current.height !== frame.height) {
            canvasRef.current.width = frame.width;
            canvasRef.current.height = frame.height;
          }
          const imageData = new ImageData(
            new Uint8ClampedArray(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength),
            frame.width,
            frame.height,
          );
          ctx.putImageData(imageData, 0, 0);
        }
      }
    }
  }, [decoder]);

  const applyTelemetry = useCallback((data: any) => {
    setTelemetry({
      altitude: data.altitude ?? 0,
      speed: data.speed ?? 0,
      gpsLat: data.latitude ?? 0,
      gpsLon: data.longitude ?? 0,
      batteryVoltage: data.battery ?? 0,
      signalStrength: data.signal ?? 0,
      heading: data.heading ?? 0,
    });
    if (data.gimbal) {
      setGimbal({
        yaw: data.gimbal.yaw ?? 0,
        pitch: data.gimbal.pitch ?? 0,
        roll: data.gimbal.roll ?? 0,
      });
    }
    if (data._qualityLevel !== undefined) {
      setQualityInfo({ level: data._qualityLevel, rtt: data._rtt ?? 50 });
    }
  }, [setTelemetry, setGimbal]);

  useEffect(() => {
    if (!incomingStreams) return;

    let cancelled = false;
    const readStreams = async () => {
      const reader = incomingStreams.getReader();
      try {
        while (!cancelled) {
          const { value: stream, done } = await reader.read();
          if (done || cancelled) break;

          const streamReader = stream.getReader();
          let buffer = new Uint8Array(0);

          try {
            while (!cancelled) {
              const { value: chunk, done: streamDone } = await streamReader.read();
              if (streamDone || cancelled) break;
              if (!chunk) continue;

              buffer = concatUint8(
                buffer,
                new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
              );

              while (buffer.length > 0) {
                if (buffer.length < 1) break;
                const frameType = buffer[0];

                if (frameType === FRAME_TYPE_H264 || frameType === FRAME_TYPE_RGBA) {
                  if (buffer.length < FRAME_HEADER_SIZE) break;
                  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
                  const dataLen = view.getUint32(1, false);
                  const width = view.getUint16(5, false);
                  const height = view.getUint16(7, false);
                  const pts = view.getBigUint64(9, false);
                  const totalLen = FRAME_HEADER_SIZE + dataLen;

                  if (buffer.length < totalLen) break;

                  const payload = buffer.slice(FRAME_HEADER_SIZE, totalLen);
                  buffer = buffer.slice(totalLen);

                  frameBuffer.current.push({
                    pts: Number(pts),
                    type: frameType === FRAME_TYPE_H264 ? 'h264' : 'rgba',
                    data: payload,
                    width,
                    height,
                  });
                } else if (frameType === FRAME_TYPE_TELEMETRY) {
                  if (buffer.length < TELEMETRY_HEADER_SIZE) break;
                  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
                  const dataLen = view.getUint32(1, false);
                  const pts = view.getBigUint64(5, false);
                  const totalLen = TELEMETRY_HEADER_SIZE + dataLen;

                  if (buffer.length < totalLen) break;

                  const payload = buffer.slice(TELEMETRY_HEADER_SIZE, totalLen);
                  buffer = buffer.slice(totalLen);

                  try {
                    const data = JSON.parse(new TextDecoder().decode(payload));
                    telemBuffer.current.push({
                      pts: Number(pts),
                      data,
                    });
                    if (telemBuffer.current.length > MAX_BUFFER_SIZE) {
                      telemBuffer.current = telemBuffer.current.slice(-MAX_BUFFER_SIZE / 2);
                    }
                  } catch {}
                } else {
                  buffer = buffer.slice(1);
                }
              }
            }
          } catch {}
        }
      } catch {}
    };

    readStreams();
    return () => {
      cancelled = true;
    };
  }, [incomingStreams]);

  useTelemetry({ source: 'poll', pollUrl: '/api/telemetry', pollInterval: 500 });

  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const handleToggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else if (canvasRef.current) {
      startRecording(canvasRef.current);
    }
  }, [recording, startRecording, stopRecording]);

  const handleFullscreen = useCallback(() => {
    const el = document.getElementById('fpv-container');
    if (el && document.fullscreenEnabled) {
      el.requestFullscreen();
    }
  }, []);

  return (
    <div id="fpv-container" className="h-full w-full bg-black relative overflow-hidden">
      <VideoCanvas onCanvasRef={handleCanvasRef} />
      <OSDOverlay bufferInfo={{ frames: frameBuffer.current.length, telemetry: telemBuffer.current.length }} />

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="hud-panel px-2 py-1 text-xs font-mono hud-text">
          Q{qualityInfo.level} | RTT:{qualityInfo.rtt}ms
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3">
        <button onClick={handleFullscreen} className="hud-btn p-2" title="Fullscreen">
          <Maximize size={16} />
        </button>
        <RecordButton
          recording={recording}
          elapsedMs={elapsedMs}
          onToggle={handleToggleRecording}
        />
        <Link to="/" className="hud-btn p-2" title="Back to Console">
          <ArrowLeft size={16} />
        </Link>
      </div>

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: connected ? '#00ff88' : '#ff3b30',
            boxShadow: connected ? '0 0 6px rgba(0,255,136,0.6)' : '0 0 6px rgba(255,59,48,0.4)',
          }}
        />
        <span className="text-xs font-mono hud-text">
          {connected ? 'WT CONNECTED' : 'WT DISCONNECTED'}
        </span>
      </div>
    </div>
  );
}
