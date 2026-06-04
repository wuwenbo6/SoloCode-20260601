import mediasoup from 'mediasoup'

export const mediasoupWorkerOptions: mediasoup.types.WorkerSettings = {
  logLevel: 'warn',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  rtcMinPort: 10000,
  rtcMaxPort: 10100,
}

export const mediasoupRouterOptions: mediasoup.types.RouterOptions = {
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      clockRate: 90000,
      parameters: {
        'profile-id': 2,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '4d0032',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
  ],
}

export const webRtcTransportOptions: mediasoup.types.WebRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
}

export const plainTransportOptions: mediasoup.types.PlainTransportOptions = {
  listenIp: {
    ip: '127.0.0.1',
    announcedIp: '127.0.0.1',
  },
  rtcpMux: false,
  comedia: true,
}

export async function createWorker(): Promise<mediasoup.types.Worker> {
  const worker = await mediasoup.createWorker(mediasoupWorkerOptions)
  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds...')
    setTimeout(() => process.exit(1), 2000)
  })
  return worker
}
