import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';
import { jwtDecode } from 'jwt-decode';

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
 * @typedef  {Object} LoginResult
 * @property {string}   token
 * @property {string}   refreshToken
 * @property {AuthUser} user
 */

export const authService = {
  /** @returns {Promise<LoginResult>} */
  login: async (credentials) => {
    let response;
    try {
      // Call the real backend login endpoint
      response = await httpClient.post(endpoints.auth.login, credentials);
    } catch (error) {
      console.error('Login error details:', error);
      if (!error.response) {
        throw new Error('Unable to connect to server.');
      }
      if (error.response.status === 401 || error.response.status === 403) {
        throw new Error('Invalid username or password.');
      }
      throw new Error('An unexpected error occurred during login.');
    }

    // Most JWT implementations return { access, refresh }
    const token = response.data.access;
    const refreshToken = response.data.refresh;

    let user = response.data.user;

    // If the backend doesn't return user info directly, decode the JWT
    if (!user && token) {
      const decoded = jwtDecode(token);

      const username = decoded.username || credentials.username;

      // We no longer block the login flow to fetch /user-info or photos.
      // We extract the absolute minimum required to render the dashboard from the JWT,
      // and let AuthContext.jsx's initial mount trigger an async refreshUser() to
      // load the full profile, roles, and avatar in the background without blocking the user.
      user = {
        id: decoded.user_id || decoded.sub || 'unknown',
        emp_id: decoded.emp_id || decoded.employee_id || 1,
        username: username,
        name: decoded.name || decoded.full_name || username,
        email: decoded.email || '',
        role: decoded.role || 'User',
        isAdmin: decoded.isAdmin,
        initials: (username || '').substring(0, 2).toUpperCase(),
        permissions: decoded.permissions || [],
      };
    }

    return { token, refreshToken, user };
  },

  logout: async () => {
    try {
      const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        // Attempt to notify the backend to blacklist the token
        await httpClient.post(endpoints.auth.logout, { refresh: refreshToken });
      }
    } catch (e) {
      // It's okay if logout fails (e.g. token already expired), we still clear local state
      console.warn('Backend logout failed or not supported:', e.message);
    } finally {
      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
      storage.remove(STORAGE_KEYS.AUTH_USER);
    }
  },

  getSession: async () => {
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    const persistedUser = storage.get(STORAGE_KEYS.AUTH_USER);

    if (token && persistedUser) {
      try {
        const decoded = jwtDecode(token);
        // Check if token is expired (exp is in seconds)
        if (decoded.exp && decoded.exp * 1000 > Date.now()) {
          return { user: persistedUser };
        } else {
          // Token is expired, try to rely on interceptor logic or just throw
          throw new Error('Token expired');
        }
      } catch {
        throw new Error('Session invalid');
      }
    }

    throw new Error('No session found');
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