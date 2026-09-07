/** Namespaced localStorage / sessionStorage keys. */
const PREFIX = 'toss';

export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: `${PREFIX}.auth.token`,
  REFRESH_TOKEN: `${PREFIX}.auth.refresh_token`,
  AUTH_USER: `${PREFIX}.auth.user`,
  THEME: 'theme',
  SIDEBAR_COLLAPSED: `${PREFIX}.ui.sidebarCollapsed`,
});

/**
 * sessionStorage keys for the impersonation ("Access Account") flow — see
 * utils/impersonationStorage.js for why these live in a separate store
 * from STORAGE_KEYS above.
 */
export const IMPERSONATION_KEYS = Object.freeze({
  ACCESS_TOKEN: `${PREFIX}.impersonation.access_token`,
  REFRESH_TOKEN: `${PREFIX}.impersonation.refresh_token`,
  USER: `${PREFIX}.impersonation.user`,
});

export default STORAGE_KEYS;
