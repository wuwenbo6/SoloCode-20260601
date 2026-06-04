import UserModel from '../models/User.js';
import { comparePassword } from '../lib/password.js';
import { generateToken } from '../lib/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import type { LoginRequest, LoginResponse, User } from '../../shared/types.js';
import logger from '../lib/logger.js';

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { email, password } = credentials;

    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(password, (user as unknown as { password: string }).password);
    if (!isPasswordValid) {
      throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
    }

    const userData: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = generateToken(userData);

    logger.info(`User logged in: ${email}`);

    return {
      token,
      user: userData
    };
  }

  static async getUserById(userId: string): Promise<User | null> {
    const user = await UserModel.findById(userId);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}

export default AuthService;
