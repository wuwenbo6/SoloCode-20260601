import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, Play, Square, Settings } from 'lucide-react';
import { videoAPI } from '../services/api';
import type { VideoStreamInfo } from '../types';
import { cn } from '../utils';

interface VideoMonitorProps {
  disabled?: boolean;
}

export function VideoMonitor({ disabled }: VideoMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animationRef = useRef<number | null>(null);
  const frameDataRef = useRef<{ data: Uint8Array; width: number; height: number; timestamp: number; frameNum: number } | null>(null);

  const [connected, setConnected] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [streamInfo, setStreamInfo] = useState<VideoStreamInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [fps, setFps] = useState(15);
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [currentFrame, setCurrentFrame] = useState({ timestamp: 0, frameNum: 0, syncDelta: 0 });

  const loadStreamInfo = useCallback(async () => {
    try {
      const info = await videoAPI.getInfo();
      setStreamInfo(info);
      setStreamActive(info.active);
    } catch (e) {
      console.error('Failed to load stream info:', e);
    }
  }, []);

  useEffect(() => {
    loadStreamInfo();
    const interval = setInterval(loadStreamInfo, 5000);
    return () => clearInterval(interval);
  }, [loadStreamInfo]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const frameData = frameDataRef.current;
    if (!canvas || !frameData) {
      animationRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== frameData.width || canvas.height !== frameData.height) {
      canvas.width = frameData.width;
      canvas.height = frameData.height;
    }

    const imageData = ctx.createImageData(frameData.width, frameData.height);
    for (let i = 0, j = 0; i < frameData.data.length; i += 3, j += 4) {
      imageData.data[j] = frameData.data[i];
      imageData.data[j + 1] = frameData.data[i + 1];
      imageData.data[j + 2] = frameData.data[i + 2];
      imageData.data[j + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    animationRef.current = requestAnimationFrame(renderFrame);
  }, []);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [renderFrame]);

  const connectStream = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/api/video/ws`);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data);
        if (data.length < 20) return;

        const view = new DataView(data.buffer);
        const width = view.getUint32(0, true);
        const height = view.getUint32(4, true);
        const timestamp = Number(view.getBigUint64(8, true));
        const frameNum = view.getUint32(16, true);
        const pixelData = data.slice(20);

        const now = Date.now();
        const syncDelta = now - timestamp;

        frameDataRef.current = {
          data: pixelData,
          width,
          height,
          timestamp,
          frameNum,
        };

        setCurrentFrame({ timestamp, frameNum, syncDelta });
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
      };
    } catch (e) {
      console.error('Failed to connect stream:', e);
    }
  }, []);

  const disconnectStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const startStream = async () => {
    try {
      await videoAPI.startStream();
      setStreamActive(true);
      connectStream();
    } catch (e) {
      console.error('Failed to start stream:', e);
    }
  };

  const stopStream = async () => {
    try {
      await videoAPI.stopStream();
      setStreamActive(false);
      disconnectStream();
    } catch (e) {
      console.error('Failed to stop stream:', e);
    }
  };

  useEffect(() => {
    if (streamActive && !connected) {
      connectStream();
    }
    return () => {
      disconnectStream();
    };
  }, [streamActive, connected, connectStream, disconnectStream]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Video className="w-5 h-5 text-primary-600" />
          视频监控
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              connected && streamActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            )}
          ></span>
          <span className="text-sm text-gray-500">
            {connected && streamActive ? '直播中' : streamActive ? '连接中...' : '已停止'}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16">帧率:</label>
            <select
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={10}>10 FPS</option>
              <option value={15}>15 FPS</option>
              <option value={24}>24 FPS</option>
              <option value={30}>30 FPS</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16">分辨率:</label>
            <select
              value={`${resolution.width}x${resolution.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setResolution({ width: w, height: h });
              }}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="320x240">320x240</option>
              <option value="640x480">640x480</option>
              <option value="800x600">800x600</option>
              <option value="1280x720">1280x720</option>
            </select>
          </div>
        </div>
      )}

      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
        {(!connected || !streamActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
            <VideoOff className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-4">
              {disabled ? '请先连接打印机' : '视频流未启动'}
            </p>
            {!disabled && !streamActive && (
              <button
                onClick={startStream}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                开始监控
              </button>
            )}
          </div>
        )}

        {connected && streamActive && (
          <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}

        {streamInfo && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {streamInfo.width}x{streamInfo.height} @ {streamInfo.fps}fps
          </div>
        )}

        {connected && currentFrame.frameNum > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-mono">
            帧 #{currentFrame.frameNum} | 延迟: {currentFrame.syncDelta}ms
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={startStream}
          disabled={disabled || streamActive}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors',
            disabled || streamActive
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          )}
        >
          <Play className="w-4 h-4" />
          开始
        </button>
        <button
          onClick={stopStream}
          disabled={!streamActive}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors',
            !streamActive
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
          )}
        >
          <Square className="w-4 h-4" />
          停止
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        视频通过 WebTransport/WebSocket 实时传输
      </div>
    </div>
  );
}
