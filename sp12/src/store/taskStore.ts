import { create } from 'zustand';
import type { Task, TranscodeParams, VideoMetadata } from '../../shared/types.js';
import { taskApi } from '../utils/api.js';

interface TaskState {
  tasks: Task[];
  currentTaskId: string | null;
  isTranscoding: boolean;
  isLoading: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (
    file: File,
    params: TranscodeParams,
    metadata: VideoMetadata
  ) => Promise<Task>;
  startTranscode: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => Promise<void>;
  updateTaskProgress: (taskId: string, progress: number) => void;
  setCurrentTaskId: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTaskId: null,
  isTranscoding: false,
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const tasks = await taskApi.getAll();
      set({ tasks, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch tasks',
        isLoading: false,
      });
    }
  },

  createTask: async (file, params, metadata) => {
    set({ isLoading: true });
    try {
      const task = await taskApi.create({
        originalName: file.name,
        originalSize: file.size,
        params,
        metadata,
      });

      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }));

      return task;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create task';
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  startTranscode: (taskId) => {
    set((state) => ({
      currentTaskId: taskId,
      isTranscoding: true,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'processing', startedAt: Date.now() } : t
      ),
    }));
  },

  completeTask: (taskId) => {
    set((state) => ({
      isTranscoding: false,
      currentTaskId: null,
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed', progress: 100, completedAt: Date.now() }
          : t
      ),
    }));
  },

  failTask: (taskId, error) => {
    set((state) => ({
      isTranscoding: false,
      currentTaskId: null,
      error,
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'failed', errorMessage: error, completedAt: Date.now() }
          : t
      ),
    }));
  },

  cancelTask: async (taskId) => {
    try {
      const task = await taskApi.cancel(taskId);
      set((state) => ({
        isTranscoding: state.currentTaskId === taskId ? false : state.isTranscoding,
        currentTaskId: state.currentTaskId === taskId ? null : state.currentTaskId,
        tasks: state.tasks.map((t) => (t.id === taskId ? task : t)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to cancel task' });
    }
  },

  updateTaskProgress: (taskId, progress) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, progress } : t
      ),
    }));
  },

  setCurrentTaskId: (id) => set({ currentTaskId: id }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));
