import { useCallback, useEffect, useRef, useState } from 'react';

import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];
// localStorage is written at most this often, however busy the mouse is.
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
// Upper bound on how often user activity pings the backend to extend the
// server-side session (which only sees requests, not mouse moves).
const MAX_KEEPALIVE_INTERVAL_MS = 5 * 60_000;

/**
 * Logs the user out after `idleTimeoutMs` without interaction in ANY tab,
 * showing a countdown warning for the last `warningMs`.
 *
 * - Activity is shared across tabs through localStorage (LAST_ACTIVITY), so
 *   working in one tab keeps every tab signed in.
 * - While active, `onKeepAlive` is called every few minutes so the backend's
 *   own idle timeout (the real enforcement — this hook is the UX on top of
 *   it) keeps being extended even on pages that make no requests.
 * - Once the warning is up, only the explicit "Stay signed in" action
 *   (staySignedIn) counts — a stray mouse move doesn't dismiss it.
 *
 * @returns {{ warningSecondsLeft: number | null, staySignedIn: () => void }}
 */
export function useIdleTimeout({ enabled, idleTimeoutMs, warningMs = 60_000, onTimeout, onKeepAlive }) {
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(null);

  const lastWriteRef = useRef(0);
  const lastKeepAliveRef = useRef(0);
  const warningShownRef = useRef(false);
  const timedOutRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  const onKeepAliveRef = useRef(onKeepAlive);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onKeepAliveRef.current = onKeepAlive;
  }, [onTimeout, onKeepAlive]);

  const keepAliveIntervalMs = Math.min(MAX_KEEPALIVE_INTERVAL_MS, idleTimeoutMs / 3);

  const recordActivity = useCallback(
    (force = false) => {
      const now = Date.now();
      if (force || now - lastWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        storage.set(STORAGE_KEYS.LAST_ACTIVITY, now);
      }
      if (force || now - lastKeepAliveRef.current >= keepAliveIntervalMs) {
        lastKeepAliveRef.current = now;
        onKeepAliveRef.current?.();
      }
    },
    [keepAliveIntervalMs],
  );

  const staySignedIn = useCallback(() => {
    warningShownRef.current = false;
    setWarningSecondsLeft(null);
    recordActivity(true);
  }, [recordActivity]);

  useEffect(() => {
    if (!enabled) return undefined;

    timedOutRef.current = false;
    warningShownRef.current = false;
    setWarningSecondsLeft(null);
    // Session just started (or this tab just loaded) — the backend was hit
    // moments ago, so no keepalive is due yet.
    lastKeepAliveRef.current = Date.now();
    lastWriteRef.current = Date.now();
    storage.set(STORAGE_KEYS.LAST_ACTIVITY, Date.now());

    const handleActivity = () => {
      if (!warningShownRef.current) recordActivity();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    const tick = setInterval(() => {
      if (timedOutRef.current) return;
      const last = Number(storage.get(STORAGE_KEYS.LAST_ACTIVITY)) || Date.now();
      const remaining = idleTimeoutMs - (Date.now() - last);

      if (remaining <= 0) {
        timedOutRef.current = true;
        warningShownRef.current = false;
        setWarningSecondsLeft(null);
        onTimeoutRef.current?.();
      } else if (remaining <= warningMs) {
        warningShownRef.current = true;
        setWarningSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningShownRef.current) {
        // Activity in another tab moved the shared timestamp forward.
        warningShownRef.current = false;
        setWarningSecondsLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [enabled, idleTimeoutMs, warningMs, recordActivity]);

  return { warningSecondsLeft, staySignedIn };
}

export default useIdleTimeout;
