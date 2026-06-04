import prisma from './prisma.js';
import { Version } from '../types/index.js';
import { getRoomContent } from './roomService.js';

export const saveVersion = async (
  roomId: string,
  createdBy: string,
  content: string,
  autoSaved: boolean = false,
  message?: string
): Promise<Version> => {
  const version = await prisma.version.create({
    data: {
      roomId,
      content,
      createdBy,
      autoSaved,
      message,
    },
  });

  return {
    id: version.id,
    roomId: version.roomId,
    content: version.content,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    autoSaved: version.autoSaved,
    message: version.message ?? undefined,
  };
};

export const getVersions = async (roomId: string, page: number = 1, limit: number = 20): Promise<{ versions: Version[]; total: number }> => {
  const skip = (page - 1) * limit;

  const [versions, total] = await Promise.all([
    prisma.version.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: true },
    }),
    prisma.version.count({ where: { roomId } }),
  ]);

  return {
    versions: versions.map((v) => ({
      id: v.id,
      roomId: v.roomId,
      content: v.content,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
      autoSaved: v.autoSaved,
      message: v.message ?? undefined,
    })),
    total,
  };
};

export const getVersion = async (versionId: string): Promise<Version | null> => {
  const version = await prisma.version.findUnique({
    where: { id: versionId },
    include: { user: true },
  });

  if (!version) return null;

  return {
    id: version.id,
    roomId: version.roomId,
    content: version.content,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    autoSaved: version.autoSaved,
    message: version.message ?? undefined,
  };
};

export const restoreVersion = async (roomId: string, versionId: string, userId: string): Promise<Version> => {
  const version = await prisma.version.findUnique({
    where: { id: versionId, roomId },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const restoredVersion = await saveVersion(
    roomId,
    userId,
    version.content,
    false,
    `Restored from version ${versionId.slice(0, 8)}`
  );

  return restoredVersion;
};

export const autoSaveAllRooms = async (): Promise<number> => {
  const { getAllActiveRooms, getRoomContent } = await import('./roomService.js');
  const activeRooms = getAllActiveRooms();
  let savedCount = 0;

  for (const roomId of activeRooms) {
    const content = getRoomContent(roomId);
    if (content && content.trim().length > 0) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { users: { where: { isHost: true } } },
      });

      if (room && room.users.length > 0) {
        try {
          await saveVersion(roomId, room.users[0].id, content, true, 'Auto-save');
          savedCount++;
        } catch (error) {
          console.error(`Failed to auto-save room ${roomId}:`, error);
        }
      }
    }
  }

  return savedCount;
};
