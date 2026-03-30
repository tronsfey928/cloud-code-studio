import api from './api';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    localStorage.setItem('token', data.token);
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    localStorage.setItem('token', data.token);
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  logout(): void {
    localStorage.removeItem('token');
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },
};
