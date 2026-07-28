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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

export const env = Object.freeze({
  apiBaseUrl,
  apiTimeout: toNumber(import.meta.env.VITE_API_TIMEOUT, 30_000),

  /**
   * The mock service layer is used whenever it is explicitly requested or when
   * no backend URL has been configured yet. Pointing VITE_API_BASE_URL at a real
   * backend and setting VITE_USE_MOCKS=false is the only change required to go live.
   */
  useMocks: toBoolean(import.meta.env.VITE_USE_MOCKS, true) || apiBaseUrl === '',
  mockDelay: toNumber(import.meta.env.VITE_MOCK_DELAY, 250),

  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
});

export default env;
