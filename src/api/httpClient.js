import axios from 'axios';
import { impersonationStorage } from '@utils/impersonationStorage';
import { IMPERSONATION_KEYS } from '@constants/storageKeys';
import endpoints from './endpoints';
import { csrf } from './csrf';
import { env } from '@config/env';

// Normal logins are a server-side session behind an HttpOnly cookie that
// script can never read — the browser attaches it to every request (hence
// withCredentials). There are no tokens to store or refresh: the backend
// extends the session on use and ends it on logout, idle timeout, its
// absolute timeout, or a newer login elsewhere.
const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const UNSAFE_METHODS = ['post', 'put', 'patch', 'delete'];

// Request Interceptor.
// An impersonation tab ("Access Account" / "View as Role") authenticates
// with its own per-tab access token (sessionStorage), sent as a Bearer
// header — the backend prefers it over the admin's real session cookie,
// which the browser still attaches. A caller that already set its own
// Authorization header (impersonationService's bootstrap calls, which
// carry a short-lived setup token) is never overridden.
httpClient.interceptors.request.use(
  (config) => {
    if (!config.headers['Authorization']) {
      const impersonationToken = impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN);
      if (impersonationToken) {
        config.headers['Authorization'] = `Bearer ${impersonationToken}`;
      }
      config._isImpersonation = Boolean(impersonationToken);
    }

    const token = csrf.get();
    if (token && UNSAFE_METHODS.includes((config.method || 'get').toLowerCase())) {
      config.headers['X-CSRFToken'] = token;
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

// Why the session ended, from the backend's 401 `code` — picks the toast.
const REASON_BY_CODE = {
  session_replaced: 'other_device',
  session_revoked: 'revoked',
  session_expired: 'timeout',
};

export function sessionEndReason(error) {
  return REASON_BY_CODE[error?.response?.data?.code] ?? 'timeout';
}

// A page in flight typically fires several requests at once, so a dead
// session produces a burst of 401s — without this guard each one would
// dispatch its own toast. Cleared by resetSessionEndGuard() on login.
let sessionEndNotified = false;

export function resetSessionEndGuard() {
  sessionEndNotified = false;
}

// The session ended by other means (idle timeout, another tab's logout) —
// suppress the toast its leftover in-flight requests would otherwise fire.
export function markSessionEnded() {
  sessionEndNotified = true;
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

const isCsrfFailure = (error) =>
  error.response?.status === 403 &&
  typeof error.response.data?.detail === 'string' &&
  error.response.data.detail.startsWith('CSRF Failed');

// Endpoints whose 401 means "bad credentials / no session yet", not "your
// session just died" — callers handle those themselves.
const SESSION_ENDPOINTS = [endpoints.auth.login, endpoints.auth.logout, endpoints.auth.session];

// Response Interceptor: session death, CSRF recovery, impersonation refresh.
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);
    const url = originalRequest.url || '';

    // The in-memory CSRF token can be missing or stale (e.g. rotated by a
    // login in another tab). Fetch a fresh one and retry once.
    if (isCsrfFailure(error) && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      try {
        const { data } = await httpClient.get(endpoints.auth.session);
        csrf.set(data.csrfToken);
        originalRequest.headers['X-CSRFToken'] = data.csrfToken;
        return httpClient(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Impersonation tokens have their own rotation endpoint and their own
    // storage (sessionStorage) — never fall through to the normal-session
    // logic below, which would misattribute an expired impersonation
    // session as the admin's real session ending.
    if (originalRequest._isImpersonation) {
      if (originalRequest._retry || url.includes(endpoints.impersonate.refresh)) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;

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

    if (!SESSION_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
      dispatchUnauthorized(sessionEndReason(error));
    }
    return Promise.reject(error);
  },
);

export default httpClient;
