import type { Response, NextFunction } from 'express';
import AuthService from '../services/AuthService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { ApiResponse, LoginResponse, User } from '../../shared/types.js';

export class AuthController {
  static async login(
    req: AuthRequest,
    res: Response<ApiResponse<LoginResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(
    req: AuthRequest,
    res: Response<ApiResponse<User>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录'
          }
        });
        return;
      }

      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
