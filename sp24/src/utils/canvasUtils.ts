import { Background, MaskData, BlurLevel, BLUR_LEVEL_MAP } from '@/types';

export function createCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function getImageDataFromBuffer(
  buffer: ArrayBuffer,
  width: number,
  height: number
): ImageData {
  const data = new Uint8ClampedArray(buffer);
  return new ImageData(data, width, height);
}

export function applyMaskToImageData(
  foreground: ImageData,
  mask: ImageData,
  threshold: number = 0.5
): ImageData {
  const result = new ImageData(foreground.width, foreground.height);
  const fgData = foreground.data;
  const maskData = mask.data;
  const resultData = result.data;

  for (let i = 0; i < fgData.length; i += 4) {
    const maskValue = maskData[i] / 255;
    const alpha = maskValue > threshold ? maskValue : 0;

    resultData[i] = fgData[i];
    resultData[i + 1] = fgData[i + 1];
    resultData[i + 2] = fgData[i + 2];
    resultData[i + 3] = Math.round(alpha * 255);
  }

  return result;
}

export function smoothMask(
  maskData: ImageData,
  smoothingLevel: number
): ImageData {
  if (smoothingLevel <= 0) return maskData;

  const canvas = createCanvas(maskData.width, maskData.height);
  const ctx = canvas.getContext('2d')!;

  ctx.putImageData(maskData, 0, 0);

  ctx.filter = `blur(${smoothingLevel}px)`;
  ctx.drawImage(canvas, 0, 0);

  return ctx.getImageData(0, 0, maskData.width, maskData.height);
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
  videoElement?: HTMLVideoElement
): void {
  ctx.clearRect(0, 0, width, height);

  switch (background.type) {
    case 'color':
      if (background.color) {
        ctx.fillStyle = background.color;
        ctx.fillRect(0, 0, width, height);
      }
      break;

    case 'transparent':
      ctx.clearRect(0, 0, width, height);
      break;

    case 'blur':
      if (videoElement) {
        const blurAmount = background.blurAmount || 18;
        drawGaussianBlur(ctx, videoElement, width, height, blurAmount);
      }
      break;

    case 'bokeh':
      if (videoElement) {
        const bokehLevel = background.bokehLevel || 'strong';
        drawBokehBackground(ctx, videoElement, width, height, bokehLevel);
      }
      break;

    case 'image':
      if (background.source instanceof HTMLImageElement) {
        drawImageCover(ctx, background.source, width, height);
      }
      break;

    case 'video':
      if (background.source instanceof HTMLVideoElement) {
        drawImageCover(ctx, background.source, width, height);
      }
      break;
  }
}

export function drawGaussianBlur(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  blurAmount: number
): void {
  ctx.save();
  
  ctx.filter = `blur(${blurAmount}px) brightness(1.05) saturate(1.05)`;
  ctx.drawImage(source, -10, -10, width + 20, height + 20);
  
  ctx.restore();
  
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawBokehBackground(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  bokehLevel: BlurLevel
): void {
  const config = BLUR_LEVEL_MAP[bokehLevel];
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d')!;

  tempCtx.filter = `blur(${config.blur}px) brightness(${config.brightness}) contrast(${config.contrast}) saturate(1.1)`;
  tempCtx.drawImage(source, -20, -20, width + 40, height + 40);

  ctx.drawImage(tempCanvas, 0, 0);

  const bokehCount = Math.floor(width * height / 15000);
  for (let i = 0; i < bokehCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 2 + Math.random() * 8;
    const opacity = 0.05 + Math.random() * 0.1;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.2,
    width / 2, height / 2, Math.max(width, height) * 0.8
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number
): void {
  let sourceWidth: number;
  let sourceHeight: number;

  if (source instanceof HTMLVideoElement) {
    sourceWidth = source.videoWidth || width;
    sourceHeight = source.videoHeight || height;
  } else if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width || width;
    sourceHeight = source.naturalHeight || source.height || height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    sourceWidth = width;
    sourceHeight = height;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let drawWidth: number;
  let drawHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (sourceRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * sourceRatio;
    offsetX = (width - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = width;
    drawHeight = width / sourceRatio;
    offsetX = 0;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
}

export function compositeWithMask(
  ctx: CanvasRenderingContext2D,
  foreground: ImageData,
  mask: MaskData,
  config: {
    edgeSmoothing: number;
    foregroundThreshold: number;
  },
  width: number,
  height: number
): void {
  const maskImageData = getImageDataFromBuffer(
    mask.buffer.slice(0),
    mask.width,
    mask.height
  );

  const smoothedMask = smoothMask(maskImageData, config.edgeSmoothing);
  const maskedForeground = applyMaskToImageData(
    foreground,
    smoothedMask,
    config.foregroundThreshold
  );

  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(maskedForeground, 0, 0);

  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tempCanvas, 0, 0, width, height);
}

export function resizeImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const canvas = createCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const resizedCanvas = createCanvas(targetWidth, targetHeight);
  const resizedCtx = resizedCanvas.getContext('2d')!;
  resizedCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  return resizedCtx.getImageData(0, 0, targetWidth, targetHeight);
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.play().then(() => resolve(video)).catch(reject);
    };
    video.onerror = reject;
    video.src = url;
  });
}
