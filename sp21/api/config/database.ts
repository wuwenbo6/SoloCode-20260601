import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thermal-printer';

export let isDBConnected = false;

export const connectDB = async (): Promise<boolean> => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    isDBConnected = true;
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    isDBConnected = false;
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️  Running without database - some features will be limited');
    return false;
  }
};

export const checkDBConnection = (): boolean => {
  return isDBConnected && mongoose.connection.readyState === 1;
};

mongoose.connection.on('disconnected', () => {
  isDBConnected = false;
  console.log('📡 MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  isDBConnected = true;
  console.log('📡 MongoDB connected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB error:', error);
});
