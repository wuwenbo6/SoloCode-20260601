import * as taskRepository from '../db/taskRepository.js';
import * as fileService from './fileService.js';
import type { Task, CreateTaskRequest, TaskStatus } from '../../../shared/types.js';

export const createTask = (request: CreateTaskRequest): Task => {
  if (request.params.fps < 1 || request.params.fps > 30) {
    throw new Error('FPS must be between 1 and 30');
  }
  if (!['original', '480p', '720p'].includes(request.params.resolution)) {
    throw new Error('Invalid resolution');
  }
  if (!['high', 'low'].includes(request.params.quality)) {
    throw new Error('Invalid quality');
  }

  return taskRepository.createTask(request);
};

export const getTask = (id: string): Task | null => {
  return taskRepository.getTaskById(id);
};

export const getAllTasks = (): Task[] => {
  return taskRepository.getAllTasks();
};

export const updateProgress = (
  id: string,
  progress: number,
  status?: TaskStatus
): Task | null => {
  if (progress < 0 || progress > 100) {
    throw new Error('Progress must be between 0 and 100');
  }

  const task = taskRepository.getTaskById(id);
  if (!task) return null;

  if (task.status === 'cancelled' || task.status === 'completed' || task.status === 'failed') {
    throw new Error(`Cannot update task in ${task.status} state`);
  }

  return taskRepository.updateTaskProgress(id, progress, status);
};

export const completeTask = (
  id: string,
  outputFilename: string,
  outputSize: number
): Task | null => {
  const task = taskRepository.getTaskById(id);
  if (!task) return null;

  if (task.status === 'cancelled') {
    throw new Error('Cannot complete cancelled task');
  }

  return taskRepository.updateTaskOutput(id, outputFilename, outputSize);
};

export const failTask = (id: string, errorMessage: string): Task | null => {
  return taskRepository.updateTaskError(id, errorMessage);
};

export const cancelTask = (id: string): Task | null => {
  return taskRepository.cancelTask(id);
};

export const uploadResult = (
  id: string,
  file: Express.Multer.File
): Task | null => {
  const task = taskRepository.getTaskById(id);
  if (!task) return null;

  if (task.status === 'cancelled') {
    fileService.deleteFile(file.filename);
    throw new Error('Task was cancelled');
  }

  const outputFilename = fileService.generateOutputFilename(task.originalName, id);
  fileService.saveFile(outputFilename, file.buffer);

  return completeTask(id, outputFilename, file.size);
};

export const getDownloadPath = (filename: string): string | null => {
  return fileService.getFilePath(filename);
};

export const saveUploadChunk = (
  taskId: string,
  filename: string,
  chunkIndex: number,
  totalChunks: number,
  chunkBuffer: Buffer
): void => {
  fileService.saveChunk(taskId, chunkIndex, chunkBuffer);
};

export const completeChunkedUpload = (
  taskId: string,
  filename: string,
  totalChunks: number
): Task | null => {
  const task = taskRepository.getTaskById(taskId);
  if (!task) return null;

  if (task.status === 'cancelled') {
    fileService.cleanupChunks(taskId, totalChunks);
    throw new Error('Task was cancelled');
  }

  const outputFilename = fileService.generateOutputFilename(task.originalName, taskId);
  const finalBuffer = fileService.mergeChunks(taskId, totalChunks);

  fileService.saveFile(outputFilename, finalBuffer);
  fileService.cleanupChunks(taskId, totalChunks);

  return completeTask(taskId, outputFilename, finalBuffer.length);
};
