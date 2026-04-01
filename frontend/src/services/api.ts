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

/** Prevent multiple concurrent refresh attempts. */
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => {
    // Unwrap backend envelope: { success: true, workspaces: [...] } → workspaces: [...]
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data) {
      const { success, ...rest } = data;
      void success; // consumed but unused after destructure
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
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Attempt a silent token refresh on 401, except for auth endpoints themselves
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.startsWith('/auth/')
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          // Coalesce concurrent refresh calls
          if (!refreshPromise) {
            refreshPromise = axios
              .post<{ token: string; refreshToken: string }>(
                `${api.defaults.baseURL}/auth/refresh`,
                { refreshToken }
              )
              .then(({ data }) => {
                // The /auth/refresh response is wrapped in the backend envelope
                const payload = (data as unknown as { success: boolean; token: string; refreshToken: string });
                localStorage.setItem('token', payload.token);
                localStorage.setItem('refreshToken', payload.refreshToken);
                return payload.token;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }

          const newToken = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — fall through to logout
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      // Avoid redirect loop: only redirect if not already on the login page.
      // The interceptor runs outside React's component tree and cannot use
      // React Router's navigate, so a hard redirect is intentional here.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
