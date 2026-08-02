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

export const AuthContext = createContext(/** @type {AuthContextValue | null} */(null));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Restore a persisted session on first mount so a refresh does not sign the
  // user out. Mock auth stores the user alongside the token.
  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
      let persistedUser = storage.get(STORAGE_KEYS.AUTH_USER);

      if (token) {
        try {
          // Attempt to fetch fresh user info from the backend
          const { default: httpClient } = await import('@api/httpClient');
          const { default: endpoints } = await import('@api/endpoints');
          const userInfoRes = await httpClient.get(endpoints.auth.userInfo);
          const fullInfo = userInfoRes.data;
          const info = fullInfo.userInformation || fullInfo;
          
          persistedUser = {
            ...persistedUser,
            id: info.id || persistedUser?.id,
            emp_id: info.empId || info.emp_id || info.employee_id || persistedUser?.emp_id,
            username: info.userName || info.username || persistedUser?.username,
            name: info.empName || info.name || info.full_name || persistedUser?.name,
            email: info.email || persistedUser?.email,
            role: info.roleName || info.role || persistedUser?.role,
            roleName: info.roleName || persistedUser?.roleName,
            isAdmin: info.isAdmin !== undefined ? info.isAdmin : persistedUser?.isAdmin,
            permissions: info.permissions || persistedUser?.permissions || [],
            mySubordinates: info.mySubordinates || persistedUser?.mySubordinates || [],
          };
          if (info.userName || info.username) {
            persistedUser.initials = (info.userName || info.username).substring(0, 2).toUpperCase();
          }
          storage.set(STORAGE_KEYS.AUTH_USER, persistedUser);
        } catch (error) {
          console.warn('Failed to fetch user-info on load', error);
        }
        
        if (isMounted && persistedUser) {
          if (storage.get(STORAGE_KEYS.AUTH_TOKEN)) {
            setUser(persistedUser);
          }
        }
      }

      if (isMounted) {
        setIsInitialising(false);
      }
    };
    
    initAuth();
    
    return () => { isMounted = false; };
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

