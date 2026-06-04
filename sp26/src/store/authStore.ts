import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../../shared/types';
import type { AuthState, AuthActions } from '@/types';

interface AuthStore extends AuthState, AuthActions {}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { authService } = await import('@/services/authService');
          const response = await authService.login({ email, password });
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set(initialState);
      },

      setToken: (token: string) => {
        localStorage.setItem('auth_token', token);
        set({ token });
      },

      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set(initialState);
      },

      setAuth: (user: User, token: string) => {
        localStorage.setItem('auth_token', token);
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
