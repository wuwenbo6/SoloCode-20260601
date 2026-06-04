import { Request, Response, NextFunction } from 'express';
import * as versionService from '../services/versionService.js';
import { SaveVersionRequest } from '../types/index.js';

export const saveVersion = async (
  req: Request<{ roomId: string }, {}, SaveVersionRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { content, message, autoSaved } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const version = await versionService.saveVersion(
      roomId,
      userId,
      content,
      autoSaved ?? false,
      message
    );

    res.status(201).json({
      success: true,
      data: { version },
    });
  } catch (error) {
    next(error);
  }
};

export const getVersions = async (
  req: Request<{ roomId: string }, {}, {}, { page?: string; limit?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);

    const result = await versionService.getVersions(roomId, page, limit);

    res.status(200).json({
      success: true,
      data: {
        versions: result.versions,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getVersion = async (
  req: Request<{ roomId: string; versionId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { versionId } = req.params;
    const version = await versionService.getVersion(versionId);

    if (!version) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: { version },
    });
  } catch (error) {
    next(error);
  }
};

export const restoreVersion = async (
  req: Request<{ roomId: string; versionId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId, versionId } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }

    const version = await versionService.restoreVersion(roomId, versionId, userId);

    res.status(200).json({
      success: true,
      data: { version },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Version not found') {
      res.status(404).json({ success: false, error: error.message });
    } else {
      next(error);
    }
  }
};
