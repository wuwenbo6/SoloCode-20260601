import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import { AccuracyLevel, BodyPixModelConfig, BodyPixInferenceConfig } from '@/types';

export async function loadBodyPixModel(
  accuracy: AccuracyLevel
): Promise<bodyPix.BodyPix> {
  const config = getBodyPixConfig(accuracy);
  return bodyPix.load(config as any);
}

export function getBodyPixConfig(accuracy: AccuracyLevel): BodyPixModelConfig {
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

export function getSegmentationConfig(
  accuracy: AccuracyLevel
): BodyPixInferenceConfig {
  return {
    flipHorizontal: false,
    internalResolution: accuracy === 'high' ? 'medium' : 'low',
    segmentationThreshold: 0.5,
    maxDetections: 1,
    scoreThreshold: 0.2,
    nmsRadius: 20,
  };
}

export async function segmentPerson(
  model: bodyPix.BodyPix,
  imageData: ImageData
): Promise<bodyPix.SemanticPersonSegmentation | null> {
  try {
    const segmentation = await model.segmentPerson(imageData);
    return segmentation as bodyPix.SemanticPersonSegmentation;
  } catch (error) {
    console.error('Segmentation error:', error);
    return null;
  }
}

export function segmentationToMaskData(
  segmentation: bodyPix.SemanticPersonSegmentation,
  width: number,
  height: number
): { buffer: ArrayBuffer; width: number; height: number } {
  const maskData = new Uint8ClampedArray(width * height * 4);
  const { data } = segmentation;

  for (let i = 0; i < data.length; i++) {
    const isPerson = data[i] === 1;
    const offset = i * 4;
    const value = isPerson ? 255 : 0;

    maskData[offset] = value;
    maskData[offset + 1] = value;
    maskData[offset + 2] = value;
    maskData[offset + 3] = 255;
  }

  return {
    buffer: maskData.buffer,
    width,
    height,
  };
}

export async function setWebGLBackend(): Promise<void> {
  await tf.setBackend('webgl');
  await tf.ready();
}

export function disposeModel(model: bodyPix.BodyPix | null): void {
  if (model) {
    model.dispose();
  }
  tf.disposeVariables();
}
