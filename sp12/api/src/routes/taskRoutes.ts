import { Router } from 'express';
import multer from 'multer';
import * as taskService from '../services/taskService.js';
import type { CreateTaskRequest, UpdateTaskProgressRequest } from '../../../shared/types.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

router.get('/', (_req, res) => {
  try {
    const tasks = taskService.getAllTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch tasks',
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const task = taskService.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch task',
    });
  }
});

router.post('/', (req, res) => {
  try {
    const body = req.body as CreateTaskRequest;

    if (!body.originalName || !body.originalSize || !body.params || !body.metadata) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const task = taskService.createTask(body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create task',
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const body = req.body as UpdateTaskProgressRequest;
    const task = taskService.updateProgress(req.params.id, body.progress, body.status);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update task',
    });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const task = taskService.cancelTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel task',
    });
  }
});

router.post('/:id/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const task = taskService.uploadResult(req.params.id, req.file);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload result',
    });
  }
});

router.post('/:id/upload-chunk', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No chunk uploaded' });
    }

    const { chunk, totalChunks, filename } = req.body;
    const taskId = req.params.id;

    taskService.saveUploadChunk(
      taskId,
      filename,
      parseInt(chunk),
      parseInt(totalChunks),
      req.file.buffer
    );

    res.json({ success: true, message: `Chunk ${chunk} uploaded successfully` });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload chunk',
    });
  }
});

router.post('/:id/complete-upload', (req, res) => {
  try {
    const { filename, totalChunks } = req.body;
    const taskId = req.params.id;

    const task = taskService.completeChunkedUpload(taskId, filename, parseInt(totalChunks));
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete upload',
    });
  }
});

export default router;
