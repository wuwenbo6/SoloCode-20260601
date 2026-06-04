const CHUNK_SIZE = 44100 * 30
const RESOLUTION_LEVELS = [100, 500, 1000, 5000, 10000]

function generateWaveformChunk(channelData, startSample, endSample, samplesPerPixel) {
  const length = Math.ceil((endSample - startSample) / samplesPerPixel)
  const peaks = new Float32Array(length * 2)

  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < length; i++) {
    const chunkStart = startSample + i * samplesPerPixel
    const chunkEnd = Math.min(chunkStart + samplesPerPixel, endSample)

    let peakMin = 0
    let peakMax = 0

    for (let j = chunkStart; j < chunkEnd; j++) {
      const sample = channelData[j]
      if (sample < peakMin) peakMin = sample
      if (sample > peakMax) peakMax = sample
    }

    peaks[i * 2] = peakMin
    peaks[i * 2 + 1] = peakMax

    if (peakMin < min) min = peakMin
    if (peakMax > max) max = peakMax
  }

  return { peaks, min, max, startSample, endSample, samplesPerPixel }
}

self.onmessage = function(e) {
  const { type, channelData, startSample, endSample, samplesPerPixel, trackId } = e.data

  if (type === 'generate') {
    try {
      const totalSamples = endSample - startSample
      const numChunks = Math.ceil(totalSamples / CHUNK_SIZE)

      for (let c = 0; c < numChunks; c++) {
        const chunkStart = startSample + c * CHUNK_SIZE
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, endSample)

        const result = generateWaveformChunk(channelData, chunkStart, chunkEnd, samplesPerPixel)

        self.postMessage({
          type: 'chunk',
          trackId,
          chunkIndex: c,
          totalChunks: numChunks,
          ...result
        }, [result.peaks.buffer])

        if (c % 5 === 0) {
          self.postMessage({
            type: 'progress',
            trackId,
            progress: Math.round(((c + 1) / numChunks) * 100)
          })
        }
      }

      self.postMessage({
        type: 'complete',
        trackId,
        samplesPerPixel
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        trackId,
        error: error.message
      })
    }
  } else if (type === 'generateMultiResolution') {
    try {
      const results = {}

      for (const level of RESOLUTION_LEVELS) {
        const result = generateWaveformChunk(channelData, startSample, endSample, level)
        results[level] = {
          peaks: Array.from(result.peaks),
          min: result.min,
          max: result.max
        }

        self.postMessage({
          type: 'resolutionLevel',
          trackId,
          level,
          ...results[level]
        })
      }

      self.postMessage({
        type: 'multiResComplete',
        trackId,
        resolutions: RESOLUTION_LEVELS
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        trackId,
        error: error.message
      })
    }
  }
}
