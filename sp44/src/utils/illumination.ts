export interface IlluminationState {
  avgLuminance: number;
  gammaFactor: number;
  brightnessBoost: number;
  needsCompensation: boolean;
}

const LOW_LIGHT_THRESHOLD = 0.25;
const VERY_LOW_LIGHT_THRESHOLD = 0.12;
const TARGET_LUMINANCE = 0.35;
const MAX_BRIGHTNESS_BOOST = 80;
const MASK_EDGE_SMOOTH_RADIUS = 3;
const TEMPORAL_ALPHA = 0.3;

export function analyzeIllumination(imageData: ImageData): IlluminationState {
  const data = imageData.data;
  let totalLuminance = 0;
  const sampleStep = 16;
  let sampleCount = 0;

  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
    sampleCount++;
  }

  const avgLuminance = sampleCount > 0 ? totalLuminance / (sampleCount * 255) : 0.5;
  const needsCompensation = avgLuminance < LOW_LIGHT_THRESHOLD;
  const gammaFactor = needsCompensation
    ? Math.max(0.4, Math.log(TARGET_LUMINANCE) / Math.log(Math.max(avgLuminance, 0.01)))
    : 1.0;
  const brightnessBoost = needsCompensation
    ? Math.min(MAX_BRIGHTNESS_BOOST, (TARGET_LUMINANCE - avgLuminance) * 255 * 1.5)
    : 0;

  return { avgLuminance, gammaFactor, brightnessBoost, needsCompensation };
}

export function applyIlluminationCompensation(
  imageData: ImageData,
  illumination: IlluminationState
): ImageData {
  if (!illumination.needsCompensation) return imageData;

  const data = imageData.data;
  const gamma = illumination.gammaFactor;
  const boost = illumination.brightnessBoost;
  const gammaLUT = new Uint8Array(256);

  for (let i = 0; i < 256; i++) {
    const normalized = i / 255;
    const corrected = Math.pow(normalized, 1.0 / gamma);
    const boosted = Math.min(255, corrected * 255 + boost * corrected);
    gammaLUT[i] = Math.round(boosted);
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = gammaLUT[data[i]];
    data[i + 1] = gammaLUT[data[i + 1]];
    data[i + 2] = gammaLUT[data[i + 2]];
  }

  return imageData;
}

export function applyLocalContrastEnhancement(
  imageData: ImageData,
  _illumination: IlluminationState
): void {
  if (!_illumination.needsCompensation) return;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const blockRadius = 8;
  const clipLimit = 2.0;

  for (let by = 0; by < height; by += blockRadius) {
    for (let bx = 0; bx < width; bx += blockRadius) {
      const histogram = new Uint32Array(256);
      let pixelCount = 0;

      for (let y = by; y < Math.min(by + blockRadius, height); y++) {
        for (let x = bx; x < Math.min(bx + blockRadius, width); x++) {
          const idx = (y * width + x) * 4;
          const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          histogram[Math.min(255, lum)]++;
          pixelCount++;
        }
      }

      const clipThreshold = Math.round((pixelCount / 256) * clipLimit);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipThreshold) {
          excess += histogram[i] - clipThreshold;
          histogram[i] = clipThreshold;
        }
      }

      const avgBinIncrement = Math.floor(excess / 256);
      const remainder = excess - avgBinIncrement * 256;
      for (let i = 0; i < 256; i++) {
        histogram[i] += avgBinIncrement;
        if (i < remainder) histogram[i]++;
      }

      const cdf = new Float32Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }
      const cdfMin = cdf.find((v) => v > 0) || 0;
      const cdfMax = cdf[255];

      if (cdfMax === cdfMin) continue;

      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        lut[i] = Math.round(((cdf[i] - cdfMin) / (cdfMax - cdfMin)) * 255);
      }

      for (let y = by; y < Math.min(by + blockRadius, height); y++) {
        for (let x = bx; x < Math.min(bx + blockRadius, width); x++) {
          const idx = (y * width + x) * 4;
          const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          const newLum = lut[lum];
          const scale = lum > 0 ? newLum / lum : 1;
          data[idx] = Math.min(255, Math.round(data[idx] * scale));
          data[idx + 1] = Math.min(255, Math.round(data[idx + 1] * scale));
          data[idx + 2] = Math.min(255, Math.round(data[idx + 2] * scale));
        }
      }
    }
  }
}

export function smoothSegmentationMask(
  maskData: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const radius = MASK_EDGE_SMOOTH_RADIUS;
  const result = new Uint8ClampedArray(maskData.length);
  const kernelSize = radius * 2 + 1;
  const kernelArea = kernelSize * kernelSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            sum += maskData[idx];
            count++;
          }
        }
      }

      const outIdx = (y * width + x) * 4;
      const avg = sum / count;
      const centerIdx = (y * width + x) * 4;
      const blended = maskData[centerIdx] * (1 - TEMPORAL_ALPHA) + avg * TEMPORAL_ALPHA;
      result[outIdx] = Math.round(blended);
      result[outIdx + 1] = Math.round(blended);
      result[outIdx + 2] = Math.round(blended);
      result[outIdx + 3] = 255;
    }
  }

  return result;
}

export function erodeDilateMask(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  iterations: number = 1
): Uint8ClampedArray {
  let current = new Uint8ClampedArray(maskData);

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8ClampedArray(current.length);

    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          let val;

          if (pass === 0) {
            val = 255;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  val = Math.min(val, current[(ny * width + nx) * 4]);
                }
              }
            }
          } else {
            val = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  val = Math.max(val, current[(ny * width + nx) * 4]);
                }
              }
            }
          }

          next[idx] = val;
          next[idx + 1] = val;
          next[idx + 2] = val;
          next[idx + 3] = 255;
        }
      }
      current = next;
    }
  }

  return current;
}

export function detectLowLight(
  video: HTMLVideoElement,
  tempCanvas: HTMLCanvasElement
): IlluminationState {
  const ctx = tempCanvas.getContext('2d')!;
  const sampleWidth = 160;
  const sampleHeight = 120;
  tempCanvas.width = sampleWidth;
  tempCanvas.height = sampleHeight;
  ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);

  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  return analyzeIllumination(imageData);
}
