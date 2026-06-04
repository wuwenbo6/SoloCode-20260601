import cron from 'node-cron';
import { prisma } from './prisma.js';

export const startScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const postsToPublish = await prisma.post.findMany({
        where: {
          scheduledPublishAt: {
            lte: now,
          },
          status: {
            not: 'PUBLISHED',
          },
        },
      });

      if (postsToPublish.length > 0) {
        console.log(`[Scheduler] Found ${postsToPublish.length} posts to publish`);

        for (const post of postsToPublish) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              status: 'PUBLISHED',
              scheduledPublishAt: null,
            },
          });
          console.log(`[Scheduler] Published post: ${post.id} - ${post.title}`);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error publishing scheduled posts:', error);
    }
  });

  console.log('[Scheduler] Started - checking for scheduled posts every minute');
};
