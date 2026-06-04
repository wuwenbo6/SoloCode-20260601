import cron from 'node-cron';
import { config } from '../config/index.js';
import { autoSaveAllRooms } from '../services/versionService.js';

let autoSaveTask: cron.ScheduledTask | null = null;

export const startAutoSaveTask = (): void => {
  if (autoSaveTask) {
    autoSaveTask.stop();
  }

  console.log(`Starting auto-save task with schedule: ${config.autoSaveInterval}`);

  autoSaveTask = cron.schedule(
    config.autoSaveInterval,
    async () => {
      try {
        const savedCount = await autoSaveAllRooms();
        if (savedCount > 0) {
          console.log(`Auto-saved ${savedCount} rooms at ${new Date().toISOString()}`);
        }
      } catch (error) {
        console.error('Auto-save task failed:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    }
  );
};

export const stopAutoSaveTask = (): void => {
  if (autoSaveTask) {
    autoSaveTask.stop();
    autoSaveTask = null;
    console.log('Auto-save task stopped');
  }
};

export const triggerManualAutoSave = async (): Promise<number> => {
  return autoSaveAllRooms();
};
