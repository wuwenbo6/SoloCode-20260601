import app from './app.js';
import { connectDB } from './config/database.js';
import { seedDefaultTemplates } from './config/seed.js';

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    const dbConnected = await connectDB();
    
    if (dbConnected) {
      try {
        await seedDefaultTemplates();
      } catch (seedError) {
        console.warn('⚠️  Could not seed default templates:', seedError);
      }
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server ready on port ${PORT}`);
      console.log(`📍 API base: http://localhost:${PORT}/api`);
      if (!dbConnected) {
        console.log('⚠️  Running in demo mode without database');
      }
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
