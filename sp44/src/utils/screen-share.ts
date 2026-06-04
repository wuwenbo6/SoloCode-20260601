const MAX_SCREEN_WIDTH = 1920;
const MAX_SCREEN_HEIGHT = 1080;
const TARGET_BITRATE_KBPS = 2500;
const LOW_BITRATE_THRESHOLD_KBPS = 500;
const STATS_CHECK_INTERVAL_MS = 3000;
const RESOLUTION_TIERS = [
  { width: 3840, height: 2160, maxBitrate: 8000 },
  { width: 2560, height: 1440, maxBitrate: 5000 },
  { width: 1920, height: 1080, maxBitrate: 2500 },
  { width: 1280, height: 720, maxBitrate: 1500 },
  { width: 960, height: 540, maxBitrate: 800 },
];

export interface ScreenShareConstraints {
  maxWidth: number;
  maxHeight: number;
  maxBitrate: number;
}

export function getOptimalConstraints(
  screenResolution: { width: number; height: number },
  currentBitrateKbps?: number
): ScreenShareConstraints {
  let bestTier = RESOLUTION_TIERS[RESOLUTION_TIERS.length - 1];

  for (const tier of RESOLUTION_TIERS) {
    if (screenResolution.width <= tier.width && screenResolution.height <= tier.height) {
      bestTier = tier;
      break;
    }
  }

  if (currentBitrateKbps !== undefined && currentBitrateKbps < LOW_BITRATE_THRESHOLD_KBPS) {
    const currentIdx = RESOLUTION_TIERS.indexOf(bestTier);
    if (currentIdx < RESOLUTION_TIERS.length - 1) {
      bestTier = RESOLUTION_TIERS[currentIdx + 1];
    }
  }

  return {
    maxWidth: Math.min(bestTier.width, MAX_SCREEN_WIDTH),
    maxHeight: Math.min(bestTier.height, MAX_SCREEN_HEIGHT),
    maxBitrate: bestTier.maxBitrate,
  };
}

export function constrainScreenStream(
  stream: MediaStream,
  constraints: ScreenShareConstraints
): MediaStream {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return stream;

  const settings = videoTrack.getSettings();
  if (settings.width && settings.height) {
    const needsDownscale =
      settings.width > constraints.maxWidth || settings.height > constraints.maxHeight;

    if (needsDownscale) {
      const scale = Math.min(
        constraints.maxWidth / settings.width,
        constraints.maxHeight / settings.height
      );
      const newWidth = Math.round(settings.width * scale);
      const newHeight = Math.round(settings.height * scale);

      videoTrack.applyConstraints({
        width: { ideal: newWidth },
        height: { ideal: newHeight },
        frameRate: { ideal: 30 },
      }).catch(() => {});
    }
  }

  try {
    const sender = (videoTrack as any)._sender;
    if (sender && sender.setParameters) {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = constraints.maxBitrate * 1000;
      sender.setParameters(params).catch(() => {});
    }
  } catch {}

  return stream;
}

export interface BandwidthMonitor {
  start: (track: MediaStreamTrack) => void;
  stop: () => void;
  getCurrentBitrateKbps: () => number;
  onLowBandwidth: (callback: (bitrateKbps: number) => void) => void;
}

export function createBandwidthMonitor(): BandwidthMonitor {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastBytesSent = 0;
  let lastTimestamp = 0;
  let currentBitrateKbps = 0;
  let lowBandwidthCallback: ((bitrateKbps: number) => void) | null = null;
  let peerConnection: RTCPeerConnection | null = null;

  const start = (track: MediaStreamTrack) => {
    const stream = new MediaStream([track]);
    const senders = Array.from(
      document.querySelectorAll('video')
    ).flatMap(() => []);

    try {
      const pc = new RTCPeerConnection();
      pc.addTrack(track, stream);
      peerConnection = pc;
    } catch {
      peerConnection = null;
    }

    intervalId = setInterval(async () => {
      if (!peerConnection) return;

      try {
        const stats = await peerConnection.getStats();
        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const bytesSent = report.bytesSent || 0;
            const timestamp = report.timestamp || 0;

            if (lastTimestamp > 0 && timestamp > lastTimestamp) {
              const deltaTime = (timestamp - lastTimestamp) / 1000;
              const deltaBytes = bytesSent - lastBytesSent;
              currentBitrateKbps = (deltaBytes * 8) / (deltaTime * 1000);

              if (currentBitrateKbps < LOW_BITRATE_THRESHOLD_KBPS && lowBandwidthCallback) {
                lowBandwidthCallback(currentBitrateKbps);
              }
            }

            lastBytesSent = bytesSent;
            lastTimestamp = timestamp;
          }
        });
      } catch {}
    }, STATS_CHECK_INTERVAL_MS);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  };

  const getCurrentBitrateKbps = () => currentBitrateKbps;

  const onLowBandwidth = (callback: (bitrateKbps: number) => void) => {
    lowBandwidthCallback = callback;
  };

  return { start, stop, getCurrentBitrateKbps, onLowBandwidth };
}

export function getDisplayMediaWithConstraints(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: MAX_SCREEN_WIDTH, max: 3840 },
      height: { ideal: MAX_SCREEN_HEIGHT, max: 2160 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: true,
    preferCurrentTab: false,
    selfBrowserSurface: 'include',
    systemAudio: 'include',
  } as DisplayMediaStreamOptions);
}

export function applyAdaptiveBitrate(
  track: MediaStreamTrack,
  producer: any
): void {
  if (!producer) return;

  try {
    const sender = (producer as any)?._rtpSender;
    if (sender && sender.getParameters) {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].scaleResolutionDownBy = 1;
      params.encodings[0].maxBitrate = TARGET_BITRATE_KBPS * 1000;
      params.encodings[0].priority = 'high';
      sender.setParameters(params).catch(() => {});
    }
  } catch {}
}
