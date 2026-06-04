import { CompressorNode } from './effects/Compressor'
import { EqualizerNode } from './effects/Equalizer'
import { LimiterNode } from './effects/Limiter'
import type { Track, EffectChain, WaveformData } from '@/types/audio'
import { generateWaveformData } from '@/utils/audioUtils'

export interface TrackAudioNodes {
  source: AudioBufferSourceNode | null
  gain: GainNode
  pan: StereoPannerNode
  phaseInvert: GainNode
  compressor: CompressorNode
  equalizer: EqualizerNode
  limiter: LimiterNode
}

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private trackNodes: Map<string, TrackAudioNodes> = new Map()
  private masterGain: GainNode | null = null
  private isInitialized = false
  private startTime: number = 0
  private pauseTime: number = 0
  private isPlaying: boolean = false
  private animationFrameId: number | null = null
  private onTimeUpdate: ((time: number) => void) | null = null

  async init() {
    if (this.isInitialized) return

    this.audioContext = new AudioContext({ sampleRate: 44100 })
    this.masterGain = this.audioContext.createGain()
    this.masterGain.connect(this.audioContext.destination)
    this.masterGain.gain.value = 0.9

    this.isInitialized = true
  }

  getContext(): AudioContext | null {
    return this.audioContext
  }

  async createTrackNodes(track: Track): Promise<TrackAudioNodes> {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized')
    }

    const gain = this.audioContext.createGain()
    const pan = this.audioContext.createStereoPanner()
    const phaseInvert = this.audioContext.createGain()

    const compressor = new CompressorNode(this.audioContext, track.effects.compressor)
    const equalizer = new EqualizerNode(this.audioContext, track.effects.equalizer)
    const limiter = new LimiterNode(this.audioContext, track.effects.limiter)

    await Promise.all([
      compressor.init(),
      equalizer.init(),
      limiter.init()
    ])

    gain.gain.value = track.muted ? 0 : track.volume
    pan.pan.value = track.pan
    phaseInvert.gain.value = track.phaseInvert ? -1 : 1

    gain.connect(pan)
    pan.connect(phaseInvert)
    phaseInvert.connect(compressor.getInput())
    compressor.getOutput().connect(equalizer.getInput())
    equalizer.getOutput().connect(limiter.getInput())
    limiter.getOutput().connect(this.masterGain!)

    const nodes: TrackAudioNodes = {
      source: null,
      gain,
      pan,
      phaseInvert,
      compressor,
      equalizer,
      limiter
    }

    this.trackNodes.set(track.id, nodes)
    return nodes
  }

  playTracks(tracks: Track[], startTime: number = 0) {
    if (!this.audioContext || !this.masterGain) return

    this.stopAllTracks()

    this.startTime = this.audioContext.currentTime - startTime
    this.pauseTime = 0
    this.isPlaying = true

    tracks.forEach(track => {
      if (!track.audioBuffer) return

      const nodes = this.trackNodes.get(track.id)
      if (!nodes) return

      const source = this.audioContext.createBufferSource()
      source.buffer = track.audioBuffer

      const trackDuration = track.duration - track.trimStart - track.trimEnd
      const offset = track.trimStart
      const startAt = Math.max(0, startTime - track.startTime)
      const when = Math.max(0, track.startTime - startTime)

      source.connect(nodes.gain)

      if (when >= 0) {
        source.start(
          this.audioContext.currentTime + when,
          offset + startAt,
          Math.max(0, trackDuration - startAt)
        )
      }

      nodes.source = source
    })

    this.startTimeUpdate()
  }

  pauseTracks() {
    if (!this.audioContext) return

    this.pauseTime = this.audioContext.currentTime - this.startTime
    this.isPlaying = false

    this.stopAllTracks()
    this.stopTimeUpdate()
  }

  resumeTracks(tracks: Track[]) {
    if (!this.audioContext) return

    this.playTracks(tracks, this.pauseTime)
  }

  stopAllTracks() {
    this.trackNodes.forEach(nodes => {
      if (nodes.source) {
        nodes.source.stop()
        nodes.source.disconnect()
        nodes.source = null
      }
    })
  }

  private startTimeUpdate() {
    if (!this.audioContext) return

    const update = () => {
      if (this.isPlaying && this.onTimeUpdate) {
        const currentTime = this.audioContext.currentTime - this.startTime
        this.onTimeUpdate(currentTime)
      }
      this.animationFrameId = requestAnimationFrame(update)
    }
    update()
  }

  private stopTimeUpdate() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  setOnTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdate = callback
  }

  updateTrackVolume(trackId: string, volume: number) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes && this.audioContext) {
      nodes.gain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01)
    }
  }

  updateTrackPan(trackId: string, pan: number) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes && this.audioContext) {
      nodes.pan.pan.setTargetAtTime(pan, this.audioContext.currentTime, 0.01)
    }
  }

  updateTrackMute(trackId: string, muted: boolean, volume: number) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes && this.audioContext) {
      const targetVolume = muted ? 0 : volume
      nodes.gain.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.01)
    }
  }

  updateTrackCompressor(trackId: string, params: any) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      nodes.compressor.setParams(params)
    }
  }

  updateTrackEqualizer(trackId: string, params: any) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      nodes.equalizer.setParams(params)
    }
  }

  updateTrackLimiter(trackId: string, params: any) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      nodes.limiter.setParams(params)
    }
  }

  updateTrackPhaseInvert(trackId: string, phaseInvert: boolean) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes && this.audioContext) {
      nodes.phaseInvert.gain.setTargetAtTime(phaseInvert ? -1 : 1, this.audioContext.currentTime, 0.01)
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  getMasterGain(): GainNode | null {
    return this.masterGain
  }

  disposeTrack(trackId: string) {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      nodes.source?.stop()
      nodes.source?.disconnect()
      nodes.gain.disconnect()
      nodes.pan.disconnect()
      nodes.phaseInvert.disconnect()
      nodes.compressor.dispose()
      nodes.equalizer.dispose()
      nodes.limiter.dispose()
      this.trackNodes.delete(trackId)
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.pauseTime
    }
    return this.audioContext.currentTime - this.startTime
  }

  setCurrentTime(time: number) {
    this.pauseTime = time
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  generateWaveform(audioBuffer: AudioBuffer): WaveformData {
    return generateWaveformData(audioBuffer)
  }

  async suspend() {
    await this.audioContext?.suspend()
  }

  async resume() {
    await this.audioContext?.resume()
  }

  dispose() {
    this.stopTimeUpdate()
    this.stopAllTracks()
    this.trackNodes.forEach((_, id) => this.disposeTrack(id))
    this.masterGain?.disconnect()
    this.audioContext?.close()
    this.audioContext = null
    this.masterGain = null
    this.isInitialized = false
  }
}

export const audioEngine = new AudioEngine()
