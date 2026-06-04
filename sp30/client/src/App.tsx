import { useState, useEffect, useRef, useCallback } from 'react';
import { WebTransportClient } from './WebTransportClient';
import { H264VideoEncoder } from './H264VideoEncoder';
import { H264VideoDecoder } from './H264VideoDecoder';
import { VideoCapturer } from './VideoCapturer';
import { BandwidthEstimator } from './BandwidthEstimator';
import type { 
  RoomInfo, 
  EncodingConfig, 
  StreamStats, 
  StatsPayload,
  ChatMessagePayload,
  RecordingStatusPayload,
  TextOverlayPayload
} from './types';
import StatsPanel from './StatsPanel';
import RoomPanel from './RoomPanel';
import { ChatPanel } from './ChatPanel';
import './App.css';

const SERVER_URL = 'https://localhost:4433/ws';

const DEFAULT_CONFIG: EncodingConfig = {
  bitrate: 2000000,
  framerate: 30,
  width: 640,
  height: 480,
};

function App() {
  const [connected, setConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [clientId, setClientId] = useState('');
  const [subscribedPublishers, setSubscribedPublishers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [webcodecsSupported, setWebcodecsSupported] = useState<boolean | null>(null);
  const [encodingConfig, setEncodingConfig] = useState<EncodingConfig>(DEFAULT_CONFIG);
  const [hardwareMode, setHardwareMode] = useState<string>('N/A');
  const [publisherStats, setPublisherStats] = useState<StreamStats>({
    rtt: 0,
    lossRate: 0,
    bitrate: 0,
    framerate: 0,
    estimatedBandwidth: 0,
  });
  const [subscriberStats, setSubscriberStats] = useState<StreamStats>({
    rtt: 0,
    lossRate: 0,
    bitrate: 0,
    framerate: 0,
    estimatedBandwidth: 0,
  });
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingFilename, setRecordingFilename] = useState<string | null>(null);
  const [_recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [textOverlay, setTextOverlay] = useState<TextOverlayPayload>({
    publisher_id: '',
    text: '',
    position: 'bottom-left',
    font_size: 24,
    color: '#ffffff',
    background_color: 'rgba(0,0,0,0.6)',
    show: false,
  });
  const [showOverlayConfig, setShowOverlayConfig] = useState(false);
  const [overlayText, setOverlayText] = useState('');

  const wtClientRef = useRef<WebTransportClient | null>(null);
  const encoderRef = useRef<H264VideoEncoder | null>(null);
  const decoderRef = useRef<H264VideoDecoder | null>(null);
  const capturerRef = useRef<VideoCapturer | null>(null);
  const bweRef = useRef<BandwidthEstimator | null>(null);
  const publisherCanvasRef = useRef<HTMLCanvasElement>(null);
  const subscriberCanvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const statsIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = await H264VideoEncoder.checkSupport() && await H264VideoDecoder.checkSupport();
      setWebcodecsSupported(supported);
      if (!supported) {
        setError('WebCodecs H.264 is not supported in this browser. Please use Chrome 94+ or Edge 94+.');
      }
    };
    checkSupport();
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (isRecording && wtClientRef.current && currentRoomId && clientId) {
      wtClientRef.current.stopRecording(currentRoomId, clientId).catch(() => {});
    }

    if (capturerRef.current) {
      capturerRef.current.stop();
      capturerRef.current = null;
    }

    if (encoderRef.current) {
      encoderRef.current.close();
      encoderRef.current = null;
    }

    if (decoderRef.current) {
      decoderRef.current.close();
      decoderRef.current = null;
    }

    if (wtClientRef.current) {
      wtClientRef.current.close();
      wtClientRef.current = null;
    }

    bweRef.current = null;
    setConnected(false);
    setIsPublishing(false);
    setHardwareMode('N/A');
  }, [isRecording, currentRoomId, clientId]);

  const handleEncodedFrame = useCallback(async (data: Uint8Array, timestamp: number, frameType: number, frameId: number) => {
    if (wtClientRef.current && connected) {
      try {
        await wtClientRef.current.sendVideoData(data, timestamp, frameType, frameId);
      } catch (err) {
        console.error('Failed to send video data:', err);
      }
    }
  }, [connected]);

  const handleRequestKeyFrame = useCallback((_subscriberId: string) => {
    if (encoderRef.current && isPublishing) {
      console.log(`[App] Key frame requested by subscriber ${_subscriberId}`);
      encoderRef.current.forceKeyFrame();
    }
  }, [isPublishing]);

  const handleChatMessage = useCallback((chat: ChatMessagePayload) => {
    console.log('[App] Received chat message:', chat);
    setChatMessages((prev) => [...prev, chat]);
  }, []);

  const handleRecordingStatus = useCallback((status: RecordingStatusPayload) => {
    console.log('[App] Recording status:', status);
    setIsRecording(status.is_recording);
    setRecordingFilename(status.filename || null);
    if (status.is_recording && status.start_time) {
      setRecordingStartTime(status.start_time);
    }
  }, []);

  const handleTextOverlay = useCallback((overlay: TextOverlayPayload) => {
    console.log('[App] Received text overlay:', overlay);
    if (decoderRef.current) {
      decoderRef.current.setTextOverlay(overlay);
    }
  }, []);

  const handleConfigChange = useCallback(async (config: Partial<EncodingConfig>) => {
    if (encoderRef.current) {
      await encoderRef.current.updateConfig(config);
      const newConfig = encoderRef.current.getConfig();
      setEncodingConfig(newConfig);
      setHardwareMode(encoderRef.current.getHardwareMode());

      if (capturerRef.current && config.framerate) {
        await capturerRef.current.setFramerate(config.framerate);
      }

      if (wtClientRef.current && config.bitrate && config.framerate) {
        await wtClientRef.current.sendBitrateChange(config.bitrate, config.framerate);
      }
    }
  }, []);

  const handleStreamData = useCallback((_publisherId: string, data: Uint8Array, timestamp: number, frameType: number) => {
    if (decoderRef.current) {
      decoderRef.current.decode(data, timestamp, frameType);
    }
  }, []);

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'room_list') {
      setRooms(msg.payload || []);
    }
  }, []);

  const handleRoomInfo = useCallback((info: RoomInfo) => {
    setRooms((prev) => {
      const exists = prev.some((r) => r.id === info.id);
      if (exists) {
        return prev.map((r) => (r.id === info.id ? info : r));
      }
      return [...prev, info];
    });
  }, []);

  const handlePublisherLeft = useCallback((publisherId: string) => {
    setSubscribedPublishers((prev) => prev.filter((id) => id !== publisherId));
    if (decoderRef.current) {
      decoderRef.current.reset();
    }
  }, []);

  const connect = useCallback(async () => {
    if (connected || !webcodecsSupported) return;

    try {
      setError(null);

      const client = new WebTransportClient({
        url: SERVER_URL,
        onMessage: handleMessage,
        onRoomInfo: handleRoomInfo,
        onStreamData: handleStreamData,
        onPublisherLeft: handlePublisherLeft,
        onRequestKeyFrame: handleRequestKeyFrame,
        onChatMessage: handleChatMessage,
        onRecordingStatus: handleRecordingStatus,
        onTextOverlay: handleTextOverlay,
        onConnected: () => {
          setConnected(true);
          setClientId(client.getClientId());
        },
        onDisconnected: () => {
          setConnected(false);
          setIsPublishing(false);
          setCurrentRoomId(null);
        },
      });

      await client.connect();
      wtClientRef.current = client;

      if (subscriberCanvasRef.current) {
        const decoder = new H264VideoDecoder({
          canvas: subscriberCanvasRef.current,
          width: DEFAULT_CONFIG.width,
          height: DEFAULT_CONFIG.height,
        });
        await decoder.init();
        decoderRef.current = decoder;
      }

      bweRef.current = new BandwidthEstimator(DEFAULT_CONFIG, {
        onConfigChange: handleConfigChange,
        minBitrate: 200000,
        maxBitrate: 8000000,
        minFramerate: 10,
        maxFramerate: 60,
      });

      statsIntervalRef.current = window.setInterval(() => {
        updateStats();
      }, 500);

      await client.requestRoomList();

    } catch (err) {
      setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [connected, webcodecsSupported, handleMessage, handleRoomInfo, handleStreamData, handlePublisherLeft, handleConfigChange, handleRequestKeyFrame, handleChatMessage, handleRecordingStatus, handleTextOverlay]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const updateStats = useCallback(() => {
    if (!wtClientRef.current) return;

    const rtt = wtClientRef.current.getRTT();
    const lossRate = wtClientRef.current.getLossRate();
    const bitrate = wtClientRef.current.getCurrentBitrate();

    const capturerFps = capturerRef.current?.getActualFramerate() || 0;

    if (bweRef.current) {
      const estBw = bweRef.current.getEstimatedBandwidth();

      const stats: StreamStats = {
        rtt,
        lossRate,
        bitrate,
        framerate: capturerFps,
        estimatedBandwidth: estBw,
      };

      if (isPublishing) {
        setPublisherStats(stats);
        bweRef.current.updateStats(stats);

        const statsPayload: StatsPayload = {
          rtt,
          loss_rate: lossRate,
          bitrate,
          framerate: capturerFps,
          timestamp: Date.now(),
        };
        wtClientRef.current.sendStats(statsPayload).catch(() => {});

        if (encoderRef.current) {
          setHardwareMode(encoderRef.current.getHardwareMode());
        }
      } else {
        setSubscriberStats(stats);
      }
    }
  }, [isPublishing]);

  const joinRoom = useCallback(async (roomId: string, roomName: string) => {
    if (!wtClientRef.current) return;

    try {
      if (isPublishing) {
        await stopPublishing();
      }

      await wtClientRef.current.joinRoom(roomId, roomName);
      setCurrentRoomId(roomId);
    } catch (err) {
      setError(`Failed to join room: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isPublishing]);

  const leaveRoom = useCallback(async () => {
    if (!wtClientRef.current || !currentRoomId) return;

    try {
      if (isPublishing) {
        await stopPublishing();
      }

      await wtClientRef.current.leaveRoom();
      setCurrentRoomId(null);
      setSubscribedPublishers([]);
    } catch (err) {
      setError(`Failed to leave room: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [currentRoomId, isPublishing]);

  const startPublishing = useCallback(async () => {
    if (!wtClientRef.current || !currentRoomId || !publisherCanvasRef.current) return;

    try {
      setError(null);

      const encoder = new H264VideoEncoder({
        config: DEFAULT_CONFIG,
        onEncodedFrame: handleEncodedFrame,
      });
      await encoder.init();
      encoderRef.current = encoder;
      setEncodingConfig(encoder.getConfig());
      setHardwareMode(encoder.getHardwareMode());

      const capturer = new VideoCapturer({
        onFrame: (frame) => {
          if (encoderRef.current) {
            encoderRef.current.encodeFrame(frame);
          }
        },
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
        framerate: DEFAULT_CONFIG.framerate,
      });

      const stream = await capturer.start();
      capturerRef.current = capturer;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await wtClientRef.current.startPublish();
      setIsPublishing(true);

    } catch (err) {
      setError(`Failed to start publishing: ${err instanceof Error ? err.message : String(err)}`);
      if (encoderRef.current) {
        encoderRef.current.close();
        encoderRef.current = null;
      }
      if (capturerRef.current) {
        capturerRef.current.stop();
        capturerRef.current = null;
      }
    }
  }, [currentRoomId, handleEncodedFrame]);

  const stopPublishing = useCallback(async () => {
    if (wtClientRef.current) {
      await wtClientRef.current.stopPublish();
    }

    if (capturerRef.current) {
      capturerRef.current.stop();
      capturerRef.current = null;
    }

    if (encoderRef.current) {
      await encoderRef.current.flush();
      encoderRef.current.close();
      encoderRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setIsPublishing(false);
    setHardwareMode('N/A');
  }, []);

  const subscribe = useCallback(async (publisherId: string) => {
    if (!wtClientRef.current) return;

    try {
      await wtClientRef.current.subscribe(publisherId);
      setSubscribedPublishers((prev) => [...prev, publisherId]);

      if (decoderRef.current) {
        decoderRef.current.reset();
      }
    } catch (err) {
      setError(`Failed to subscribe: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const unsubscribe = useCallback(async (publisherId: string) => {
    if (!wtClientRef.current) return;

    try {
      await wtClientRef.current.unsubscribe(publisherId);
      setSubscribedPublishers((prev) => prev.filter((id) => id !== publisherId));
    } catch (err) {
      setError(`Failed to unsubscribe: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const manualRequestKeyFrame = useCallback(() => {
    if (wtClientRef.current && subscribedPublishers.length > 0) {
      wtClientRef.current.requestKeyFrameFromPublisher();
    }
  }, [subscribedPublishers.length]);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!wtClientRef.current) return;
    try {
      await wtClientRef.current.sendChatMessage(message, `User-${clientId.slice(-4)}`);
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }
  }, [clientId]);

  const toggleRecording = useCallback(async () => {
    if (!wtClientRef.current || !currentRoomId || !clientId) return;

    try {
      if (isRecording) {
        await wtClientRef.current.stopRecording(currentRoomId, clientId);
      } else {
        await wtClientRef.current.startRecording(currentRoomId, clientId);
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err);
      setError(`Failed to toggle recording: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [wtClientRef, currentRoomId, clientId, isRecording]);

  const applyTextOverlay = useCallback(async () => {
    if (!wtClientRef.current) return;

    const overlay: TextOverlayPayload = {
      ...textOverlay,
      text: overlayText,
      show: !!overlayText.trim(),
      publisher_id: clientId,
    };

    setTextOverlay(overlay);

    if (encoderRef.current) {
      encoderRef.current.setTextOverlay(overlay.show ? overlay : null);
    }

    try {
      await wtClientRef.current.sendTextOverlay(
        overlayText,
        !!overlayText.trim(),
        overlay.position,
        overlay.font_size,
        overlay.color,
        overlay.background_color
      );
    } catch (err) {
      console.error('Failed to send text overlay:', err);
    }
  }, [wtClientRef, textOverlay, overlayText, clientId]);

  const togglePictureInPicture = useCallback(() => {
    setIsPictureInPicture((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🎬 WebTransport Live Streaming
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Go + WebTransport + WebCodecs H.264 + React
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hardwareMode !== 'N/A' && (
              <div className="text-xs bg-gray-800 px-3 py-1 rounded-full">
                <span className="text-gray-400">Codec: </span>
                <span className={hardwareMode === 'hardware' ? 'text-green-400' : 'text-yellow-400'}>
                  {hardwareMode === 'hardware' ? '⚡ Hardware' : '💻 Software'}
                </span>
              </div>
            )}
            {isPublishing && (
              <>
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {isRecording ? (
                    <>⏹ Stop Recording</>
                  ) : (
                    <>⏺ Start Recording</>
                  )}
                </button>
                <button
                  onClick={() => setShowOverlayConfig(!showOverlayConfig)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                >
                  ✏️ Overlay
                </button>
              </>
            )}
            {subscribedPublishers.length > 0 && (
              <button
                onClick={togglePictureInPicture}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isPictureInPicture
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                🖼️ PiP
              </button>
            )}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showChat
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              💬 Chat
              {chatMessages.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {chatMessages.length}
                </span>
              )}
            </button>
            {webcodecsSupported === false && (
              <div className="text-red-400 text-sm">
                ⚠️ WebCodecs not supported
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-300">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {connected ? (
              <button
                onClick={disconnect}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={!webcodecsSupported}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`space-y-4 ${showChat ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {isPictureInPicture && subscribedPublishers.length > 0 ? (
              <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium">🖼️ Picture-in-Picture Mode</span>
                  <span className="text-xs text-purple-400">PiP Active</span>
                </div>
                <div className="aspect-video bg-black relative">
                  <canvas
                    ref={subscriberCanvasRef}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white">
                      📹 You
                    </div>
                  </div>
                  {subscribedPublishers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      Subscribe to a publisher
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-sm font-medium">📹 Local Preview (Publisher)</span>
                    <div className="flex items-center gap-2">
                      {isPublishing && isRecording && (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          REC
                        </span>
                      )}
                      {isPublishing && (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="aspect-video bg-black relative">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas
                      ref={publisherCanvasRef}
                      className="absolute inset-0 hidden"
                    />
                    {textOverlay.show && textOverlay.text && isPublishing && (
                      <div
                        className="absolute text-white bg-black/60 px-3 py-1.5 rounded text-sm font-bold"
                        style={{
                          left: textOverlay.position.includes('left') ? '20px' : 'auto',
                          right: textOverlay.position.includes('right') ? '20px' : 'auto',
                          top: textOverlay.position.includes('top') ? '20px' : 'auto',
                          bottom: textOverlay.position.includes('bottom') ? '20px' : 'auto',
                        }}
                      >
                        {textOverlay.text}
                      </div>
                    )}
                    {!isPublishing && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        {!connected ? 'Connect first' : currentRoomId ? 'Click Start Publishing' : 'Join a room first'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-sm font-medium">📺 Remote Stream (Subscriber)</span>
                    <div className="flex items-center gap-2">
                      {subscribedPublishers.length > 0 && (
                        <button
                          onClick={manualRequestKeyFrame}
                          className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded transition-colors"
                          title="Request Key Frame"
                        >
                          🔄 Key Frame
                        </button>
                      )}
                      {subscribedPublishers.length > 0 && (
                        <span className="text-xs text-green-400">
                          {subscribedPublishers.length} stream{subscribedPublishers.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="aspect-video bg-black relative">
                    <canvas
                      ref={subscriberCanvasRef}
                      className="w-full h-full object-contain"
                    />
                    {subscribedPublishers.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        {connected ? 'Subscribe to a publisher' : 'Connect first'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showOverlayConfig && isPublishing && (
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-bold mb-3 text-cyan-400 flex items-center gap-2">
                  ✏️ Text Overlay Settings
                  <button
                    onClick={() => setShowOverlayConfig(false)}
                    className="ml-auto text-gray-400 hover:text-white text-lg"
                  >
                    ✕
                  </button>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 block mb-1 text-sm">Overlay Text</label>
                      <input
                        type="text"
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder="Enter text to overlay..."
                        className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1 text-sm">Position</label>
                      <select
                        value={textOverlay.position}
                        onChange={(e) => setTextOverlay({ ...textOverlay, position: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-cyan-500 text-sm"
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="center">Center</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 block mb-1 text-sm">Font Size: {textOverlay.font_size}px</label>
                      <input
                        type="range"
                        min={12}
                        max={72}
                        value={textOverlay.font_size}
                        onChange={(e) => setTextOverlay({ ...textOverlay, font_size: parseInt(e.target.value) })}
                        className="w-full accent-cyan-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-gray-400 block mb-1 text-sm">Text Color</label>
                        <input
                          type="color"
                          value={textOverlay.color}
                          onChange={(e) => setTextOverlay({ ...textOverlay, color: e.target.value })}
                          className="w-full h-10 bg-gray-800 rounded cursor-pointer border border-gray-600"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-gray-400 block mb-1 text-sm">Background</label>
                        <input
                          type="color"
                          value="#000000"
                          onChange={(e) => setTextOverlay({ ...textOverlay, background_color: e.target.value })}
                          className="w-full h-10 bg-gray-800 rounded cursor-pointer border border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={applyTextOverlay}
                  className="mt-4 w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  ✅ Apply Overlay
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatsPanel
                stats={publisherStats}
                isPublisher={true}
                encodingBitrate={encodingConfig.bitrate}
                encodingFramerate={encodingConfig.framerate}
              />
              <StatsPanel
                stats={subscriberStats}
                isPublisher={false}
                encodingBitrate={0}
                encodingFramerate={0}
              />
            </div>
          </div>

          <div className="space-y-4">
            {showChat ? (
              <div className="h-[500px]">
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={sendChatMessage}
                  clientId={clientId}
                />
              </div>
            ) : null}

            <RoomPanel
              rooms={rooms}
              currentRoomId={currentRoomId}
              clientId={clientId}
              isPublisher={isPublishing}
              onJoinRoom={joinRoom}
              onLeaveRoom={leaveRoom}
              onStartPublish={startPublishing}
              onStopPublish={stopPublishing}
              onSubscribe={subscribe}
              onUnsubscribe={unsubscribe}
              subscribedPublishers={subscribedPublishers}
            />

            {isRecording && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-medium text-sm">Recording...</span>
                </div>
                {recordingFilename && (
                  <div className="mt-2 text-xs text-red-300">
                    File: {recordingFilename.split('/').pop()}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-900 rounded-lg p-4 text-white shadow-xl border border-gray-700">
              <h3 className="text-lg font-bold mb-3 text-blue-400 border-b border-gray-700 pb-2">
                ⚙️ Encoding Settings
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-gray-400 block mb-1">
                    Bitrate: {Math.round(encodingConfig.bitrate / 1000)} kbps
                  </label>
                  <input
                    type="range"
                    min={100}
                    max={8000}
                    step={100}
                    value={Math.round(encodingConfig.bitrate / 1000)}
                    onChange={(e) => {
                      const kbps = parseInt(e.target.value);
                      handleConfigChange({ bitrate: kbps * 1000 });
                    }}
                    disabled={!isPublishing}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">
                    Framerate: {encodingConfig.framerate} fps
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={encodingConfig.framerate}
                    onChange={(e) => {
                      const fps = parseInt(e.target.value);
                      handleConfigChange({ framerate: fps });
                    }}
                    disabled={!isPublishing}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-700 space-y-1">
                  <div>💡 <strong>Auto-adjustment:</strong> PID controller smooths bitrate based on RTT, loss, and utilization.</div>
                  <div>📦 <strong>Frame Chunking:</strong> Large I-frames split into 1200-byte chunks with ACK/retry.</div>
                  <div>🔄 <strong>Key Frame Recovery:</strong> Auto-request on corruption or new subscription.</div>
                  <div>⏺️ <strong>Recording:</strong> Server-side MP4 recording with H.264 muxing.</div>
                  <div>🖼️ <strong>PiP Mode:</strong> Picture-in-Picture shows both streams.</div>
                  <div>💬 <strong>Chat:</strong> Real-time chat with text overlay support.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-bold mb-2 text-blue-400">📖 How to Use</h3>
          <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
            <li>Click <strong>Connect</strong> to establish WebTransport connection to the server</li>
            <li>Enter a <strong>Room ID</strong> and click <strong>Join Room</strong> (create it if it doesn't exist)</li>
            <li>Click <strong>Start Publishing</strong> to share your camera (allow camera access when prompted)</li>
            <li>Open another browser tab, connect, join the same room, and click <strong>+</strong> next to the publisher to subscribe</li>
            <li>Click <strong>⏺ Start Recording</strong> to record the stream to MP4 on the server</li>
            <li>Click <strong>✏️ Overlay</strong> to add text overlay on your video</li>
            <li>Click <strong>🖼️ PiP</strong> to enable Picture-in-Picture mode</li>
            <li>Click <strong>💬 Chat</strong> to open the chat panel and send messages</li>
            <li>If you see corruption, click <strong>🔄 Key Frame</strong> to request a key frame</li>
            <li>Watch the stats panel to see real-time RTT, packet loss, and PID-controlled bitrate adjustment</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

export default App;
