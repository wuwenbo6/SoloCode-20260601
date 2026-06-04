import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { setToken as setAuthToken, removeToken, getToken } from '@/lib/axios';
import type { User, LoginRequest } from '../../shared/types';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const logoutStore = useAuthStore((state) => state.logout);
  const setTokenStore = useAuthStore((state) => state.setToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  const restoreAuth = useCallback(() => {
    const storedToken = getToken();
    if (storedToken && !token) {
      setAuthToken(storedToken);
    }
  }, [token]);

  const handleLogin = useCallback(async (
    credentials: LoginRequest
  ): Promise<{ user: User; token: string }> => {
    await login(credentials.email, credentials.password);
    const currentState = useAuthStore.getState();
    if (!currentState.user || !currentState.token) {
      throw new Error('登录失败');
    }
    return {
      user: currentState.user,
      token: currentState.token,
    };
  }, [login]);

  const handleLogout = useCallback((): void => {
    logoutStore();
    removeToken();
  }, [logoutStore]);

  const hasRole = useCallback((role: 'admin' | 'inventory'): boolean => {
    if (!user) return false;
    return user.role === role || user.role === 'admin';
  }, [user]);

  const isAdmin = useCallback((): boolean => {
    return hasRole('admin');
  }, [hasRole]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    hasRole,
    isAdmin,
    setAuth,
    clearAuth,
    restoreAuth,
  };
}
