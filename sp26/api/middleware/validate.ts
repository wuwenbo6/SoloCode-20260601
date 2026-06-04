import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import type { AuthRequest } from './auth.js';

type ValidateTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidateTarget = 'body') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const data = target === 'body' 
        ? req.body 
        : target === 'query' 
          ? req.query 
          : req.params;
      
      const validated = schema.parse(data);
      
      if (target === 'body') {
        req.body = validated;
      } else if (target === 'query') {
        req.query = validated as any;
      } else {
        req.params = validated as Record<string, string>;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: errors
          }
        });
        return;
      }

      next(error);
    }
  };
};
