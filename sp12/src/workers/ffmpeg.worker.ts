import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { TranscodeParams } from '../../shared/types.js';
import type {
  WorkerMessage,
  ProgressPayload,
  TranscodeCompletePayload,
} from '../types/worker.js';

const ctx: Worker = self as unknown as Worker;

let ffmpeg: FFmpeg | null = null;
let isCancelled = false;
let currentAbortController: AbortController | null = null;

const getOutputFilename = (format: string): string => {
  return `output.${format}`;
};

const getOutputMimeType = (format: string): string => {
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[format] || 'video/mp4';
};

const buildFFmpegArgs = (params: TranscodeParams): string[] => {
  const resolutionMap: Record<string, string> = {
    '480p': '480:-1',
    '720p': '720:-1',
  };

  const format = params.format || 'mp4';
  const outputFilename = getOutputFilename(format);
  const resolution = params.resolution !== 'original'
    ? `scale=${resolutionMap[params.resolution]}`
    : null;

  if (format === 'gif') {
    const args: string[] = ['-i', 'input.mp4', '-r', params.fps.toString()];
    if (resolution) {
      args.push('-vf', `${resolution},split[a][b],[a]palettegen[p],[b][p]paletteuse`);
    } else {
      args.push('-vf', 'split[a][b],[a]palettegen[p],[b][p]paletteuse');
    }
    if (params.quality === 'low') {
      args.unshift('-t', '15');
    }
    args.push(outputFilename);
    return args;
  }

  if (format === 'webp') {
    const args: string[] = ['-i', 'input.mp4', '-r', params.fps.toString()];
    if (resolution) {
      args.push('-vf', resolution);
    }
    args.push('-c:v', 'libwebp');
    args.push('-lossless', params.quality === 'high' ? '0' : '1');
    args.push('-quality', params.quality === 'high' ? '80' : '50');
    args.push('-loop', '0');
    if (params.quality === 'low') {
      args.unshift('-t', '10');
    }
    args.push(outputFilename);
    return args;
  }

  const crf = params.quality === 'high' ? 23 : 30;
  const preset = params.quality === 'high' ? 'medium' : 'fast';

  const args: string[] = [
    '-i', 'input.mp4',
    '-r', params.fps.toString(),
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf.toString(),
    '-c:a', 'aac',
  ];

  if (resolution) {
    args.push('-vf', resolution);
  }

  args.push(outputFilename);

  return args;
};

const sendMessage = (type: string, payload?: any) => {
  ctx.postMessage({ type, payload });
};

const handleLoad = async () => {
  try {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      sendMessage('log', { message });
    });

    let lastProgress = -1;
    ffmpeg.on('progress', ({ progress }) => {
      const percent = Math.round(progress * 100);
      if (percent !== lastProgress) {
        lastProgress = percent;
        sendMessage('transcode_progress', {
          progress: percent,
          stage: 'transcoding',
        } as ProgressPayload);
      }
    });

    sendMessage('load_progress', { progress: 10, stage: 'loading' } as ProgressPayload);

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    const loadWASM = async () => {
      const wasmResponse = await fetch(`${baseURL}/ffmpeg-core.wasm`);
      const reader = wasmResponse.body?.getReader();
      const contentLength = Number(wasmResponse.headers.get('Content-Length') || 0);

      if (!reader) throw new Error('No reader available');

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (contentLength > 0) {
          const downloadProgress = Math.round((receivedLength / contentLength) * 80) + 10;
          sendMessage('load_progress', {
            progress: Math.min(downloadProgress, 90),
            stage: 'loading',
          } as ProgressPayload);
        }
      }

      const wasmBuffer = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        wasmBuffer.set(chunk, position);
        position += chunk.length;
      }

      return wasmBuffer;
    };

    const [jsResponse, wasmBuffer] = await Promise.all([
      fetch(`${baseURL}/ffmpeg-core.js`).then(r => r.text()),
      loadWASM(),
    ]);

    sendMessage('load_progress', { progress: 95, stage: 'loading' } as ProgressPayload);

    const jsBlob = new Blob([jsResponse], { type: 'application/javascript' });
    const jsURL = URL.createObjectURL(jsBlob);

    const wasmBlob = new Blob([wasmBuffer], { type: 'application/wasm' });
    const wasmURL = URL.createObjectURL(wasmBlob);

    await ffmpeg.load({
      coreURL: jsURL,
      wasmURL: wasmURL,
    });

    URL.revokeObjectURL(jsURL);
    URL.revokeObjectURL(wasmURL);

    sendMessage('load_progress', { progress: 100, stage: 'loading' } as ProgressPayload);
    sendMessage('load_complete');
  } catch (error) {
    sendMessage('error', {
      message: error instanceof Error ? error.message : 'Failed to load FFmpeg',
    });
  }
};

const handleTranscode = async (payload: {
  fileArrayBuffer: ArrayBuffer;
  params: TranscodeParams;
  fileName: string;
}) => {
  if (!ffmpeg) {
    sendMessage('error', { message: 'FFmpeg not loaded' });
    return;
  }

  isCancelled = false;
  currentAbortController = new AbortController();

  const format = payload.params.format || 'mp4';
  const outputFilename = getOutputFilename(format);

  try {
    sendMessage('transcode_progress', { progress: 0, stage: 'reading' } as ProgressPayload);

    const fileData = new Uint8Array(payload.fileArrayBuffer);
    await ffmpeg.writeFile('input.mp4', fileData);

    if (isCancelled) {
      throw new Error('Transcoding cancelled');
    }

    sendMessage('transcode_progress', { progress: 5, stage: 'transcoding' } as ProgressPayload);

    const args = buildFFmpegArgs(payload.params);
    await ffmpeg.exec(args);

    if (isCancelled) {
      throw new Error('Transcoding cancelled');
    }

    sendMessage('transcode_progress', { progress: 95, stage: 'writing' } as ProgressPayload);

    const outputData = await ffmpeg.readFile(outputFilename);

    try {
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile(outputFilename);
    } catch (e) {
    }

    sendMessage('transcode_progress', { progress: 100, stage: 'writing' } as ProgressPayload);

    const outputArrayBuffer: ArrayBuffer =
      outputData instanceof Uint8Array
        ? outputData.buffer.slice(outputData.byteOffset, outputData.byteOffset + outputData.byteLength)
        : outputData as unknown as ArrayBuffer;

    sendMessage('transcode_complete', {
      data: outputArrayBuffer,
      format,
      mimeType: getOutputMimeType(format),
    });
  } catch (error) {
    if (isCancelled || (error as Error).message.includes('cancelled')) {
      sendMessage('error', { message: 'Transcoding cancelled' });
    } else {
      sendMessage('error', {
        message: error instanceof Error ? error.message : 'Transcoding failed',
      });
    }
  } finally {
    currentAbortController = null;
  }
};

const handleCancel = () => {
  isCancelled = true;
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch (e) {
    }
  }
  if (currentAbortController) {
    currentAbortController.abort();
  }
};

ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'load':
      await handleLoad();
      break;
    case 'transcode':
      await handleTranscode(payload);
      break;
    case 'cancel':
      handleCancel();
      break;
  }
};
