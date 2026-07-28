/**
 * localStorage wrapper that never throws — private browsing modes and disabled
 * storage degrade to a no-op instead of crashing the render tree.
 */

const canUseStorage = () => {
  try {
    const probe = '__toss_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

const available = typeof window !== 'undefined' && canUseStorage();

export const storage = {
  get(key, fallback = null) {
    if (!available) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /** Reads a value that was stored as a plain (non-JSON) string. */
  getRaw(key, fallback = null) {
    if (!available) return fallback;
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    if (!available) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded — nothing useful to do */
    }
  },

  setRaw(key, value) {
    if (!available) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* quota exceeded */
    }
  },

  remove(key) {
    if (!available) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export default storage;
