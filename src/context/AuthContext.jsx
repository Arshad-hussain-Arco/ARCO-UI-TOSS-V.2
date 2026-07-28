import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';
import { authService } from '@services/authService';

/**
 * @typedef  {Object} AuthContextValue
 * @property {import('@services/authService').AuthUser | null} user
 * @property {boolean} isAuthenticated
 * @property {boolean} isInitialising  True until the persisted session is restored.
 * @property {boolean} isSubmitting    True while a sign-in request is in flight.
 * @property {string | null} error
 * @property {(credentials: { username: string, password: string }) => Promise<void>} login
 * @property {() => Promise<void>} logout
 * @property {(permission: string) => boolean} hasPermission
 * @property {() => void} clearError
 */

export const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Restore a persisted session on first mount so a refresh does not sign the
  // user out. Mock auth stores the user alongside the token.
  useEffect(() => {
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    const persistedUser = storage.get(STORAGE_KEYS.AUTH_USER);

    if (token && persistedUser) {
      setUser(persistedUser);
    }

    setIsInitialising(false);
  }, []);

  const clearSession = useCallback(() => {
    storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    storage.remove(STORAGE_KEYS.AUTH_USER);
    setUser(null);
  }, []);

  // Listen for global unauthorized events (e.g. from axios interceptor when refresh fails)
  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { token, refreshToken, user: authenticatedUser } = await authService.login(credentials);

      storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
      if (refreshToken) {
        storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      storage.set(STORAGE_KEYS.AUTH_USER, authenticatedUser);
      setUser(authenticatedUser);
    } catch (caught) {
      setError(caught.message);
      throw caught;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Signing out locally must succeed even if the server call does not.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitialising,
      isSubmitting,
      error,
      login,
      logout,
      hasPermission,
      clearError,
    }),
    [user, isInitialising, isSubmitting, error, login, logout, hasPermission, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
