import { create } from 'zustand'
import type { Track, Project, EffectChain, WaveformData } from '@/types/audio'
import { createDefaultTrack, createDefaultEffectChain, TRACK_COLORS } from '@/types/audio'
import { decodeAudioFile } from '@/audio/decoder'
import { audioEngine } from '@/audio/engine'
import { waveformManager } from '@/audio/waveformManager'
import { mixTracksSampleAccurate } from '@/utils/audioUtils'

interface AudioState {
  project: Project
  tracks: Track[]
  selectedTrackId: string | null
  currentTime: number
  isPlaying: boolean
  isLooping: boolean
  loopStart: number
  loopEnd: number
  zoom: number
  scrollLeft: number
  waveformData: Map<string, WaveformData>
  isLoading: boolean
  isMonitoring: boolean
  selectedEffectType: 'compressor' | 'equalizer' | 'limiter' | null

  initAudioEngine: () => Promise<void>
  addTrack: (file: File) => Promise<void>
  removeTrack: (trackId: string) => void
  selectTrack: (trackId: string | null) => void
  updateTrack: (trackId: string, updates: Partial<Track>) => void
  updateTrackEffects: (trackId: string, effects: Partial<EffectChain>) => void
  setCurrentTime: (time: number) => void
  togglePlay: () => void
  toggleLoop: () => void
  setLoopRange: (start: number, end: number) => void
  setZoom: (zoom: number) => void
  setScrollLeft: (scroll: number) => void
  toggleMonitoring: () => void
  setSelectedEffectType: (type: 'compressor' | 'equalizer' | 'limiter' | null) => void
  saveProject: () => string
  loadProject: (xmlContent: string) => Promise<void>
  exportWAV: () => Promise<Blob>
  newProject: () => void
  updateProject: (updates: Partial<Project>) => void
  getAudioContext: () => AudioContext | null
  getMasterGain: () => GainNode | null
}

export const useAudioStore = create<AudioState>((set, get) => ({
  project: {
    name: '未命名项目',
    sampleRate: 44100,
    duration: 60,
    tracks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  tracks: [],
  selectedTrackId: null,
  currentTime: 0,
  isPlaying: false,
  isLooping: false,
  loopStart: 0,
  loopEnd: 0,
  zoom: 1,
  scrollLeft: 0,
  waveformData: new Map(),
  isLoading: false,
  isMonitoring: true,
  selectedEffectType: null,

  initAudioEngine: async () => {
    await audioEngine.init()
    audioEngine.setOnTimeUpdate((time) => {
      const state = get()
      if (time > state.project.duration) {
        set({ isPlaying: false, currentTime: 0 })
        audioEngine.pauseTracks()
      } else {
        set({ currentTime: time })
      }
    })
  },

  addTrack: async (file: File) => {
    set({ isLoading: true })
    try {
      const result = await decodeAudioFile(file)
      const { tracks } = get()
      const trackBase = createDefaultTrack(file.name.replace(/\.[^/.]+$/, ''), tracks.length)
      
      const track: Track = {
        ...trackBase,
        audioBuffer: result.audioBuffer,
        audioData: await file.arrayBuffer(),
        audioFileName: file.name,
        duration: result.audioBuffer.duration,
        trimEnd: result.audioBuffer.duration,
        startTime: tracks.length * 0.5,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      }

      await audioEngine.createTrackNodes(track)
      
      waveformManager.generateMultiResolution(track.id, result.audioBuffer, 1000)
      
      const newWaveformData = new Map(get().waveformData)
      newWaveformData.set(track.id, result.waveformData)
      
      set((state) => ({
        tracks: [...state.tracks, track],
        waveformData: newWaveformData,
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to add track:', error)
      set({ isLoading: false })
    }
  },

  removeTrack: (trackId: string) => {
    audioEngine.disposeTrack(trackId)
    waveformManager.clearTrack(trackId)
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
    }))
  },

  selectTrack: (trackId: string | null) => {
    set({ selectedTrackId: trackId })
  },

  updateTrack: (trackId: string, updates: Partial<Track>) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    }))

    const track = get().tracks.find((t) => t.id === trackId)
    if (track) {
      if ('volume' in updates) {
        audioEngine.updateTrackVolume(trackId, track.muted ? 0 : track.volume)
      }
      if ('pan' in updates) {
        audioEngine.updateTrackPan(trackId, track.pan)
      }
      if ('muted' in updates) {
        audioEngine.updateTrackMute(trackId, track.muted, track.volume)
      }
      if ('phaseInvert' in updates) {
        audioEngine.updateTrackPhaseInvert(trackId, track.phaseInvert)
      }
    }
  },

  updateTrackEffects: (trackId: string, effects: Partial<EffectChain>) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, effects: { ...t.effects, ...effects } }
          : t
      ),
    }))

    const track = get().tracks.find((t) => t.id === trackId)
    if (track) {
      if (effects.compressor) {
        audioEngine.updateTrackCompressor(trackId, effects.compressor)
      }
      if (effects.equalizer) {
        audioEngine.updateTrackEqualizer(trackId, effects.equalizer)
      }
      if (effects.limiter) {
        audioEngine.updateTrackLimiter(trackId, effects.limiter)
      }
    }
  },

  setCurrentTime: (time: number) => {
    set({ currentTime: time })
    audioEngine.setCurrentTime(time)
    
    if (audioEngine.getIsPlaying()) {
      const { tracks } = get()
      audioEngine.playTracks(tracks, time)
    }
  },

  togglePlay: () => {
    const { isPlaying, tracks, currentTime } = get()
    if (isPlaying) {
      audioEngine.pauseTracks()
      set({ isPlaying: false })
    } else {
      audioEngine.playTracks(tracks, currentTime)
      set({ isPlaying: true })
    }
  },

  toggleLoop: () => {
    set((state) => ({ isLooping: !state.isLooping }))
  },

  setLoopRange: (start: number, end: number) => {
    set({ loopStart: start, loopEnd: end })
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.5, Math.min(8, zoom)) })
  },

  setScrollLeft: (scroll: number) => {
    set({ scrollLeft: Math.max(0, scroll) })
  },

  toggleMonitoring: () => {
    set((state) => ({ isMonitoring: !state.isMonitoring }))
  },

  setSelectedEffectType: (type) => {
    set({ selectedEffectType: type })
  },

  saveProject: () => {
    const { project, tracks } = get()
    const xml = generateProjectXML(project, tracks)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}.xml`
    a.click()
    URL.revokeObjectURL(url)
    return xml
  },

  loadProject: async (xmlContent: string) => {
    try {
      const parsed = parseProjectXML(xmlContent)
      set({ tracks: [], selectedTrackId: null })
      
      for (const trackData of parsed.tracks) {
        const trackBase = createDefaultTrack(trackData.name || 'Track', 0)
        const track: Track = {
          ...trackBase,
          ...trackData,
          audioBuffer: null,
          audioData: null,
        } as Track
        set((state) => ({ tracks: [...state.tracks, track] }))
      }
      
      set({ project: parsed.project as Project })
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  },

  exportWAV: async () => {
    const { tracks, project } = get()
    return exportToWAV(tracks, project.sampleRate, project.duration)
  },

  newProject: () => {
    audioEngine.stopAllTracks()
    set({
      project: {
        name: '未命名项目',
        sampleRate: 44100,
        duration: 60,
        tracks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      tracks: [],
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      waveformData: new Map(),
    })
  },

  updateProject: (updates: Partial<Project>) => {
    set((state) => ({
      project: { ...state.project, ...updates, updatedAt: Date.now() },
    }))
  },

  getAudioContext: () => {
    return audioEngine.getAudioContext()
  },

  getMasterGain: () => {
    return audioEngine.getMasterGain()
  },
}))

function generateProjectXML(project: Project, tracks: Track[]): string {
  const tracksXML = tracks
    .map(
      (track) => `
    <track id="${track.id}" name="${track.name}" color="${track.color}">
      <audio fileName="${track.audioFileName}" startTime="${track.startTime}" duration="${track.duration}" trimStart="${track.trimStart}" trimEnd="${track.trimEnd}"/>
      <volume value="${track.volume}"/>
      <pan value="${track.pan}"/>
      <muted value="${track.muted}"/>
      <phaseInvert value="${track.phaseInvert}"/>
      <effects>
        <compressor threshold="${track.effects.compressor.threshold}" ratio="${track.effects.compressor.ratio}" attack="${track.effects.compressor.attack}" release="${track.effects.compressor.release}" bypassed="${track.effects.compressor.bypassed}" phaseInvert="${track.effects.compressor.phaseInvert}"/>
        <equalizer bypassed="${track.effects.equalizer.bypassed}" phaseInvert="${track.effects.equalizer.phaseInvert}">
          ${track.effects.equalizer.bands
            .map(
              (band, i) =>
                `<band index="${i}" frequency="${band.frequency}" gain="${band.gain}" q="${band.q}" type="${band.type}"/>`
            )
            .join('')}
        </equalizer>
        <limiter threshold="${track.effects.limiter.threshold}" attack="${track.effects.limiter.attack}" release="${track.effects.limiter.release}" bypassed="${track.effects.limiter.bypassed}" phaseInvert="${track.effects.limiter.phaseInvert}"/>
      </effects>
    </track>
  `
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<project name="${project.name}" sampleRate="${project.sampleRate}" duration="${project.duration}" createdAt="${project.createdAt}" updatedAt="${Date.now()}">
  <tracks>
    ${tracksXML}
  </tracks>
</project>`
}

function parseProjectXML(xmlContent: string): {
  project: Partial<Project>
  tracks: Partial<Track>[]
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')
  
  const projectEl = doc.querySelector('project')
  const trackEls = doc.querySelectorAll('track')
  
  const tracks: Partial<Track>[] = []
  
  trackEls.forEach((trackEl) => {
    const audioEl = trackEl.querySelector('audio')
    const volumeEl = trackEl.querySelector('volume')
    const panEl = trackEl.querySelector('pan')
    const mutedEl = trackEl.querySelector('muted')
    const phaseInvertEl = trackEl.querySelector('phaseInvert')
    const compressorEl = trackEl.querySelector('compressor')
    const equalizerEl = trackEl.querySelector('equalizer')
    const limiterEl = trackEl.querySelector('limiter')
    
    const bands = Array.from(equalizerEl?.querySelectorAll('band') || []).map((bandEl) => ({
      frequency: parseFloat(bandEl.getAttribute('frequency') || '1000'),
      gain: parseFloat(bandEl.getAttribute('gain') || '0'),
      q: parseFloat(bandEl.getAttribute('q') || '1.4'),
      type: (bandEl.getAttribute('type') as any) || 'peaking',
    }))
    
    const defaultEffects = createDefaultEffectChain()
    
    tracks.push({
      id: trackEl.getAttribute('id') || crypto.randomUUID(),
      name: trackEl.getAttribute('name') || 'Track',
      color: trackEl.getAttribute('color') || '#6366f1',
      audioFileName: audioEl?.getAttribute('fileName') || '',
      startTime: parseFloat(audioEl?.getAttribute('startTime') || '0'),
      duration: parseFloat(audioEl?.getAttribute('duration') || '0'),
      trimStart: parseFloat(audioEl?.getAttribute('trimStart') || '0'),
      trimEnd: parseFloat(audioEl?.getAttribute('trimEnd') || '0'),
      volume: parseFloat(volumeEl?.getAttribute('value') || '0.8'),
      pan: parseFloat(panEl?.getAttribute('value') || '0'),
      muted: mutedEl?.getAttribute('value') === 'true',
      phaseInvert: phaseInvertEl?.getAttribute('value') === 'true',
      effects: {
        ...defaultEffects,
        compressor: {
          ...defaultEffects.compressor,
          threshold: parseFloat(compressorEl?.getAttribute('threshold') || '-20'),
          ratio: parseFloat(compressorEl?.getAttribute('ratio') || '4'),
          attack: parseFloat(compressorEl?.getAttribute('attack') || '10'),
          release: parseFloat(compressorEl?.getAttribute('release') || '100'),
          bypassed: compressorEl?.getAttribute('bypassed') === 'true',
          phaseInvert: compressorEl?.getAttribute('phaseInvert') === 'true',
        },
        equalizer: {
          ...defaultEffects.equalizer,
          bands,
          bypassed: equalizerEl?.getAttribute('bypassed') === 'true',
          phaseInvert: equalizerEl?.getAttribute('phaseInvert') === 'true',
        },
        limiter: {
          ...defaultEffects.limiter,
          threshold: parseFloat(limiterEl?.getAttribute('threshold') || '-0.5'),
          attack: parseFloat(limiterEl?.getAttribute('attack') || '1'),
          release: parseFloat(limiterEl?.getAttribute('release') || '50'),
          bypassed: limiterEl?.getAttribute('bypassed') === 'true',
          phaseInvert: limiterEl?.getAttribute('phaseInvert') === 'true',
        },
      },
    })
  })
  
  return {
    project: {
      name: projectEl?.getAttribute('name') || '未命名项目',
      sampleRate: parseFloat(projectEl?.getAttribute('sampleRate') || '44100'),
      duration: parseFloat(projectEl?.getAttribute('duration') || '60'),
      createdAt: parseFloat(projectEl?.getAttribute('createdAt') || Date.now().toString()),
      updatedAt: parseFloat(projectEl?.getAttribute('updatedAt') || Date.now().toString()),
    },
    tracks,
  }
}

async function exportToWAV(
  tracks: Track[],
  sampleRate: number,
  duration: number
): Promise<Blob> {
  const trackConfigs = tracks
    .filter(track => track.audioBuffer !== null)
    .map(track => ({
      audioBuffer: track.audioBuffer!,
      startTime: track.startTime,
      trimStart: track.trimStart,
      trimEnd: track.trimEnd,
      volume: track.muted ? 0 : track.volume,
      phaseInvert: track.phaseInvert,
      muted: track.muted,
    }))

  const renderedBuffer = await mixTracksSampleAccurate(
    trackConfigs,
    sampleRate,
    duration
  )

  const wav = audioBufferToWAV(renderedBuffer)
  return new Blob([wav], { type: 'audio/wav' })
}

function audioBufferToWAV(buffer: AudioBuffer): ArrayBuffer {
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

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
