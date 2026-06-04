import prisma from './prisma.js';
import { generateRoomId, generateRandomColor } from '../config/index.js';
import { User, Room, RoomState } from '../types/index.js';
import bcrypt from 'bcryptjs';

const roomStates = new Map<string, RoomState>();

export const createRoom = async (
  nickname: string,
  roomName?: string,
  password?: string
): Promise<{ roomId: string; user: User }> => {
  const roomId = generateRoomId();
  const color = generateRandomColor();

  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

  const user = await prisma.user.create({
    data: {
      nickname,
      color,
      isHost: true,
      room: {
        create: {
          id: roomId,
          name: roomName || `Room ${roomId}`,
          password: hashedPassword,
          hostId: '',
        },
      },
    },
    include: { room: true },
  });

  await prisma.room.update({
    where: { id: roomId },
    data: { hostId: user.id },
  });

  const roomState: RoomState = {
    roomId,
    members: new Map(),
    currentContent: '',
    contentVersion: 0,
    lastUpdate: Date.now(),
  };

  roomState.members.set(user.id, {
    user: {
      id: user.id,
      nickname: user.nickname,
      color: user.color,
      roomId: user.roomId,
      isHost: user.isHost,
      joinedAt: user.joinedAt,
    },
    socketId: '',
    connected: false,
  });

  roomStates.set(roomId, roomState);

  return {
    roomId,
    user: {
      id: user.id,
      nickname: user.nickname,
      color: user.color,
      roomId: user.roomId,
      isHost: user.isHost,
      joinedAt: user.joinedAt,
    },
  };
};

export const joinRoom = async (
  nickname: string,
  roomId: string,
  password?: string
): Promise<{ room: Room; user: User; currentContent: string; members: User[] }> => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { users: true },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.password) {
    if (!password) {
      throw new Error('Password required');
    }
    const isValid = await bcrypt.compare(password, room.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }
  }

  const color = generateRandomColor();

  const user = await prisma.user.create({
    data: {
      nickname,
      color,
      roomId,
      isHost: false,
    },
  });

  const roomState = roomStates.get(roomId) || {
    roomId,
    members: new Map(),
    currentContent: '',
    contentVersion: 0,
    lastUpdate: Date.now(),
  };

  const userObj: User = {
    id: user.id,
    nickname: user.nickname,
    color: user.color,
    roomId: user.roomId,
    isHost: user.isHost,
    joinedAt: user.joinedAt,
  };

  roomState.members.set(user.id, {
    user: userObj,
    socketId: '',
    connected: false,
  });

  roomStates.set(roomId, roomState);

  const members = Array.from(roomState.members.values()).map((m) => m.user);

  return {
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      members,
    },
    user: userObj,
    currentContent: roomState.currentContent,
    members,
  };
};

export const getRoom = async (roomId: string): Promise<Room | null> => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { users: true },
  });

  if (!room) return null;

  const roomState = roomStates.get(roomId);
  const members = roomState
    ? Array.from(roomState.members.values()).map((m) => m.user)
    : room.users.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        color: u.color,
        roomId: u.roomId,
        isHost: u.isHost,
        joinedAt: u.joinedAt,
      }));

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    members,
  };
};

export const updateRoomContent = (roomId: string, content: string, clientVersion?: number): { newVersion: number; accepted: boolean } => {
  const roomState = roomStates.get(roomId);
  if (roomState) {
    if (clientVersion !== undefined && clientVersion < roomState.contentVersion) {
      return { newVersion: roomState.contentVersion, accepted: false };
    }
    roomState.contentVersion += 1;
    roomState.currentContent = content;
    roomState.lastUpdate = Date.now();
    return { newVersion: roomState.contentVersion, accepted: true };
  }
  return { newVersion: 0, accepted: false };
};

export const getRoomContent = (roomId: string): string => {
  const roomState = roomStates.get(roomId);
  return roomState?.currentContent || '';
};

export const getRoomContentVersion = (roomId: string): { content: string; version: number } => {
  const roomState = roomStates.get(roomId);
  return {
    content: roomState?.currentContent || '',
    version: roomState?.contentVersion || 0,
  };
};

export const setUserSocketId = (roomId: string, userId: string, socketId: string): void => {
  const roomState = roomStates.get(roomId);
  if (roomState && roomState.members.has(userId)) {
    const member = roomState.members.get(userId)!;
    member.socketId = socketId;
    member.connected = true;
  }
};

export const removeUserFromRoom = (roomId: string, userId: string): void => {
  const roomState = roomStates.get(roomId);
  if (roomState) {
    roomState.members.delete(userId);
    if (roomState.members.size === 0) {
      roomStates.delete(roomId);
    }
  }
};

export const getRoomMembers = (roomId: string): User[] => {
  const roomState = roomStates.get(roomId);
  if (!roomState) return [];
  return Array.from(roomState.members.values()).map((m) => m.user);
};

export const getRoomState = (roomId: string): RoomState | undefined => {
  return roomStates.get(roomId);
};

export const getAllActiveRooms = (): string[] => {
  return Array.from(roomStates.keys());
};
