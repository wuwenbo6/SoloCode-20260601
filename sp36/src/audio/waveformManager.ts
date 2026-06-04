import type { WaveformData, MultiResolutionWaveform, WaveformWorkerMessage } from '@/types/audio'

interface TrackWaveformState {
  [trackId: string]: MultiResolutionWaveform
}

type ProgressCallback = (trackId: string, progress: number) => void
type CompleteCallback = (trackId: string, resolution: number) => void
type ChunkCallback = (trackId: string, chunkIndex: number, totalChunks: number, peaks: Float32Array) => void

export class WaveformManager {
  private worker: Worker | null = null
  private waveformStates: TrackWaveformState = {}
  private onProgressCallback: ProgressCallback | null = null
  private onCompleteCallback: CompleteCallback | null = null
  private onChunkCallback: ChunkCallback | null = null

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker('/worklets/waveform.worker.js')
        this.worker.onmessage = this.handleWorkerMessage.bind(this)
        this.worker.onerror = (error) => {
          console.error('Waveform worker error:', error)
        }
      } catch (error) {
        console.warn('Failed to create waveform worker, falling back to main thread', error)
      }
    }
  }

  private handleWorkerMessage(e: MessageEvent<WaveformWorkerMessage>) {
    const { type, trackId } = e.data

    if (!trackId) return

    switch (type) {
      case 'progress':
        if (this.onProgressCallback && e.data.progress !== undefined) {
          this.onProgressCallback(trackId, e.data.progress)
          if (this.waveformStates[trackId]) {
            this.waveformStates[trackId].progress = e.data.progress
          }
        }
        break

      case 'chunk':
        if (this.onChunkCallback && e.data.peaks) {
          const peaks = e.data.peaks instanceof Float32Array 
            ? e.data.peaks 
            : new Float32Array(e.data.peaks as number[])
          this.onChunkCallback(
            trackId,
            e.data.chunkIndex || 0,
            e.data.totalChunks || 1,
            peaks
          )
        }
        break

      case 'resolutionLevel':
        if (e.data.level !== undefined && e.data.peaks && e.data.min !== undefined && e.data.max !== undefined) {
          const peaks = e.data.peaks instanceof Float32Array
            ? e.data.peaks
            : new Float32Array(e.data.peaks as number[])
          
          if (!this.waveformStates[trackId]) {
            this.waveformStates[trackId] = {
              resolutions: {},
              currentResolution: 1000,
              isLoading: true,
              progress: 0,
            }
          }
          
          this.waveformStates[trackId].resolutions[e.data.level] = {
            peaks,
            min: e.data.min,
            max: e.data.max,
          }
        }
        break

      case 'multiResComplete':
        if (this.waveformStates[trackId]) {
          this.waveformStates[trackId].isLoading = false
          this.waveformStates[trackId].progress = 100
        }
        if (this.onCompleteCallback) {
          this.onCompleteCallback(trackId, this.waveformStates[trackId]?.currentResolution || 1000)
        }
        break

      case 'complete':
        if (this.waveformStates[trackId]) {
          this.waveformStates[trackId].isLoading = false
          this.waveformStates[trackId].progress = 100
        }
        if (this.onCompleteCallback && e.data.samplesPerPixel) {
          this.onCompleteCallback(trackId, e.data.samplesPerPixel)
        }
        break

      case 'error':
        console.error('Waveform generation error for track', trackId, ':', e.data.error)
        if (this.waveformStates[trackId]) {
          this.waveformStates[trackId].isLoading = false
        }
        break
    }
  }

  generateMultiResolution(trackId: string, audioBuffer: AudioBuffer, samplesPerPixel?: number): void {
    if (!audioBuffer || audioBuffer.length === 0) return

    const channelData = audioBuffer.getChannelData(0)
    const resolution = samplesPerPixel || 1000

    this.waveformStates[trackId] = {
      resolutions: {},
      currentResolution: resolution,
      isLoading: true,
      progress: 0,
    }

    if (this.worker) {
      this.worker.postMessage({
        type: 'generateMultiResolution',
        trackId,
        channelData,
        startSample: 0,
        endSample: channelData.length,
        samplesPerPixel: resolution,
      }, [channelData.buffer])
    } else {
      this.generateFallback(trackId, audioBuffer, resolution)
    }
  }

  generateWaveform(trackId: string, audioBuffer: AudioBuffer, samplesPerPixel: number = 1000): void {
    if (!audioBuffer || audioBuffer.length === 0) return

    const channelData = audioBuffer.getChannelData(0)

    if (!this.waveformStates[trackId]) {
      this.waveformStates[trackId] = {
        resolutions: {},
        currentResolution: samplesPerPixel,
        isLoading: true,
        progress: 0,
      }
    }

    if (this.worker) {
      this.worker.postMessage({
        type: 'generate',
        trackId,
        channelData,
        startSample: 0,
        endSample: channelData.length,
        samplesPerPixel,
      }, [channelData.buffer])
    } else {
      this.generateFallback(trackId, audioBuffer, samplesPerPixel)
    }
  }

  private generateFallback(trackId: string, audioBuffer: AudioBuffer, samplesPerPixel: number): void {
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

      if (i % 1000 === 0 && this.onProgressCallback) {
        this.onProgressCallback(trackId, Math.round((i / length) * 100))
      }
    }

    if (!this.waveformStates[trackId]) {
      this.waveformStates[trackId] = {
        resolutions: {},
        currentResolution: samplesPerPixel,
        isLoading: false,
        progress: 100,
      }
    }

    this.waveformStates[trackId].resolutions[samplesPerPixel] = { peaks, min, max }
    this.waveformStates[trackId].isLoading = false
    this.waveformStates[trackId].progress = 100

    if (this.onCompleteCallback) {
      this.onCompleteCallback(trackId, samplesPerPixel)
    }
  }

  getWaveform(trackId: string, samplesPerPixel?: number): WaveformData | null {
    const state = this.waveformStates[trackId]
    if (!state) return null

    const resolution = samplesPerPixel || state.currentResolution
    return state.resolutions[resolution] || null
  }

  getMultiResWaveform(trackId: string): MultiResolutionWaveform | null {
    return this.waveformStates[trackId] || null
  }

  getOptimalResolution(trackId: string, pixels: number, duration: number, sampleRate: number): number {
    const samplesPerPixel = (duration * sampleRate) / pixels
    const availableResolutions = [100, 500, 1000, 5000, 10000]
    
    let optimal = availableResolutions[0]
    for (const res of availableResolutions) {
      if (res >= samplesPerPixel) {
        optimal = res
        break
      }
      optimal = res
    }
    
    return optimal
  }

  setOnProgressCallback(callback: ProgressCallback | null) {
    this.onProgressCallback = callback
  }

  setOnCompleteCallback(callback: CompleteCallback | null) {
    this.onCompleteCallback = callback
  }

  setOnChunkCallback(callback: ChunkCallback | null) {
    this.onChunkCallback = callback
  }

  clearTrack(trackId: string) {
    delete this.waveformStates[trackId]
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.waveformStates = {}
  }
}

export const waveformManager = new WaveformManager()
