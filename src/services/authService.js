import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { csrf } from '@api/csrf';

/**
 * @typedef  {Object} AuthUser
 * @property {string}   id
 * @property {string}   username
 * @property {string}   name
 * @property {string}   email
 * @property {string}   role
 * @property {string}   initials
 * @property {string[]} permissions
 *
 * @typedef  {Object} SessionInfo
 * @property {boolean} authenticated
 * @property {number}  idleTimeoutSeconds
 */

export const authService = {
  /**
   * Starts a server-side session — the backend sets the HttpOnly session
   * cookie; nothing token-like ever reaches script. The profile itself is
   * loaded afterwards from /auth/user-info/ (AuthContext.refreshUser).
   * @returns {Promise<SessionInfo>}
   */
  login: async (credentials) => {
    let response;
    try {
      response = await httpClient.post(endpoints.auth.login, credentials);
    } catch (error) {
      console.error('Login error details:', error);
      if (!error.response) {
        throw new Error('Unable to connect to server.');
      }
      if (error.response.status === 401 || error.response.status === 403) {
        throw new Error('Invalid username or password.');
      }
      if (error.response.status === 429) {
        throw new Error('Too many login attempts. Please wait a minute and try again.');
      }
      throw new Error('An unexpected error occurred during login.');
    }

    csrf.set(response.data.csrfToken);
    return { authenticated: true, idleTimeoutSeconds: response.data.idleTimeoutSeconds };
  },

  /** Ends the session server-side and clears the cookie. Never throws. */
  logout: async () => {
    try {
      await httpClient.post(endpoints.auth.logout);
    } catch (e) {
      console.warn('Backend logout failed:', e.message);
    }
  },

  /**
   * Is this browser logged in? Also extends the session and refreshes the
   * in-memory CSRF token. A dead session rejects with the backend's 401
   * (`response.data.code` says why — see httpClient.sessionEndReason).
   * @returns {Promise<SessionInfo>}
   */
  getSession: async () => {
    const { data } = await httpClient.get(endpoints.auth.session);
    csrf.set(data.csrfToken);
    return { authenticated: Boolean(data.authenticated), idleTimeoutSeconds: data.idleTimeoutSeconds };
  },

  updateUserInfo: async (payload) => {
    const response = await httpClient.post(endpoints.auth.updateUserInfo, payload);
    return response.data;
  },

  updateTheme: async (theme) => {
    const response = await httpClient.post(endpoints.auth.updateTheme, { theme });
    return response.data;
  },

  // Sidebar Nav Order (Preferences > Sidebar Layout) — the caller's own
  // personal override, distinct from roleService's per-role admin default.
  getMySidebarNavOrder: async () => {
    const response = await httpClient.get(endpoints.auth.mySidebarNavOrder);
    return response.data;
  },

  updateMySidebarNavOrder: async (payload) => {
    const response = await httpClient.put(endpoints.auth.mySidebarNavOrder, payload);
    return response.data;
  },

  adminUpdatePassword: async (payload) => {
    const response = await httpClient.post(endpoints.auth.adminUpdatePassword, payload);
    return response.data;
  },

  changePassword: async (payload) => {
    const response = await httpClient.post(endpoints.auth.updatePassword, payload);
    return response.data;
  },
};

export default authService;
