export interface CompressorParams {
  threshold: number
  ratio: number
  attack: number
  release: number
  knee: number
  makeupGain: number
  bypassed: boolean
  phaseInvert: boolean
}

export interface EqualizerBand {
  frequency: number
  gain: number
  q: number
  type: 'lowpass' | 'highpass' | 'peaking' | 'lowshelf' | 'highshelf'
}

export interface EqualizerParams {
  bands: EqualizerBand[]
  bypassed: boolean
  phaseInvert: boolean
}

export interface LimiterParams {
  threshold: number
  attack: number
  release: number
  lookahead: number
  ceiling: number
  bypassed: boolean
  phaseInvert: boolean
}

export interface EffectChain {
  id: string
  compressor: CompressorParams
  equalizer: EqualizerParams
  limiter: LimiterParams
  bypassed: boolean
}

export interface Track {
  id: string
  name: string
  audioBuffer: AudioBuffer | null
  audioData: ArrayBuffer | null
  audioFileName: string
  startTime: number
  duration: number
  trimStart: number
  trimEnd: number
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  phaseInvert: boolean
  color: string
  effects: EffectChain
}

export interface Project {
  name: string
  sampleRate: number
  duration: number
  tracks: Track[]
  createdAt: number
  updatedAt: number
}

export interface WaveformData {
  peaks: Float32Array
  min: number
  max: number
}

export interface WaveformChunk {
  peaks: Float32Array
  min: number
  max: number
  startSample: number
  endSample: number
  samplesPerPixel: number
}

export interface MultiResolutionWaveform {
  resolutions: Record<number, WaveformData>
  currentResolution: number
  isLoading: boolean
  progress: number
}

export interface WaveformWorkerMessage {
  type: 'generate' | 'generateMultiResolution' | 'chunk' | 'complete' | 'progress' | 'error' | 'resolutionLevel' | 'multiResComplete'
  trackId?: string
  channelData?: Float32Array
  startSample?: number
  endSample?: number
  samplesPerPixel?: number
  chunkIndex?: number
  totalChunks?: number
  progress?: number
  level?: number
  resolutions?: number[]
  peaks?: Float32Array | number[]
  min?: number
  max?: number
  error?: string
}

export interface SpectrumData {
  frequencies: Float32Array
  magnitudes: Float32Array
  sampleRate: number
  fftSize: number
}

export interface SpectrumAnalyzerConfig {
  fftSize: number
  smoothingTimeConstant: number
  minDecibels: number
  maxDecibels: number
  windowFunction: 'hann' | 'hamming' | 'blackman' | 'rectangular'
}

export const DEFAULT_SPECTRUM_CONFIG: SpectrumAnalyzerConfig = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -100,
  maxDecibels: 0,
  windowFunction: 'hann',
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  isLooping: boolean
  loopStart: number
  loopEnd: number
}

export type DecodingStatus = 'idle' | 'decoding' | 'success' | 'error'

export interface DecodingResult {
  audioBuffer: AudioBuffer
  waveformData: WaveformData
}

export const TRACK_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#f43f5e',
  '#14b8a6',
]

export const DEFAULT_COMPRESSOR_PARAMS: CompressorParams = {
  threshold: -20,
  ratio: 4,
  attack: 10,
  release: 100,
  knee: 6,
  makeupGain: 0,
  bypassed: false,
  phaseInvert: false,
}

export const DEFAULT_EQUALIZER_PARAMS: EqualizerParams = {
  bands: [
    { frequency: 80, gain: 0, q: 1.4, type: 'lowshelf' },
    { frequency: 250, gain: 0, q: 1.4, type: 'peaking' },
    { frequency: 1000, gain: 0, q: 1.4, type: 'peaking' },
    { frequency: 4000, gain: 0, q: 1.4, type: 'peaking' },
    { frequency: 12000, gain: 0, q: 1.4, type: 'highshelf' },
  ],
  bypassed: false,
  phaseInvert: false,
}

export const DEFAULT_LIMITER_PARAMS: LimiterParams = {
  threshold: -0.5,
  attack: 1,
  release: 50,
  lookahead: 5,
  ceiling: -0.1,
  bypassed: false,
  phaseInvert: false,
}

export const createDefaultEffectChain = (): EffectChain => ({
  id: crypto.randomUUID(),
  compressor: { ...DEFAULT_COMPRESSOR_PARAMS },
  equalizer: { ...DEFAULT_EQUALIZER_PARAMS, bands: [...DEFAULT_EQUALIZER_PARAMS.bands.map(b => ({ ...b }))] },
  limiter: { ...DEFAULT_LIMITER_PARAMS },
  bypassed: false,
})

export const createDefaultTrack = (name: string, colorIndex: number): Omit<Track, 'audioBuffer' | 'audioData'> => ({
  id: crypto.randomUUID(),
  name,
  audioFileName: '',
  startTime: 0,
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  phaseInvert: false,
  color: TRACK_COLORS[colorIndex % TRACK_COLORS.length],
  effects: createDefaultEffectChain(),
})

export interface BatchJob {
  id: string
  fileName: string
  file: File | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  effectChain: EffectChain
  outputFormat: 'wav' | 'mp3' | 'flac'
  error?: string
}

export interface BatchConfig {
  effectChain: EffectChain
  outputFormat: 'wav' | 'mp3' | 'flac'
  outputDirectory: string
  overwriteExisting: boolean
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  effectChain: createDefaultEffectChain(),
  outputFormat: 'wav',
  outputDirectory: '',
  overwriteExisting: false,
}

export interface VstPluginParameter {
  id: string
  name: string
  value: number
  minValue: number
  maxValue: number
  defaultValue: number
  stepCount?: number
  unit?: string
  isBypass?: boolean
  isProgramChange?: boolean
}

export interface VstPluginInfo {
  id: string
  name: string
  vendor: string
  version: string
  category: string
  pluginPath: string
  numInputs: number
  numOutputs: number
  parameters: VstPluginParameter[]
  isEnabled: boolean
}

export interface VstHostConfig {
  hostPath: string
  rpcPort: number
  isConnected: boolean
  plugins: VstPluginInfo[]
}

export interface VstRpcMessage {
  id: string
  method: string
  params?: any
  result?: any
  error?: string
}

export interface VstEffectParams {
  pluginId: string
  pluginName: string
  parameters: Record<string, number>
  bypassed: boolean
  phaseInvert: boolean
}

export const DEFAULT_VST_PARAMS: VstEffectParams = {
  pluginId: '',
  pluginName: '',
  parameters: {},
  bypassed: false,
  phaseInvert: false,
}

export interface ExtendedEffectChain extends EffectChain {
  vstPlugins: VstEffectParams[]
}
