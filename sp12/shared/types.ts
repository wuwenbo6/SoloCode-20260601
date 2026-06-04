export type TaskStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type Resolution = 'original' | '480p' | '720p';
export type Quality = 'high' | 'low';
export type OutputFormat = 'mp4' | 'gif' | 'webp';

export interface TranscodeParams {
  fps: number;
  resolution: Resolution;
  quality: Quality;
  format: OutputFormat;
}

export interface VideoMetadata {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
}

export interface Task {
  id: string;
  originalName: string;
  originalSize: number;
  params: TranscodeParams;
  metadata: VideoMetadata;
  status: TaskStatus;
  progress: number;
  outputFilename?: string;
  outputSize?: number;
  errorMessage?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface CreateTaskRequest {
  originalName: string;
  originalSize: number;
  params: TranscodeParams;
  metadata: VideoMetadata;
}

export interface UpdateTaskProgressRequest {
  progress: number;
  status?: TaskStatus;
}

export interface TaskResponse {
  success: boolean;
  data?: Task;
  message?: string;
}

export interface TaskListResponse {
  success: boolean;
  data: Task[];
}
