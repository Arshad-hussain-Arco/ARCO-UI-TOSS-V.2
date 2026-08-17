import axios from 'axios';
import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';
import endpoints from './endpoints';

// Create base instance
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT, 10) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Queue for pending requests during refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach access token
httpClient.interceptors.request.use(
  (config) => {
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401s and token refresh
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid retry loops: if we hit a 401 and we are not already retrying
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes(endpoints.auth.login) &&
      !originalRequest.url.includes(endpoints.auth.refresh)
    ) {
      originalRequest._retry = true;

      const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        // Force logout via event if no refresh token exists
        window.dispatchEvent(new Event('auth-unauthorized'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, add to queue to retry later
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return httpClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        // Request a new access token
        const response = await axios.post(
          `${httpClient.defaults.baseURL}${endpoints.auth.refresh}`,
          {
            refresh: refreshToken,
          },
        );

        const newAccessToken = response.data.access;
        // Optionally update refresh token if the backend rotates it
        const newRefreshToken = response.data.refresh || refreshToken;

        storage.set(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
        storage.set(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

        httpClient.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;

        processQueue(null, newAccessToken);
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Dispatch global event so context can clear state
        window.dispatchEvent(new Event('auth-unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default httpClient;
