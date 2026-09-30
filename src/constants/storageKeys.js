/** Namespaced localStorage / sessionStorage keys. */
const PREFIX = 'toss';

export const STORAGE_KEYS = Object.freeze({
  AUTH_USER: `${PREFIX}.auth.user`,
  // Timestamp of the last user interaction in ANY tab — shared so the idle
  // timeout only fires once every tab has been idle (see useIdleTimeout).
  LAST_ACTIVITY: `${PREFIX}.auth.last_activity`,
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
