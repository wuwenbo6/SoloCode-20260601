import { generateWaveformData, getFileExtension, getMimeType } from '@/utils/audioUtils'
import type { DecodingResult, DecodingStatus } from '@/types/audio'

export class WebCodecsAudioDecoder {
  private decoder: any | null = null
  private decodedChunks: Float32Array[] = []
  private sampleRate: number = 44100
  private numberOfChannels: number = 1
  private resolvePromise: ((result: DecodingResult) => void) | null = null
  private rejectPromise: ((error: Error) => void) | null = null

  async decodeFile(file: File): Promise<DecodingResult> {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve
      this.rejectPromise = reject
      this.decodedChunks = []

      const extension = getFileExtension(file.name)
      const mimeType = getMimeType(extension)

      if (typeof (window as any).AudioDecoder === 'undefined') {
        this.decodeWithWebAudio(file)
        return
      }

      try {
        this.initDecoder(mimeType)
        this.readAndDecodeFile(file)
      } catch (error) {
        console.warn('WebCodecs decoding failed, falling back to Web Audio API', error)
        this.decodeWithWebAudio(file)
      }
    })
  }

  private initDecoder(mimeType: string) {
    const config = {
      codec: mimeType === 'audio/aac' || mimeType === 'audio/mp4' ? 'mp4a.40.2' : 'mp3',
      sampleRate: 44100,
      numberOfChannels: 2,
    }

    this.decoder = new (window as any).AudioDecoder({
      output: this.handleDecodedChunk.bind(this),
      error: (error: Error) => {
        console.error('Decoder error:', error)
        if (this.rejectPromise) {
          this.rejectPromise(error)
        }
      },
    })

    this.decoder.configure(config)
  }

  private handleDecodedChunk(audioData: AudioData) {
    const channels = audioData.numberOfChannels
    const length = audioData.numberOfFrames
    const data = new Float32Array(length * channels)

    for (let ch = 0; ch < channels; ch++) {
      const channelData = new Float32Array(length)
      audioData.copyTo(channelData, { planeIndex: ch })
      for (let i = 0; i < length; i++) {
        data[i * channels + ch] = channelData[i]
      }
    }

    this.decodedChunks.push(data)
    this.sampleRate = audioData.sampleRate
    this.numberOfChannels = channels
    audioData.close()
  }

  private async readAndDecodeFile(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    const chunkSize = 4096
    let timestamp = 0

    for (let offset = 0; offset < arrayBuffer.byteLength; offset += chunkSize) {
      const chunk = new Uint8Array(arrayBuffer, offset, Math.min(chunkSize, arrayBuffer.byteLength - offset))

      const EncodedAudioChunkClass = (window as any).EncodedAudioChunk
      const encodedChunk = new EncodedAudioChunkClass({
        type: offset === 0 ? 'key' : 'delta',
        timestamp,
        data: chunk,
      })

      this.decoder!.decode(encodedChunk)
      timestamp += 1000000
    }

    await this.decoder!.flush()
    this.assembleAndResolve()
  }

  private assembleAndResolve() {
    const totalLength = this.decodedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const audioBuffer = new AudioContext().createBuffer(
      this.numberOfChannels,
      totalLength / this.numberOfChannels,
      this.sampleRate
    )

    let offset = 0
    for (const chunk of this.decodedChunks) {
      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < chunk.length / this.numberOfChannels; i++) {
          channelData[offset + i] = chunk[i * this.numberOfChannels + ch]
        }
      }
      offset += chunk.length / this.numberOfChannels
    }

    const waveformData = generateWaveformData(audioBuffer)

    if (this.resolvePromise) {
      this.resolvePromise({ audioBuffer, waveformData })
    }
  }

  private async decodeWithWebAudio(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const waveformData = generateWaveformData(audioBuffer)
      audioContext.close()

      if (this.resolvePromise) {
        this.resolvePromise({ audioBuffer, waveformData })
      }
    } catch (error) {
      if (this.rejectPromise) {
        this.rejectPromise(error as Error)
      }
    }
  }

  destroy() {
    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
    }
    this.decodedChunks = []
    this.resolvePromise = null
    this.rejectPromise = null
  }
}

export const decodeAudioFile = async (file: File): Promise<DecodingResult> => {
  const decoder = new WebCodecsAudioDecoder()
  try {
    return await decoder.decodeFile(file)
  } finally {
    decoder.destroy()
  }
}

export const decodeAudioWithStatus = async (
  file: File,
  onStatusChange: (status: DecodingStatus, progress?: number) => void
): Promise<DecodingResult> => {
  onStatusChange('decoding', 0)
  try {
    const result = await decodeAudioFile(file)
    onStatusChange('success', 100)
    return result
  } catch (error) {
    onStatusChange('error', 0)
    throw error
  }
}
