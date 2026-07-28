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
      
      user = {
        id: decoded.user_id || decoded.sub || 'unknown',
        username: username,
        name: decoded.name || decoded.full_name || username,
        email: decoded.email || '',
        role: decoded.role || 'User',
        initials: username.substring(0, 2).toUpperCase(),
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
    // Depending on the backend, verify the token or fetch user profile
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    const persistedUser = storage.get(STORAGE_KEYS.AUTH_USER);
    
    if (token && persistedUser) {
      try {
        // Verify token if verify endpoint exists
        await httpClient.post(endpoints.auth.verify, { token });
        return { user: persistedUser };
      } catch {
        // If verify fails, the interceptor might try to refresh it.
        // If it still fails, the session is dead.
        throw new Error('Session invalid');
      }
    }
    
    throw new Error('No session found');
  },
};

export default authService;
