import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config/index.js';
import * as roomService from '../services/roomService.js';
import { SignalingMessage, User } from '../types/index.js';

const userSocketMap = new Map<string, string>();
const socketUserMap = new Map<string, { userId: string; roomId: string }>();

export const setupSignalingServer = (httpServer: HTTPServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', (data: { roomId: string; userId: string; user: User }) => {
      const { roomId, userId, user } = data;
      console.log(`User ${userId} joining room ${roomId}`);

      socket.join(roomId);

      userSocketMap.set(userId, socket.id);
      socketUserMap.set(socket.id, { userId, roomId });

      roomService.setUserSocketId(roomId, userId, socket.id);

      const members = roomService.getRoomMembers(roomId);
      const { content: currentContent, version: contentVersion } = roomService.getRoomContentVersion(roomId);

      socket.to(roomId).emit('user-joined', {
        user,
        members,
      });

      socket.emit('joined', {
        members,
        socketId: socket.id,
        currentContent,
        contentVersion,
      });
    });

    socket.on('signal', (message: SignalingMessage) => {
      const { to, type, data, from, roomId } = message;

      if (to) {
        const targetSocketId = userSocketMap.get(to);
        if (targetSocketId) {
          socket.to(targetSocketId).emit('signal', {
            type,
            from,
            data,
            roomId,
            timestamp: Date.now(),
          });
        }
      } else {
        socket.to(roomId).emit('signal', {
          type,
          from,
          data,
          roomId,
          timestamp: Date.now(),
        });
      }
    });

    socket.on('cursor-update', (data: { roomId: string; userId: string; cursor: any }) => {
      socket.to(data.roomId).emit('cursor-update', {
        userId: data.userId,
        cursor: data.cursor,
      });
    });

    socket.on('content-sync', (data: { roomId: string; content: string; userId: string; version?: number }) => {
      const { newVersion, accepted } = roomService.updateRoomContent(data.roomId, data.content, data.version);
      
      if (accepted) {
        socket.to(data.roomId).emit('content-sync', {
          content: data.content,
          userId: data.userId,
          version: newVersion,
        });
      }
      
      socket.emit('content-ack', {
        version: newVersion,
        accepted,
      });
    });

    socket.on('content-request', (data: { roomId: string; from: string; to: string }) => {
      const targetSocketId = userSocketMap.get(data.to);
      if (targetSocketId) {
        socket.to(targetSocketId).emit('content-request', {
          roomId: data.roomId,
          from: data.from,
        });
      }
    });

    socket.on('content-response', (data: { roomId: string; to: string; content: string }) => {
      const targetSocketId = userSocketMap.get(data.to);
      if (targetSocketId) {
        socket.to(targetSocketId).emit('content-response', {
          content: data.content,
          roomId: data.roomId,
        });
      }
    });

    socket.on('mention', (data: { roomId: string; toUserId: string; fromUser: User; message: string; position: any }) => {
      const targetSocketId = userSocketMap.get(data.toUserId);
      if (targetSocketId) {
        socket.to(targetSocketId).emit('mention', {
          fromUser: data.fromUser,
          message: data.message,
          position: data.position,
          timestamp: Date.now(),
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      const userInfo = socketUserMap.get(socket.id);
      if (userInfo) {
        const { userId, roomId } = userInfo;

        roomService.removeUserFromRoom(roomId, userId);
        userSocketMap.delete(userId);
        socketUserMap.delete(socket.id);

        const members = roomService.getRoomMembers(roomId);
        socket.to(roomId).emit('user-left', {
          userId,
          members,
        });
      }
    });
  });

  return io;
};

export const getIo = (): Server | null => {
  return null;
};
