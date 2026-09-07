/**
 * sessionStorage-backed counterpart to `storage` (utils/storage.js), used
 * exclusively for impersonation ("Access Account") state.
 *
 * Why sessionStorage: it is scoped per tab, whereas localStorage is shared
 * across every tab on the same origin. The admin's real session lives in
 * localStorage; if the impersonation tokens went there too, the admin's
 * original tab and the "view as" tab would collide (same keys, same
 * storage). Keeping impersonation state in sessionStorage means opening
 * "Access Account" in a new tab starts with an empty slate here, and
 * nothing written in that tab ever reaches the admin's original tab.
 */

const canUseStorage = () => {
  try {
    const probe = '__toss_impersonation_probe__';
    window.sessionStorage.setItem(probe, probe);
    window.sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

const available = typeof window !== 'undefined' && canUseStorage();

export const impersonationStorage = {
  get(key, fallback = null) {
    if (!available) return fallback;
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    if (!available) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded — nothing useful to do */
    }
  },

  remove(key) {
    if (!available) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export default impersonationStorage;
