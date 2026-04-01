import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

interface ApiEnvelope {
  code: number;
  message: string;
  data: unknown;
}

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

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => {
    const body = response.data as ApiEnvelope | undefined;
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
          if (!refreshPromise) {
            refreshPromise = axios
              .post<ApiEnvelope>(
                `${api.defaults.baseURL}/auth/refresh-token`,
                { refreshToken },
              )
              .then(({ data }) => {
                const payload = (data as ApiEnvelope).data as {
                  token: string;
                  refreshToken: string;
                };
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
          // Refresh failed
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
