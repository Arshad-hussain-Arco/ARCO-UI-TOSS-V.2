/** Namespaced localStorage / sessionStorage keys. */
const PREFIX = 'toss';

export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: `${PREFIX}.auth.token`,
  REFRESH_TOKEN: `${PREFIX}.auth.refresh_token`,
  AUTH_USER: `${PREFIX}.auth.user`,
  THEME: 'theme',
  SIDEBAR_COLLAPSED: `${PREFIX}.ui.sidebarCollapsed`,
});

export default STORAGE_KEYS;
