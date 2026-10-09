/**
 * Single, validated source of truth for build-time environment configuration.
 * Nothing outside this module should read `import.meta.env` directly.
 */

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// public/config.js (editable in the deployed build) takes precedence over the build-time value.
const runtimeApiBaseUrl = String(window.__TOSS_CONFIG__?.API_BASE_URL ?? '').trim();
const configuredApiBaseUrl = (runtimeApiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api').trim();

// Tolerate a host written without a scheme ("10.0.0.5:8003/api"): treat it as an absolute URL
// on the page's own protocol instead of a path relative to the current page.
const rawApiBaseUrl = /^[\w.-]+:\d+(\/|$)|^\d{1,3}(\.\d{1,3}){3}(\/|$)/.test(configuredApiBaseUrl)
  ? `${window.location.protocol}//${configuredApiBaseUrl}`
  : configuredApiBaseUrl;

// Ensure consistency by stripping trailing slashes so manual string concatenation doesn't break.
const apiBaseUrl = rawApiBaseUrl ? rawApiBaseUrl.replace(/\/+$/, '') : '';

// Public path the app is served from (e.g. "/tossv2/"). Always has a leading and trailing slash.
// Vite inlines BASE_URL at build time; `npm run set-base` rewrites it in dist/ afterwards.
const basePath = `/${(import.meta.env.BASE_URL || '/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');

// WebSocket origin (no trailing slash, no "/api"): the backend's origin when the API URL is
// absolute, otherwise the host serving the app (nginx proxies /ws there).
// An explicit WS_BASE_URL in config.js wins ("ws://host:port/ws" - the trailing "/ws" is optional).
const runtimeWsBaseUrl = String(window.__TOSS_CONFIG__?.WS_BASE_URL ?? '').trim();
const wsBaseUrl = runtimeWsBaseUrl
  ? runtimeWsBaseUrl.replace(/\/+$/, '').replace(/\/ws$/i, '')
  : (/^https?:\/\//i.test(apiBaseUrl)
      ? apiBaseUrl.replace(/\/api$/, '')
      : `${window.location.origin}`
    ).replace(/^http/i, 'ws');

/** Prefix an app-relative path ("/docs/a.png", "/") with the deployment base path. */
export const withBase = (path = '') => `${basePath}${String(path).replace(/^\/+/, '')}`;

export const env = Object.freeze({
  basePath,
  wsBaseUrl,
  apiBaseUrl,
  apiTimeout: toNumber(import.meta.env.VITE_API_TIMEOUT, 30_000),

  /**
   * The mock service layer is used whenever it is explicitly requested or when
   * no backend URL has been configured yet. Pointing VITE_API_BASE_URL at a real
   * backend and setting VITE_USE_MOCKS=false is the only change required to go live.
   */
  useMocks: toBoolean(import.meta.env.VITE_USE_MOCKS, true) || rawApiBaseUrl === '',
  mockDelay: toNumber(import.meta.env.VITE_MOCK_DELAY, 250),

  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
});

export default env;
