import { api } from '@/lib/axios';
import type { LoginRequest, LoginResponse, ApiResponse, User } from '../../shared/types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    const data = (response.data as ApiResponse<LoginResponse>).data;
    if (!data) throw new Error('登录失败');
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post<ApiResponse<void>>('/auth/logout');
    } catch {
      // Ignore logout errors
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    const data = (response.data as ApiResponse<User>).data;
    if (!data) throw new Error('获取用户信息失败');
    return data;
  },

  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.put<ApiResponse<void>>('/auth/password', {
      oldPassword,
      newPassword,
    });
  },
};
