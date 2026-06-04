import type { WaveformData } from '@/types/audio'

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export const formatTimeSimple = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const generateWaveformData = (
  audioBuffer: AudioBuffer,
  samplesPerPixel: number = 1000
): WaveformData => {
  const channelData = audioBuffer.getChannelData(0)
  const length = Math.ceil(channelData.length / samplesPerPixel)
  const peaks = new Float32Array(length * 2)

  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < length; i++) {
    const start = i * samplesPerPixel
    const end = Math.min(start + samplesPerPixel, channelData.length)

    let peakMin = 0
    let peakMax = 0

    for (let j = start; j < end; j++) {
      const sample = channelData[j]
      if (sample < peakMin) peakMin = sample
      if (sample > peakMax) peakMax = sample
    }

    peaks[i * 2] = peakMin
    peaks[i * 2 + 1] = peakMax

    if (peakMin < min) min = peakMin
    if (peakMax > max) max = peakMax
  }

  return { peaks, min, max }
}

export const dbToLinear = (db: number): number => {
  return Math.pow(10, db / 20)
}

export const linearToDb = (linear: number): number => {
  return 20 * Math.log10(Math.max(linear, 1e-9))
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t
}

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

export const getMimeType = (extension: string): string => {
  const types: Record<string, string> = {
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
  }
  return types[extension] || 'audio/mpeg'
}

export const createAudioBufferFromChunks = async (
  chunks: Float32Array[],
  sampleRate: number,
  numberOfChannels: number = 1
): Promise<AudioBuffer> => {
  const audioContext = new OfflineAudioContext(numberOfChannels, 1, sampleRate)
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const audioBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate)

  let offset = 0
  for (const chunk of chunks) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      audioBuffer.getChannelData(channel).set(chunk, offset)
    }
    offset += chunk.length
  }

  return audioBuffer
}

export const resampleAudioBuffer = async (
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> => {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer
  }

  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.length * (targetSampleRate / audioBuffer.sampleRate)),
    targetSampleRate
  )

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineCtx.destination)
  source.start()

  return offlineCtx.startRendering()
}

export interface TrackExportConfig {
  audioBuffer: AudioBuffer
  startTime: number
  trimStart: number
  trimEnd: number
  volume: number
  phaseInvert: boolean
  muted: boolean
}

export const mixTracksSampleAccurate = async (
  trackConfigs: TrackExportConfig[],
  sampleRate: number,
  totalDuration: number
): Promise<AudioBuffer> => {
  const totalSamples = Math.ceil(totalDuration * sampleRate)
  const maxChannels = Math.max(...trackConfigs.map(t => t.audioBuffer.numberOfChannels), 2)
  const numTracks = trackConfigs.length

  const mixedData: Float32Array[] = []
  for (let ch = 0; ch < maxChannels; ch++) {
    mixedData.push(new Float32Array(totalSamples))
  }

  let maxPeak = 0

  for (const track of trackConfigs) {
    if (track.muted || track.volume <= 0) continue

    const { audioBuffer, startTime, trimStart, trimEnd, volume, phaseInvert } = track
    const trackChannels = audioBuffer.numberOfChannels
    const phaseMultiplier = phaseInvert ? -1 : 1

    const startSample = Math.round(startTime * sampleRate)
    const trimStartSample = Math.round(trimStart * sampleRate)
    const trimEndSample = Math.round(trimEnd * sampleRate)
    const trackPlayLength = audioBuffer.length - trimStartSample - trimEndSample

    if (trackPlayLength <= 0 || startSample >= totalSamples) continue

    const samplesToProcess = Math.min(trackPlayLength, totalSamples - startSample)
    const volumeGain = volume / Math.sqrt(numTracks)

    for (let ch = 0; ch < maxChannels; ch++) {
      const sourceCh = ch < trackChannels ? ch : trackChannels - 1
      const sourceData = audioBuffer.getChannelData(sourceCh)
      const destData = mixedData[ch]

      for (let i = 0; i < samplesToProcess; i++) {
        const sourceIdx = trimStartSample + i
        const destIdx = startSample + i

        if (sourceIdx >= 0 && sourceIdx < sourceData.length && destIdx >= 0 && destIdx < destData.length) {
          const sample = sourceData[sourceIdx] * phaseMultiplier * volumeGain
          destData[destIdx] += sample

          if (Math.abs(destData[destIdx]) > maxPeak) {
            maxPeak = Math.abs(destData[destIdx])
          }
        }
      }
    }
  }

  if (maxPeak > 1) {
    const normalizationGain = 0.99 / maxPeak
    for (let ch = 0; ch < maxChannels; ch++) {
      for (let i = 0; i < totalSamples; i++) {
        mixedData[ch][i] *= normalizationGain
      }
    }
  }

  const offlineCtx = new OfflineAudioContext(maxChannels, totalSamples, sampleRate)
  const resultBuffer = offlineCtx.createBuffer(maxChannels, totalSamples, sampleRate)

  for (let ch = 0; ch < maxChannels; ch++) {
    resultBuffer.copyToChannel(mixedData[ch], ch)
  }

  return resultBuffer
}

export const mixAudioBuffers = async (
  buffers: AudioBuffer[],
  sampleRate: number
): Promise<AudioBuffer> => {
  const maxLength = Math.max(...buffers.map(b => b.length))
  const maxChannels = Math.max(...buffers.map(b => b.numberOfChannels))
  const offlineCtx = new OfflineAudioContext(maxChannels, maxLength, sampleRate)

  const masterGain = offlineCtx.createGain()
  masterGain.gain.value = 1 / Math.sqrt(buffers.length)
  masterGain.connect(offlineCtx.destination)

  buffers.forEach(buffer => {
    const source = offlineCtx.createBufferSource()
    source.buffer = buffer
    source.connect(masterGain)
    source.start()
  })

  return offlineCtx.startRendering()
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export const audioBufferToWAV = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * blockAlign
  const bufferSize = 44 + dataSize

  const arrayBuffer = new ArrayBuffer(bufferSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return arrayBuffer
}
