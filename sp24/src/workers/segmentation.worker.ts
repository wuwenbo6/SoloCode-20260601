/// <reference lib="webworker" />

import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import {
  WorkerMessage,
  MainThreadMessage,
  FrameData,
  MaskData,
  ModelConfig,
  SegmentationConfig,
  AccuracyLevel,
  BodyPixModelConfig,
  BodyPixInferenceConfig,
} from '@/types';

let model: bodyPix.BodyPix | null = null;
let currentConfig: SegmentationConfig | null = null;
let frameCount = 0;
let lastFpsUpdate = 0;
let previousMask: Float32Array | null = null;

function getImageDataFromBuffer(
  buffer: ArrayBuffer,
  width: number,
  height: number
): ImageData {
  const data = new Uint8ClampedArray(buffer);
  return new ImageData(data, width, height);
}

function getBodyPixConfig(accuracy: AccuracyLevel): BodyPixModelConfig {
  const configs: Record<AccuracyLevel, BodyPixModelConfig> = {
    low: {
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.5,
      quantBytes: 1,
    },
    medium: {
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 1,
    },
    high: {
      architecture: 'MobileNetV1',
      outputStride: 8,
      multiplier: 1,
      quantBytes: 2,
    },
  };

  return configs[accuracy];
}

function getSegmentationConfig(): BodyPixInferenceConfig {
  const accuracy = currentConfig?.accuracy || 'medium';
  return {
    flipHorizontal: false,
    internalResolution: accuracy === 'high' ? 'medium' : 'low',
    segmentationThreshold: currentConfig?.foregroundThreshold || 0.5,
    maxDetections: 1,
    scoreThreshold: 0.2,
    nmsRadius: 20,
  };
}

async function loadModel(config: ModelConfig): Promise<void> {
  await tf.setBackend('webgl');
  await tf.ready();

  const bodyPixConfig = getBodyPixConfig(config.accuracy);
  model = await bodyPix.load(bodyPixConfig as any);
}

function featherMask(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return maskData;

  const alpha = new Float32Array(width * height);
  for (let i = 0; i < maskData.length; i += 4) {
    alpha[i / 4] = maskData[i] / 255;
  }

  const dist = new Float32Array(width * height);
  dist.fill(1e9);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (alpha[idx] > 0.5) {
        dist[idx] = 0;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (y > 0) dist[idx] = Math.min(dist[idx], dist[(y - 1) * width + x] + 1);
      if (x > 0) dist[idx] = Math.min(dist[idx], dist[y * width + (x - 1)] + 1);
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (y < height - 1) dist[idx] = Math.min(dist[idx], dist[(y + 1) * width + x] + 1);
      if (x < width - 1) dist[idx] = Math.min(dist[idx], dist[y * width + (x + 1)] + 1);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (alpha[idx] <= 0.5) {
        const d = dist[idx];
        if (d <= radius) {
          alpha[idx] = 1.0 - d / radius;
        }
      }
    }
  }

  const result = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    const v = Math.round(alpha[i] * 255);
    const offset = i * 4;
    result[offset] = v;
    result[offset + 1] = v;
    result[offset + 2] = v;
    result[offset + 3] = 255;
  }

  return result;
}

function temporalSmoothMask(
  currentMask: Float32Array,
  previousMask: Float32Array | null,
  alpha: number
): Float32Array {
  if (!previousMask || alpha >= 1.0) return currentMask;

  const smoothed = new Float32Array(currentMask.length);
  for (let i = 0; i < currentMask.length; i++) {
    smoothed[i] = alpha * currentMask[i] + (1 - alpha) * previousMask[i];
  }
  return smoothed;
}

function gaussianBlur1D(
  data: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  if (sigma <= 0) return data;

  const kernelRadius = Math.ceil(sigma * 2);
  const kernelSize = kernelRadius * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - kernelRadius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = -kernelRadius; k <= kernelRadius; k++) {
        const sx = Math.min(width - 1, Math.max(0, x + k));
        val += data[y * width + sx] * kernel[k + kernelRadius];
      }
      temp[y * width + x] = val;
    }
  }

  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = -kernelRadius; k <= kernelRadius; k++) {
        const sy = Math.min(height - 1, Math.max(0, y + k));
        val += temp[sy * width + x] * kernel[k + kernelRadius];
      }
      result[y * width + x] = val;
    }
  }

  return result;
}

function segmentationToMask(
  segmentation: bodyPix.SemanticPersonSegmentation,
  width: number,
  height: number
): MaskData {
  const featherRadius = currentConfig?.featherRadius || 3;
  const temporalAlpha = currentConfig?.temporalSmooth ?? 0.4;
  const edgeSmoothing = currentConfig?.edgeSmoothing || 5;

  let rawMask = new Uint8ClampedArray(width * height * 4);
  const { data } = segmentation;

  for (let i = 0; i < data.length; i++) {
    const isPerson = data[i] === 1;
    const offset = i * 4;
    const value = isPerson ? 255 : 0;
    rawMask[offset] = value;
    rawMask[offset + 1] = value;
    rawMask[offset + 2] = value;
    rawMask[offset + 3] = 255;
  }

  rawMask = featherMask(rawMask, width, height, featherRadius);

  let alphaChannel = new Float32Array(width * height);
  for (let i = 0; i < alphaChannel.length; i++) {
    alphaChannel[i] = rawMask[i * 4] / 255;
  }

  if (edgeSmoothing > 0) {
    const sigma = edgeSmoothing * 0.4;
    alphaChannel = gaussianBlur1D(alphaChannel, width, height, sigma);
  }

  alphaChannel = temporalSmoothMask(alphaChannel, previousMask, temporalAlpha);
  previousMask = new Float32Array(alphaChannel);

  const maskData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < alphaChannel.length; i++) {
    const v = Math.round(alphaChannel[i] * 255);
    const offset = i * 4;
    maskData[offset] = v;
    maskData[offset + 1] = v;
    maskData[offset + 2] = v;
    maskData[offset + 3] = 255;
  }

  return {
    buffer: maskData.buffer,
    width,
    height,
    timestamp: performance.now(),
  };
}

async function processFrame(frameData: FrameData): Promise<MaskData | null> {
  if (!model) return null;

  const imageData = getImageDataFromBuffer(
    frameData.buffer,
    frameData.width,
    frameData.height
  );

  const segmentationConfig = getSegmentationConfig();
  const segmentation = await model.segmentPerson(imageData, segmentationConfig as any);

  const mask = segmentationToMask(
    segmentation as bodyPix.SemanticPersonSegmentation,
    frameData.width,
    frameData.height
  );

  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    const fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    postMessage({ type: 'FPS_UPDATE', fps } as MainThreadMessage);
    frameCount = 0;
    lastFpsUpdate = now;
  }

  return mask;
}

function disposeModel(): void {
  if (model) {
    model.dispose();
    model = null;
  }
  previousMask = null;
  tf.disposeVariables();
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'LOAD_MODEL': {
        await loadModel(message.config);
        postMessage({ type: 'MODEL_LOADED' } as MainThreadMessage);
        break;
      }

      case 'PROCESS_FRAME': {
        const mask = await processFrame(message.frame);
        if (mask) {
          postMessage(
            {
              type: 'FRAME_PROCESSED',
              mask,
              transfer: [mask.buffer],
            } as MainThreadMessage,
            [mask.buffer]
          );
        }
        break;
      }

      case 'UPDATE_CONFIG': {
        currentConfig = message.config;
        break;
      }

      case 'UNLOAD_MODEL': {
        disposeModel();
        break;
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    if (message.type === 'LOAD_MODEL') {
      postMessage({
        type: 'MODEL_LOAD_ERROR',
        error: errorMessage,
      } as MainThreadMessage);
    } else if (message.type === 'PROCESS_FRAME') {
      postMessage({
        type: 'PROCESS_ERROR',
        error: errorMessage,
      } as MainThreadMessage);
    }
  }
};

self.onerror = (event) => {
  console.error('Worker error:', event.error);
  postMessage({
    type: 'PROCESS_ERROR',
    error: event.message,
  } as MainThreadMessage);
};
