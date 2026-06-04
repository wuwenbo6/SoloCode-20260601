import { Request, Response, NextFunction } from 'express';
import { checkDBConnection } from '../config/database';
import type { ApiResponse } from '../../shared/types';

export const requireDB = (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
  if (!checkDBConnection()) {
    return res.status(503).json({
      success: false,
      message: '数据库服务暂不可用，请稍后重试',
      data: null
    });
  }
  next();
};

export const optionalDB = (req: Request, res: Response, next: NextFunction) => {
  res.locals.dbConnected = checkDBConnection();
  next();
};
