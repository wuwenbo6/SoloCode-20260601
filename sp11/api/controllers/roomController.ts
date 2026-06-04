import { Request, Response, NextFunction } from 'express';
import * as roomService from '../services/roomService.js';
import { getIceServers } from '../config/index.js';
import { CreateRoomRequest, JoinRoomRequest } from '../types/index.js';

export const createRoom = async (
  req: Request<{}, {}, CreateRoomRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { nickname, roomName, password } = req.body;

    if (!nickname || nickname.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Nickname is required' });
      return;
    }

    const result = await roomService.createRoom(nickname.trim(), roomName, password);

    res.status(201).json({
      success: true,
      data: {
        roomId: result.roomId,
        user: result.user,
        iceServers: getIceServers(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRoom = async (
  req: Request<{ roomId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const room = await roomService.getRoom(roomId);

    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: { room },
    });
  } catch (error) {
    next(error);
  }
};

export const joinRoom = async (
  req: Request<{ roomId: string }, {}, JoinRoomRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { nickname, password } = req.body;

    if (!nickname || nickname.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Nickname is required' });
      return;
    }

    const result = await roomService.joinRoom(nickname.trim(), roomId, password);

    res.status(200).json({
      success: true,
      data: {
        room: result.room,
        user: result.user,
        currentContent: result.currentContent,
        members: result.members,
        iceServers: getIceServers(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Room not found') {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === 'Password required' || error.message === 'Invalid password') {
        res.status(401).json({ success: false, error: error.message });
      } else {
        next(error);
      }
    } else {
      next(error);
    }
  }
};

export const getIceServersConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: {
        iceServers: getIceServers(),
      },
    });
  } catch (error) {
    next(error);
  }
};
