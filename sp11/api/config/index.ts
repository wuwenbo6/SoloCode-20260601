import dotenv from 'dotenv';
import { ICEServer } from '../types/index.js';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  autoSaveInterval: process.env.AUTO_SAVE_INTERVAL || '*/5 * * * *',
  stunServers: JSON.parse(process.env.STUN_SERVERS || '["stun:stun.l.google.com:19302"]'),
  turn: {
    enabled: process.env.TURN_ENABLED === 'true',
    url: process.env.TURN_URL || '',
    username: process.env.TURN_USERNAME || '',
    password: process.env.TURN_PASSWORD || '',
  },
};

export const getIceServers = (): ICEServer[] => {
  const iceServers: ICEServer[] = [];

  config.stunServers.forEach((url: string) => {
    iceServers.push({ urls: url });
  });

  if (config.turn.enabled && config.turn.url) {
    iceServers.push({
      urls: config.turn.url,
      username: config.turn.username,
      credential: config.turn.password,
    });
  }

  return iceServers;
};

export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
];

export const generateRandomColor = (): string => {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
};

export const generateRoomId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
