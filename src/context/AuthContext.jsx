import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { storage } from '@utils/storage';
import { resolveAvatarDataUri } from '@utils/photo';
import { STORAGE_KEYS } from '@constants/storageKeys';
import { authService } from '@services/authService';
import { pushNotificationService } from '@services/pushNotificationService';
import { useTheme } from '@hooks/useTheme';

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
 * @property {() => Promise<void>} refreshUser  Re-fetches role/permissions without a full reload.
 * @property {() => void} clearError
 */

export const AuthContext = createContext(/** @type {AuthContextValue | null} */(null));

// Background safety net only — the primary refresh trigger is tab
// focus/visibility (see below), which is when a user actually notices a
// role change. This interval just covers a tab left open and unfocused
// for a long stretch. Kept long since this fires for every active session.
const USER_INFO_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { setTheme } = useTheme();

  // Pulls fresh role/permission/subordinate data from /auth/user-info/ and
  // merges it into whatever's currently persisted, without discarding any
  // locally-known fields the endpoint doesn't return. Used on first mount,
  // on an interval, and whenever the tab regains focus/visibility — this is
  // the single place that logic lives, so "log out and back in" is never
  // required just to pick up a role/permission change.
  //
  // The photo re-fetch is opt-in (`includePhoto`) and only used on the
  // initial mount — a profile photo changes far less often than a role
  // does, so re-fetching it on every periodic/focus refresh (across every
  // active session, at scale) would be pure waste.
  const refreshUser = useCallback(async ({ includePhoto = false } = {}) => {
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    let persistedUser = storage.get(STORAGE_KEYS.AUTH_USER);

    try {
      const { default: httpClient } = await import('@api/httpClient');
      const { default: endpoints } = await import('@api/endpoints');
      const userInfoRes = await httpClient.get(endpoints.auth.userInfo);
      const fullInfo = userInfoRes.data;
      
      console.log('USER DATA RESPONSE FROM BACKEND:', fullInfo);

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
        roleId: info.roleId !== undefined ? info.roleId : persistedUser?.roleId,
        isAdmin: info.isAdmin !== undefined ? info.isAdmin : persistedUser?.isAdmin,
        permissions: info.permissions || persistedUser?.permissions || [],
        sidebarNavOrder: info.sidebarNavOrder || persistedUser?.sidebarNavOrder || {},
        mySubordinates: info.mySubordinates || persistedUser?.mySubordinates || [],
        designation: info.designation || persistedUser?.designation,
        designationName: info.designationName || persistedUser?.designationName,
        teamName: info.teamName || persistedUser?.teamName,
        reportingManager: info.reportingManager || persistedUser?.reportingManager,
        gender: info.gender || persistedUser?.gender,
        work_location: info.work_location || persistedUser?.work_location,
        landline: info.landline || persistedUser?.landline,
        pcAvailable:
          info.physicalPcAvailable !== undefined
            ? info.physicalPcAvailable
            : persistedUser?.pcAvailable,
        mobile: info.mobile || persistedUser?.mobile,
        computerName: info.computerName || persistedUser?.computerName,
        computerLocation: info.computerLocation || persistedUser?.computerLocation,
        locationRef: info.computerLocationRef || persistedUser?.locationRef,
        doj: info.dateOfJoining || persistedUser?.doj,
        theme: info.theme || persistedUser?.theme,
      };
      if (info.userName || info.username) {
        persistedUser.initials = (info.userName || info.username).substring(0, 2).toUpperCase();
      }


      if (includePhoto && persistedUser.emp_id) {
        const avatar = await resolveAvatarDataUri(persistedUser.emp_id);
        if (avatar) persistedUser.avatar = avatar;
      }

      storage.set(STORAGE_KEYS.AUTH_USER, persistedUser);
    } catch (err) {
      console.warn('Failed to refresh user-info', err);
      // Keep whatever was already persisted/rendered — a transient network
      // failure here must not sign the user out or blank their permissions.
    }

    if (persistedUser && storage.get(STORAGE_KEYS.AUTH_TOKEN)) {
      setUser((prevUser) => {
        const finalUser = { ...persistedUser };
        // If storage failed to save the avatar (e.g. due to quota), preserve it from React state
        if (!finalUser.avatar && prevUser?.avatar) {
          finalUser.avatar = prevUser.avatar;
          // Also try to persist it back just in case
          storage.set(STORAGE_KEYS.AUTH_USER, finalUser);
        }
        return finalUser;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore a persisted session on first mount so a refresh does not sign the
  // user out, and pull fresh role/permission data at the same time.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      await refreshUser({ includePhoto: true });
      if (isMounted) {
        setIsInitialising(false);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep permissions from going stale for a long-lived session: re-pull on
  // an interval, and whenever the tab regains focus/visibility (the moment
  // a user is most likely to notice a role change an admin just made).
  useEffect(() => {
    if (!user) return undefined;

    // Register and subscribe for push notifications
    pushNotificationService.registerAndSubscribe();

    const interval = setInterval(refreshUser, USER_INFO_REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, refreshUser]);

  const clearSession = useCallback(() => {
    storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    storage.remove(STORAGE_KEYS.AUTH_USER);

    // Clear all temporary UI states (tabs, views) from localStorage so they reset on next login
    const keysToKeep = [STORAGE_KEYS.THEME, STORAGE_KEYS.SIDEBAR_COLLAPSED];
    const allKeys = Object.keys(window.localStorage);

    allKeys.forEach((key) => {
      if (!keysToKeep.includes(key)) {
        window.localStorage.removeItem(key);
      }
    });

    // Also clear sessionStorage just in case future tabs use it
    window.sessionStorage.clear();

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
      // Persist the bare JWT-decoded user so refreshUser has a base to merge
      // onto, but deliberately do NOT setUser() with it here: isAuthenticated
      // (Boolean(user)) would flip true immediately, and PublicRoute reacts
      // to that by navigating away right then — mid-flight, with placeholder
      // role/isAdmin/permissions — racing ahead of the refreshUser() call
      // below and landing on a 403 or the wrong sidebar. setUser only happens
      // once, inside refreshUser, once real role/permission data is in hand.
      storage.set(STORAGE_KEYS.AUTH_USER, authenticatedUser);

      if (authenticatedUser?.theme) {
        setTheme(authenticatedUser.theme);
      }

      // /auth/user-info/ is intentionally lightweight (no photo/config
      // payload) so awaiting it here doesn't meaningfully delay login.
      await refreshUser({ includePhoto: true });
    } catch (caught) {
      setError(caught.message);
      throw caught;
    } finally {
      setIsSubmitting(false);
    }
  }, [setTheme, refreshUser]);

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
      refreshUser,
      clearError,
    }),
    [user, isInitialising, isSubmitting, error, login, logout, hasPermission, refreshUser, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
