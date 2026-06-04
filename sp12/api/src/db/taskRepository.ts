import { getDb } from './database.js';
import type { Task, CreateTaskRequest, TaskStatus, TranscodeParams, VideoMetadata } from '../../../shared/types.js';

const rowToTask = (row: any): Task => ({
  id: row.id,
  originalName: row.original_name,
  originalSize: row.original_size,
  params: {
    fps: row.fps,
    resolution: row.resolution,
    quality: row.quality,
    format: (row.format || 'mp4') as any,
  } as TranscodeParams,
  metadata: {
    name: row.original_name,
    size: row.original_size,
    duration: row.video_duration,
    width: row.video_width,
    height: row.video_height,
    codec: row.video_codec,
  } as VideoMetadata,
  status: row.status as TaskStatus,
  progress: row.progress,
  outputFilename: row.output_filename ?? undefined,
  outputSize: row.output_size ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
});

export const createTask = (request: CreateTaskRequest): Task => {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  const format = request.params.format || 'mp4';

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, original_name, original_size, fps, resolution, quality, format,
      video_duration, video_width, video_height, video_codec,
      status, progress, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    request.originalName,
    request.originalSize,
    request.params.fps,
    request.params.resolution,
    request.params.quality,
    format,
    request.metadata.duration,
    request.metadata.width,
    request.metadata.height,
    request.metadata.codec,
    'queued',
    0,
    now
  );

  return getTaskById(id)!;
};

export const getTaskById = (id: string): Task | null => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? rowToTask(row) : null;
};

export const getAllTasks = (): Task[] => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return rows.map(rowToTask);
};

export const updateTaskProgress = (
  id: string,
  progress: number,
  status?: TaskStatus
): Task | null => {
  const db = getDb();
  const task = getTaskById(id);
  if (!task) return null;

  const updates: string[] = ['progress = ?'];
  const values: (number | string)[] = [progress];

  if (status) {
    updates.push('status = ?');
    values.push(status);

    if (status === 'processing' && !task.startedAt) {
      updates.push('started_at = ?');
      values.push(Date.now());
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = ?');
      values.push(Date.now());
    }
  }

  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return getTaskById(id);
};

export const updateTaskOutput = (
  id: string,
  outputFilename: string,
  outputSize: number
): Task | null => {
  const db = getDb();
  db.prepare(`
    UPDATE tasks SET output_filename = ?, output_size = ?, status = 'completed', progress = 100, completed_at = ?
    WHERE id = ?
  `).run(outputFilename, outputSize, Date.now(), id);

  return getTaskById(id);
};

export const updateTaskError = (id: string, errorMessage: string): Task | null => {
  const db = getDb();
  db.prepare(`
    UPDATE tasks SET error_message = ?, status = 'failed', completed_at = ?
    WHERE id = ?
  `).run(errorMessage, Date.now(), id);

  return getTaskById(id);
};

export const cancelTask = (id: string): Task | null => {
  const db = getDb();
  const task = getTaskById(id);
  if (!task) return null;

  if (task.status === 'processing' || task.status === 'queued' || task.status === 'pending') {
    db.prepare(`
      UPDATE tasks SET status = 'cancelled', completed_at = ?
      WHERE id = ?
    `).run(Date.now(), id);
    return getTaskById(id);
  }

  return task;
};
