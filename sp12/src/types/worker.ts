import type { TranscodeParams } from '../../shared/types.js';

export type WorkerMessageType =
  | 'load'
  | 'load_progress'
  | 'load_complete'
  | 'transcode'
  | 'transcode_progress'
  | 'transcode_complete'
  | 'cancel'
  | 'error'
  | 'log';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: any;
}

export interface LoadPayload {
  coreURL: string;
  wasmURL: string;
}

export interface TranscodePayload {
  file: File;
  params: TranscodeParams;
  fileArrayBuffer: ArrayBuffer;
}

export interface ProgressPayload {
  progress: number;
  stage: 'loading' | 'reading' | 'transcoding' | 'writing' | 'uploading';
}

export interface TranscodeCompletePayload {
  data: ArrayBuffer;
  format: string;
  mimeType: string;
}

export interface ErrorPayload {
  message: string;
}
