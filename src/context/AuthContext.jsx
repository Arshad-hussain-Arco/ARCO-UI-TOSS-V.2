import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { storage } from '@utils/storage';
import { impersonationStorage } from '@utils/impersonationStorage';
import { resolveAvatarDataUri } from '@utils/photo';
import { STORAGE_KEYS, IMPERSONATION_KEYS } from '@constants/storageKeys';
import { authService } from '@services/authService';
import { impersonationService } from '@services/impersonationService';
import { pushNotificationService } from '@services/pushNotificationService';
import { useToast } from '@hooks/useToast';
import { useIdleTimeout } from '@hooks/useIdleTimeout';
import { IdleWarningModal } from '@components/feedback/IdleWarning/IdleWarningModal';
import { markSessionEnded, resetSessionEndGuard, sessionEndReason } from '@api/httpClient';

const SESSION_END_MESSAGES = {
  other_device: 'Session Ended. Logged in through another browser/device.',
  timeout: 'Session timed out. Please log in again.',
  revoked: 'Session ended by an administrator. Please log in again.',
  signed_out: 'You were signed out in another tab.',
};

// Until /auth/session/ reports the backend's configured value.
const DEFAULT_IDLE_TIMEOUT_SECONDS = 15 * 60;

// Tells this browser's other tabs about logins/logouts, so every tab
// follows the (shared) session cookie immediately instead of on its next
// failing request.
const AUTH_CHANNEL_NAME = 'toss-auth';
const openAuthChannel = () =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL_NAME);

/**
 * True when this specific tab holds an impersonation session — the only
 * signal used to decide which storage (sessionStorage, per-tab) vs
 * (localStorage, shared across every tab on the origin) a call should read
 * from/write to. See utils/impersonationStorage.js.
 */
const isImpersonationTab = () => Boolean(impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN));

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

export const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

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

  const toast = useToast();

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
    const impersonating = isImpersonationTab();
    const activeStore = impersonating ? impersonationStorage : storage;
    const userKey = impersonating ? IMPERSONATION_KEYS.USER : STORAGE_KEYS.AUTH_USER;

    let persistedUser = activeStore.get(userKey);

    try {
      const { default: httpClient } = await import('@api/httpClient');
      const { default: endpoints } = await import('@api/endpoints');
      const userInfoRes = await httpClient.get(endpoints.auth.userInfo);
      const fullInfo = userInfoRes.data;

      // console.log('USER DATA RESPONSE FROM BACKEND:', fullInfo);

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
        isManager: (info.mySubordinates || persistedUser?.mySubordinates || []).length > 0,
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
        hasImpersonationAccess: Boolean(info.hasImpersonationAccess),
        isImpersonated: Boolean(info.isImpersonated),
        impersonatedByName: info.impersonatedByName || null,
        // 'role' = "View as Role" (own identity, simulated permissions),
        // 'employee' = "Access Account" (a real target's identity/data).
        impersonationType: info.impersonationType || null,
      };
      if (info.userName || info.username) {
        persistedUser.initials = (info.userName || info.username).substring(0, 2).toUpperCase();
      }

      if (includePhoto && persistedUser.emp_id) {
        const avatar = await resolveAvatarDataUri(persistedUser.emp_id);
        if (avatar) persistedUser.avatar = avatar;
      }

      activeStore.set(userKey, persistedUser);
    } catch (err) {
      // A 401 means the session is gone — httpClient has already announced
      // it (auth-unauthorized / impersonation-ended), so don't resurrect it.
      if (err.response?.status === 401) return false;
      console.warn('Failed to refresh user-info', err);
      // Keep whatever was already persisted/rendered — a transient network
      // failure here must not sign the user out or blank their permissions.
    }

    if (!persistedUser) return false;
    // The impersonation session may have ended while user-info was in flight.
    if (impersonating && !impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN)) return false;

    setUser((prevUser) => {
      const finalUser = { ...persistedUser };
      // If storage failed to save the avatar (e.g. due to quota), preserve it from React state
      if (!finalUser.avatar && prevUser?.avatar) {
        finalUser.avatar = prevUser.avatar;
        // Also try to persist it back just in case
        activeStore.set(userKey, finalUser);
      }
      return finalUser;
    });
    return true;
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

  // Clears ONLY this tab's impersonation state (sessionStorage) — never
  // touches localStorage, so the admin's real session in their original
  // tab is completely unaffected, per the isolation requirement.
  const clearImpersonationSession = useCallback(() => {
    impersonationStorage.remove(IMPERSONATION_KEYS.ACCESS_TOKEN);
    impersonationStorage.remove(IMPERSONATION_KEYS.REFRESH_TOKEN);
    impersonationStorage.remove(IMPERSONATION_KEYS.USER);
    setUser(null);
  }, []);

  const clearSession = useCallback(() => {
    // A tab holding an impersonation session must never run the normal
    // localStorage-wiping branch below — that localStorage is SHARED with
    // the admin's own real tab (same origin), so wiping it here would log
    // the admin themself out in their original tab.
    if (isImpersonationTab()) {
      clearImpersonationSession();
      return;
    }

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
  }, [clearImpersonationSession]);

  // Ends the impersonation session tied to this tab: tells the backend
  // (best-effort — session also self-expires) and clears local state. This
  // is the "End session" action in the impersonation banner, and is
  // distinct from logout() — logout() ends a real login session, this ends
  // an impersonation session, and the two must never be conflated.
  const endImpersonation = useCallback(async () => {
    const accessToken = impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN);
    try {
      if (accessToken) {
        await impersonationService.end(accessToken);
      }
    } catch {
      // Best-effort — the session has a hard TTL server-side regardless.
    } finally {
      clearImpersonationSession();
    }
  }, [clearImpersonationSession]);

  // Cross-tab login/logout sync. Normal tabs all share one session cookie,
  // so when it's ended — or replaced by a new login — in one tab, every
  // other normal tab follows immediately. Impersonation tabs hold their own
  // independent session and ignore these messages.
  const channelRef = useRef(null);
  useEffect(() => {
    const channel = openAuthChannel();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      channel?.close();
    };
  }, []);

  const broadcast = useCallback((message) => channelRef.current?.postMessage(message), []);

  // Tears down a normal session that has ended (or that this tab is ending).
  // `reason` picks the toast; the server is told so the (possibly already
  // dead) cookie is cleared and the next visit starts clean.
  const endSession = useCallback(
    (reason, { notifyServer = true, notifyTabs = true } = {}) => {
      markSessionEnded();
      toast.warning(SESSION_END_MESSAGES[reason] ?? SESSION_END_MESSAGES.timeout);
      clearSession();
      if (notifyServer) authService.logout();
      if (notifyTabs) broadcast({ type: 'logout', reason });
    },
    [broadcast, clearSession, toast],
  );

  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState(DEFAULT_IDLE_TIMEOUT_SECONDS);

  // Asks the backend whether this browser's cookie is a live session and,
  // if so, loads the profile. A dead session answers 401 with the reason
  // (e.g. replaced by a login elsewhere while this tab was closed).
  const restoreSession = useCallback(async () => {
    try {
      const session = await authService.getSession();
      if (session.idleTimeoutSeconds) setIdleTimeoutSeconds(session.idleTimeoutSeconds);
      if (session.authenticated) {
        resetSessionEndGuard();
        await refreshUser({ includePhoto: true });
      } else {
        storage.remove(STORAGE_KEYS.AUTH_USER);
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        endSession(sessionEndReason(err), { notifyTabs: false });
      } else {
        console.warn('Could not verify session', err);
      }
    }
  }, [endSession, refreshUser]);

  // Restore the session on first mount so a page refresh doesn't sign the
  // user out, and pull fresh role/permission data at the same time.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (isImpersonationTab()) {
        await refreshUser({ includePhoto: true });
      } else {
        await restoreSession();
      }
      if (isMounted) {
        setIsInitialising(false);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return undefined;
    const handleMessage = ({ data }) => {
      if (isImpersonationTab()) return;
      if (data?.type === 'logout') {
        if (user) endSession(data.reason, { notifyServer: false, notifyTabs: false });
      } else if (data?.type === 'login') {
        // Another tab logged in (possibly as someone else) — the shared
        // cookie now belongs to that session, so reload who we are.
        restoreSession();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, [user, endSession, restoreSession]);

  // httpClient announces a dead session (401 with the backend's reason code).
  useEffect(() => {
    const handleUnauthorized = (event) => endSession(event.detail?.reason);
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [endSession]);

  // Impersonation sessions die independently of the normal-session logic
  // above (own token family, own storage) — this is the only place an
  // impersonation session ever gets torn down other than the explicit
  // "End session" banner action.
  useEffect(() => {
    const handleImpersonationEnded = () => {
      toast.warning('Impersonation session ended.');
      clearImpersonationSession();
      // Best-effort — only succeeds because this tab was opened via
      // window.open() (see ProfileMenu's "Access Account" item). If the
      // browser refuses, ProtectedRoute's own isAuthenticated check takes
      // over and redirects this tab to /login instead.
      window.close();
    };
    window.addEventListener('impersonation-ended', handleImpersonationEnded);
    return () => window.removeEventListener('impersonation-ended', handleImpersonationEnded);
  }, [clearImpersonationSession, toast]);

  const login = useCallback(
    async (credentials) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const session = await authService.login(credentials);
        resetSessionEndGuard();
        if (session.idleTimeoutSeconds) setIdleTimeoutSeconds(session.idleTimeoutSeconds);

        // setUser only happens inside refreshUser, once real role/permission
        // data is in hand — flipping isAuthenticated earlier would make
        // PublicRoute navigate away with placeholder permissions.
        const loaded = await refreshUser({ includePhoto: true });
        if (!loaded) {
          throw new Error('Signed in, but your profile could not be loaded. Please try again.');
        }
        broadcast({ type: 'login' });
      } catch (caught) {
        setError(caught.message);
        throw caught;
      } finally {
        setIsSubmitting(false);
      }
    },
    [broadcast, refreshUser],
  );

  const logout = useCallback(async () => {
    markSessionEnded();
    // Signing out locally must succeed even if the server call does not.
    await authService.logout();
    clearSession();
    broadcast({ type: 'logout', reason: 'signed_out' });
  }, [broadcast, clearSession]);

  // Idle timeout for normal sessions (impersonation sessions have their own
  // hard ceiling server-side). The backend enforces the same limit; this is
  // the warning + clean sign-out on top of it.
  const keepAlive = useCallback(() => {
    authService.getSession().catch((err) => {
      if (err.response?.status === 401) endSession(sessionEndReason(err));
    });
  }, [endSession]);

  const { warningSecondsLeft, staySignedIn } = useIdleTimeout({
    enabled: Boolean(user) && !isImpersonationTab(),
    idleTimeoutMs: idleTimeoutSeconds * 1000,
    onTimeout: () => endSession('timeout'),
    onKeepAlive: keepAlive,
  });

  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isImpersonating: Boolean(user?.isImpersonated),
      isInitialising,
      isSubmitting,
      error,
      login,
      logout,
      endImpersonation,
      hasPermission,
      refreshUser,
      clearError,
    }),
    [
      user,
      isInitialising,
      isSubmitting,
      error,
      login,
      logout,
      endImpersonation,
      hasPermission,
      refreshUser,
      clearError,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <IdleWarningModal
        // Only ever for a signed-in user — never over the login page.
        secondsLeft={user ? warningSecondsLeft : null}
        onStaySignedIn={staySignedIn}
        onSignOut={logout}
      />
    </AuthContext.Provider>
  );
}
