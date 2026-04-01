import api from './api';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  /** Exchange a refresh token for a new access + refresh token pair. */
  async refresh(): Promise<{ token: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const { data } = await api.post<{ token: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken }
    );
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Best-effort server-side revocation; clear local state regardless
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },
};
