import axios from 'axios';
import { storage } from '@utils/storage';
import { impersonationStorage } from '@utils/impersonationStorage';
import { STORAGE_KEYS, IMPERSONATION_KEYS } from '@constants/storageKeys';
import endpoints from './endpoints';
import { env } from '@config/env';

// Create base instance
const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
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

// Request Interceptor: Attach access token.
// An impersonation access token (sessionStorage, per-tab) always takes
// priority over the normal login token (localStorage, shared across every
// tab on this origin) — this is what makes an "Access Account" tab render
// as the target employee even though the admin's own real token is sitting
// right there in the same localStorage. A caller that already set its own
// Authorization header (impersonationService's bootstrap calls, which carry
// a short-lived setup token) is never overridden — see the `if` guard below.
httpClient.interceptors.request.use(
  (config) => {
    if (!config.headers['Authorization']) {
      const impersonationToken = impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN);
      const token = impersonationToken || storage.get(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      config._isImpersonation = Boolean(impersonationToken);
    }

    // Let the browser set multipart/form-data + boundary itself.
    // The instance-level 'application/json' default would otherwise
    // override this for every FormData request (file uploads).
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Distinguishes *why* the session ended so the UI can show the right toast.
// DRF only serializes AuthenticationFailed's plain-string `detail` into the
// response body — the `code=` kwarg passed on the backend never reaches the
// client as JSON — so detection has to match on that detail text, not a code.
// - 'other_device': the account logged in elsewhere (single-session policy) —
//   CustomJWTAuthentication's "...logged in from another device" detail on
//   the access token, or the refresh token being blacklisted by that login.
// - 'timeout': the refresh token itself simply expired/is invalid — no
//   competing login involved.
// A page in flight typically fires several requests at once (plus the
// notifications WS/interval), so a dead session produces a burst of 401s —
// without this guard each one would dispatch its own toast. Cleared by
// resetSessionEndGuard() on the next successful login.
let sessionEndNotified = false;

export function resetSessionEndGuard() {
  sessionEndNotified = false;
}

function dispatchUnauthorized(reason) {
  if (sessionEndNotified) return;
  sessionEndNotified = true;
  window.dispatchEvent(new CustomEvent('auth-unauthorized', { detail: { reason } }));
}

// Same one-shot-per-death guard as dispatchUnauthorized above, but for the
// impersonation token family — kept entirely separate so a dead
// impersonation session never fires the normal-session toast/clear (and
// vice versa). Cleared whenever a fresh impersonation session starts.
let impersonationEndNotified = false;

export function resetImpersonationEndGuard() {
  impersonationEndNotified = false;
}

function dispatchImpersonationEnded(reason) {
  if (impersonationEndNotified) return;
  impersonationEndNotified = true;
  window.dispatchEvent(new CustomEvent('impersonation-ended', { detail: { reason } }));
}

function detailIncludes(errorResponseData, substring) {
  const detail = errorResponseData?.detail;
  return typeof detail === 'string' && detail.toLowerCase().includes(substring);
}

function reasonFromRefreshError(refreshError) {
  return detailIncludes(refreshError.response?.data, 'blacklisted') ? 'other_device' : 'timeout';
}

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
      !originalRequest.url.includes(endpoints.auth.refresh) &&
      !originalRequest.url.includes(endpoints.impersonate.refresh)
    ) {
      originalRequest._retry = true;

      // Impersonation tokens have their own rotation endpoint and their own
      // storage (sessionStorage) — never fall through to the normal-session
      // logic below, which reads/writes localStorage and would otherwise
      // misattribute an expired impersonation session as "logged in from
      // another device" on the admin's real account.
      if (originalRequest._isImpersonation) {
        const impersonationRefreshToken = impersonationStorage.get(IMPERSONATION_KEYS.REFRESH_TOKEN);

        if (!impersonationRefreshToken) {
          dispatchImpersonationEnded('ended');
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(
            `${httpClient.defaults.baseURL}${endpoints.impersonate.refresh}`,
            { refresh: impersonationRefreshToken },
          );

          impersonationStorage.set(IMPERSONATION_KEYS.ACCESS_TOKEN, response.data.access);
          impersonationStorage.set(IMPERSONATION_KEYS.REFRESH_TOKEN, response.data.refresh);

          originalRequest.headers['Authorization'] = 'Bearer ' + response.data.access;
          return httpClient(originalRequest);
        } catch {
          dispatchImpersonationEnded('expired');
          return Promise.reject(error);
        }
      }

      // The backend already knows the access token was invalidated by a login
      // elsewhere (auth_version mismatch) — no point attempting a refresh,
      // since that same login already blacklisted the refresh token too.
      if (detailIncludes(error.response?.data, 'another device')) {
        dispatchUnauthorized('other_device');
        return Promise.reject(error);
      }

      const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        // Force logout via event if no refresh token exists
        dispatchUnauthorized('timeout');
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
        dispatchUnauthorized(reasonFromRefreshError(refreshError));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default httpClient;
