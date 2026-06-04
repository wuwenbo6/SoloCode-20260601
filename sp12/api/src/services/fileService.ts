import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000');

export const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

export const saveFile = (filename: string, buffer: Buffer): string => {
  ensureUploadDir();
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
};

export const getFilePath = (filename: string): string | null => {
  const filepath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filepath)) {
    return filepath;
  }
  return null;
};

export const deleteFile = (filename: string): boolean => {
  const filepath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
};

export const generateOutputFilename = (originalName: string, taskId: string): string => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  return `${baseName}_transcoded_${taskId.substring(0, 8)}${ext}`;
};

export const getMaxFileSize = (): number => MAX_FILE_SIZE;

const CHUNK_DIR = path.join(UPLOAD_DIR, '.chunks');

const ensureChunkDir = (taskId: string) => {
  const taskChunkDir = path.join(CHUNK_DIR, taskId);
  if (!fs.existsSync(taskChunkDir)) {
    fs.mkdirSync(taskChunkDir, { recursive: true });
  }
  return taskChunkDir;
};

export const saveChunk = (taskId: string, chunkIndex: number, buffer: Buffer): void => {
  const taskChunkDir = ensureChunkDir(taskId);
  const chunkPath = path.join(taskChunkDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`);
  fs.writeFileSync(chunkPath, buffer);
};

export const mergeChunks = (taskId: string, totalChunks: number): Buffer => {
  const taskChunkDir = path.join(CHUNK_DIR, taskId);
  const buffers: Buffer[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(taskChunkDir, `chunk_${i.toString().padStart(6, '0')}`);
    if (fs.existsSync(chunkPath)) {
      buffers.push(fs.readFileSync(chunkPath));
    } else {
      throw new Error(`Missing chunk ${i}`);
    }
  }

  return Buffer.concat(buffers);
};

export const cleanupChunks = (taskId: string, totalChunks: number): void => {
  const taskChunkDir = path.join(CHUNK_DIR, taskId);
  if (fs.existsSync(taskChunkDir)) {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(taskChunkDir, `chunk_${i.toString().padStart(6, '0')}`);
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }
    try {
      fs.rmdirSync(taskChunkDir);
    } catch (e) {
    }
  }
};
