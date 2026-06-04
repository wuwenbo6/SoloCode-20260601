import { Router } from 'express';
import archiver from 'archiver';
import * as taskService from '../services/taskService.js';

const router = Router();

router.get('/batch', async (req, res) => {
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) {
      return res.status(400).json({ success: false, message: 'No task IDs provided' });
    }

    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid task IDs' });
    }

    const tasks = await Promise.all(ids.map((id) => taskService.getTask(id)));
    const validTasks = tasks.filter(
      (task): task is NonNullable<typeof task> =>
        task !== null && task.outputFilename && task.status === 'completed'
    );

    if (validTasks.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid completed tasks found' });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFilename = `transcoded_files_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to create ZIP' });
      }
    });

    archive.pipe(res);

    for (const task of validTasks) {
      const filepath = taskService.getDownloadPath(task.outputFilename!);
      if (filepath) {
        const filename = task.outputFilename || `file_${task.id}`;
        archive.file(filepath, { name: filename });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Batch download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to download batch',
      });
    }
  }
});

router.get('/:filename', (req, res) => {
  try {
    const filepath = taskService.getDownloadPath(req.params.filename);

    if (!filepath) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.download(filepath, req.params.filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ success: false, message: 'Download failed' });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to download file',
    });
  }
});

export default router;
