import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import type { LoginPayload, RegisterPayload } from '@/types';

export function useAuth() {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, login, logout: storeLogout, setUser } = useAuthStore();

  const handleLogin = useCallback(
    async (payload: LoginPayload) => {
      const { user: u, token: t } = await authService.login(payload);
      login(u, t);
      navigate('/dashboard');
    },
    [login, navigate],
  );

  const handleRegister = useCallback(
    async (payload: RegisterPayload) => {
      const { user: u, token: t } = await authService.register(payload);
      login(u, t);
      navigate('/dashboard');
    },
    [login, navigate],
  );

  const handleLogout = useCallback(async () => {
    await authService.logout();
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await authService.getMe();
      setUser(u);
    } catch {
      handleLogout();
    }
  }, [setUser, handleLogout]);

  return {
    user,
    token,
    isAuthenticated,
    login: handleLogin,
    logout: handleLogout,
    register: handleRegister,
    refreshUser,
  };
}
