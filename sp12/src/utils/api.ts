import axios from 'axios';
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskProgressRequest,
  TaskResponse,
  TaskListResponse,
} from '../../shared/types.js';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
});

export const taskApi = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<TaskListResponse>('/tasks');
    return response.data.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<TaskResponse>(`/tasks/${id}`);
    if (!response.data.data) throw new Error('Task not found');
    return response.data.data;
  },

  create: async (data: CreateTaskRequest): Promise<Task> => {
    const response = await api.post<TaskResponse>('/tasks', data);
    if (!response.data.data) throw new Error('Failed to create task');
    return response.data.data;
  },

  updateProgress: async (
    id: string,
    data: UpdateTaskProgressRequest
  ): Promise<Task> => {
    const response = await api.put<TaskResponse>(`/tasks/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update task');
    return response.data.data;
  },

  cancel: async (id: string): Promise<Task> => {
    const response = await api.post<TaskResponse>(`/tasks/${id}/cancel`);
    if (!response.data.data) throw new Error('Failed to cancel task');
    return response.data.data;
  },

  uploadResult: async (
    id: string,
    blob: Blob,
    filename: string,
    onProgress?: (progress: number) => void
  ): Promise<Task> => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalSize = blob.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = blob.slice(start, end);

      const formData = new FormData();
      formData.append('file', chunk, filename);
      formData.append('chunk', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('filename', filename);

      await api.post(`/tasks/${id}/upload-chunk`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const chunkProgress = (progressEvent.loaded || 0) / progressEvent.total;
            const overallProgress = Math.round(
              ((i + chunkProgress) / totalChunks) * 100
            );
            onProgress(overallProgress);
          }
        },
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
    }

    const response = await api.post<TaskResponse>(`/tasks/${id}/complete-upload`, {
      filename,
      totalChunks,
    });

    if (!response.data.data) throw new Error('Failed to upload result');
    return response.data.data;
  },

  getDownloadUrl: (filename: string): string => {
    return `${API_BASE_URL}/download/${filename}`;
  },

  getBatchDownloadUrl: (taskIds: string[]): string => {
    const ids = taskIds.join(',');
    return `${API_BASE_URL}/download/batch?ids=${encodeURIComponent(ids)}`;
  },
};

export default api;
