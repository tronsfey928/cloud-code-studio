import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // Unwrap backend envelope: { success: true, workspaces: [...] } → workspaces: [...]
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data) {
      const { success, ...rest } = data;
      // If there's exactly one key left, return its value directly
      const keys = Object.keys(rest);
      if (keys.length === 1) {
        response.data = rest[keys[0]];
      } else {
        response.data = rest;
      }
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Hard redirect is intentional here: the interceptor runs outside React's
      // component tree and cannot use React Router's navigate. This ensures a
      // clean slate on session expiry without circular imports.
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
