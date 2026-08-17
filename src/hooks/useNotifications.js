import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const WS_BASE = (() => {
  const origin = apiBase.replace(/\/api\/?$/, '');
  return origin.replace(/^http/, 'ws');
})();

const REST_BASE = apiBase.replace(/\/+$/, '');

/** Notification type → display config (open-ended — unknown types fall back to 'default') */
export const NOTIF_CONFIG = {
  LEAVE_APPLIED:           { emoji: '📋', color: '#3b82f6', label: 'Leave Applied' },
  LEAVE_APPROVED:          { emoji: '✅', color: '#10b981', label: 'Leave Approved' },
  LEAVE_REJECTED:          { emoji: '❌', color: '#ef4444', label: 'Leave Rejected' },
  LEAVE_CANCELLED:         { emoji: '🚫', color: '#6b7280', label: 'Leave Cancelled' },
  LEAVE_MODIFIED:          { emoji: '✏️', color: '#f59e0b', label: 'Leave Modified' },
  LEAVE_PARTIAL_CANCELLED: { emoji: '↩️', color: '#8b5cf6', label: 'Partial Cancel' },
  REMINDER:                { emoji: '🔔', color: '#f97316', label: 'Reminder' },
  MOD_REQUESTED:           { emoji: '🔄', color: '#0891b2', label: 'Mod Requested' },
  MOD_APPROVED:            { emoji: '✔️', color: '#10b981', label: 'Mod Approved' },
  MOD_REJECTED:            { emoji: '✖️', color: '#ef4444', label: 'Mod Rejected' },
  OW_EXCESS_REQUESTED:     { emoji: '⏱️', color: '#f59e0b', label: 'OW Excess Req.' },
  OW_EXCESS_APPROVED:      { emoji: '⏰', color: '#10b981', label: 'OW Excess OK' },
  OW_EXCESS_REJECTED:      { emoji: '⛔', color: '#ef4444', label: 'OW Excess Denied' },
  EOD_JOB_STARTED:         { emoji: '🟢', color: '#10b981', label: 'EOD Job Started' },
  EOD_JOB_COMPLETED:       { emoji: '✅', color: '#10b981', label: 'EOD Job Completed' },
  EOD_JOB_FAILED:          { emoji: '🔴', color: '#ef4444', label: 'EOD Job Failed' },
  default:                 { emoji: '📣', color: '#6b7280', label: 'Notification' },
};

export function getNotifConfig(type) {
  return NOTIF_CONFIG[type] ?? NOTIF_CONFIG.default;
}

/** Lightweight REST helper (bypasses axios — used as a WS fallback) */
async function restFetch(path, { method = 'GET', body } = {}) {
  const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
  const res = await fetch(`${REST_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Two independent notification back-ends feed the same bell: the Leaves
// system (LMS_NOTIFICATIONS, ws/notifications/{empId}/) and the EOD system
// (EOD_NOTIFICATIONS, ws/eod-notifications/{empId}/). Their row ids come from
// different DB tables, so raw ids can collide once merged into one list —
// every notification is namespaced as "<source>:<rawId>" throughout this
// hook, and only unpacked back to a raw id right before calling that
// source's own REST/WS API.
const nsId = (source, rawId) => `${source}:${rawId}`;
const parseNsId = (id) => {
  const s = String(id);
  const sep = s.indexOf(':');
  return sep === -1 ? { source: null, rawId: s } : { source: s.slice(0, sep), rawId: s.slice(sep + 1) };
};
const tagSource = (source) => (item) => ({ ...item, id: nsId(source, item.id), source });

/**
 * useNotifications(empId)
 *
 * Connects to both the Leaves and EOD notification WebSocket channels on
 * mount and merges their results into a single list.
 * - Initial unread dump populates the list.
 * - Real-time pushes are prepended.
 * - mark_read / mark_all_read go over the Leaves socket (REST fallback when
 *   disconnected); EOD notifications only support REST mark-read (the EOD
 *   consumer is push-only), so those always go over REST.
 *
 * @param {number|string|null} empId
 */
export function useNotifications(empId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [wsStatus, setWsStatus]           = useState('disconnected');

  const leaveWsRef        = useRef(null);
  const eodWsRef          = useRef(null);
  const reconnectTimer    = useRef(null);
  const eodReconnectTimer = useRef(null);
  const isMountedRef      = useRef(true);
  const connectRef        = useRef(null);    // stable refs so onclose can call them
  const eodConnectRef     = useRef(null);

  // ── Internal helpers ──────────────────────────────────────────────────────

  const calcUnread = (list) => list.filter(n => !n.is_read).length;

  const upsert = useCallback((notif) => {
    setNotifications(prev => {
      const exists = prev.some(n => n.id === notif.id);
      if (exists) {
        // Merge but don't override is_read with undefined (WS pushes don't always include it)
        return prev.map(n => n.id === notif.id
          ? { ...n, ...notif, is_read: notif.is_read ?? n.is_read }
          : n
        );
      }
      // New notification from WS — server only pushes unread ones, so default is_read: false
      return [{ is_read: false, ...notif }, ...prev];
    });
  }, []);

  // ── WebSocket: Leaves ─────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!empId || !isMountedRef.current) return;
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    const url = `${WS_BASE}/ws/notifications/${empId}/?token=${token}`;
    const ws  = new WebSocket(url);
    leaveWsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen = () => {
      if (isMountedRef.current) setWsStatus('open');
    };

    ws.onmessage = (evt) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(evt.data);

        // Server acks
        if (data.action === 'mark_read' && data.success) {
          const id = nsId('leave', data.notification_id);
          setNotifications(prev => {
            const next = prev.map(n => n.id === id ? { ...n, is_read: true } : n);
            setUnreadCount(calcUnread(next));
            return next;
          });
          return;
        }

        if (data.action === 'mark_all_read' && data.success) {
          setNotifications(prev => {
            const next = prev.map(n => n.source === 'leave' ? { ...n, is_read: true } : n);
            setUnreadCount(calcUnread(next));
            return next;
          });
          return;
        }

        // Push notification (has an id field)
        if (data.id !== undefined) {
          upsert(tagSource('leave')(data));
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = (evt) => {
      if (!isMountedRef.current) return;
      setWsStatus('disconnected');
      leaveWsRef.current = null;
      if (evt.code === 4001) return;                          // bad token — don't retry
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 5000);
    };

    ws.onerror = () => { /* handled in onclose */ };
  }, [empId, upsert]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  // ── WebSocket: EOD ────────────────────────────────────────────────────────
  // Push-only channel (no mark_read/mark_all_read support server-side) — see
  // eod_jobs/consumers.py::EodNotificationConsumer.

  const eodConnect = useCallback(() => {
    if (!empId || !isMountedRef.current) return;
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    const url = `${WS_BASE}/ws/eod-notifications/${empId}/?token=${token}`;
    const ws  = new WebSocket(url);
    eodWsRef.current = ws;

    ws.onmessage = (evt) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(evt.data);
        if (data.id !== undefined) {
          upsert(tagSource('eod')(data));
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = (evt) => {
      if (!isMountedRef.current) return;
      eodWsRef.current = null;
      if (evt.code === 4001) return;                          // bad token — don't retry
      eodReconnectTimer.current = setTimeout(() => eodConnectRef.current?.(), 5000);
    };

    ws.onerror = () => { /* handled in onclose */ };
  }, [empId, upsert]);

  useEffect(() => { eodConnectRef.current = eodConnect; }, [eodConnect]);

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    if (!empId) return;

    // 1. Fetch ALL notifications (read + unread) from both back-ends so the
    //    list is always populated on refresh, even if all are read (WS only
    //    sends unread pushes).
    Promise.allSettled([
      restFetch(`/leaves/me/notifications/?emp_id=${empId}`),
      restFetch('/eod-jobs/notifications/'),
    ]).then(([leaveResult, eodResult]) => {
      if (!isMountedRef.current) return;

      const leaveData = leaveResult.status === 'fulfilled' ? leaveResult.value : [];
      const leaveList = (Array.isArray(leaveData) ? leaveData : (leaveData.results ?? [])).map(tagSource('leave'));

      const eodData = eodResult.status === 'fulfilled' ? eodResult.value : [];
      const eodList = (Array.isArray(eodData) ? eodData : []).map(tagSource('eod'));

      const merged = [...leaveList, ...eodList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotifications(merged);
      setUnreadCount(calcUnread(merged));
    });

    // 2. Connect both WebSockets — each server pushes its own unread items,
    //    merged into the REST list via upsert().
    connect();
    eodConnect();

    return () => {
      isMountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      clearTimeout(eodReconnectTimer.current);
      if (leaveWsRef.current) {
        leaveWsRef.current.onclose = null; // prevent auto-reconnect on deliberate unmount
        leaveWsRef.current.close();
        leaveWsRef.current = null;
      }
      if (eodWsRef.current) {
        eodWsRef.current.onclose = null;
        eodWsRef.current.close();
        eodWsRef.current = null;
      }
    };
  }, [empId, connect, eodConnect]);

  // Keep unreadCount synced whenever notifications list changes externally
  useEffect(() => {
    setUnreadCount(calcUnread(notifications));
  }, [notifications]);


  // ── Public API ────────────────────────────────────────────────────────────

  const markRead = useCallback((notificationId) => {
    const { source, rawId } = parseNsId(notificationId);

    // Optimistic
    setNotifications(prev => {
      const next = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      setUnreadCount(calcUnread(next));
      return next;
    });

    if (source === 'eod') {
      restFetch(`/eod-jobs/notifications/${rawId}/mark-read/`, { method: 'POST' }).catch(() => {});
      return;
    }

    const ws = leaveWsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'mark_read', notification_id: rawId }));
    } else {
      restFetch(`/leaves/me/notifications/${rawId}/read/?emp_id=${empId}`, {
        method: 'PATCH',
      }).catch(() => {});
    }
  }, [empId]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, is_read: true }));
      setUnreadCount(0);
      return next;
    });

    const ws = leaveWsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'mark_all_read' }));
    } else {
      restFetch('/leaves/me/notifications/mark-all-read/', {
        method: 'POST',
        body: { emp_id: empId },
      }).catch(() => {});
    }

    // EOD has no WS-based mark-all-read — always REST.
    restFetch('/eod-jobs/notifications/mark-all-read/', { method: 'POST' }).catch(() => {});
  }, [empId]);

  const sendReminder = useCallback((leaveId) => {
    return restFetch(`/leaves/me/leaves/${leaveId}/remind/`, {
      method: 'POST',
      body: { emp_id: empId },
    });
  }, [empId]);

  /**
   * refreshNotifications — re-fetches ALL notifications from both back-ends.
   * Call this after on-behalf leave submissions where the backend sends a
   * notification to the *employee's* WS channel (not the manager's), so the
   * manager's dropdown won't auto-update via WebSocket alone.
   */
  const refreshNotifications = useCallback(() => {
    if (!empId || !isMountedRef.current) return;
    Promise.allSettled([
      restFetch(`/leaves/me/notifications/?emp_id=${empId}`),
      restFetch('/eod-jobs/notifications/'),
    ]).then(([leaveResult, eodResult]) => {
      if (!isMountedRef.current) return;

      const leaveData = leaveResult.status === 'fulfilled' ? leaveResult.value : [];
      const leaveList = (Array.isArray(leaveData) ? leaveData : (leaveData.results ?? [])).map(tagSource('leave'));

      const eodData = eodResult.status === 'fulfilled' ? eodResult.value : [];
      const eodList = (Array.isArray(eodData) ? eodData : []).map(tagSource('eod'));

      const list = [...leaveList, ...eodList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Merge: preserve optimistic is_read updates for items already in state
      setNotifications(prev => {
        const prevMap = new Map(prev.map(n => [n.id, n]));
        const merged = list.map(n => {
          const existing = prevMap.get(n.id);
          // Keep local is_read:true if we already marked it read in this session
          return existing?.is_read && !n.is_read ? existing : { ...existing, ...n };
        });
        setUnreadCount(calcUnread(merged));
        return merged;
      });
    });
  }, [empId]);

  // Listen for a global 'notification:refresh' event — dispatched e.g. after
  // on-behalf leave submissions where the backend notifies the employee's WS
  // channel, not the manager's. Any component can trigger:
  //   window.dispatchEvent(new Event('notification:refresh'))
  useEffect(() => {
    const handler = () => refreshNotifications();
    window.addEventListener('notification:refresh', handler);
    return () => window.removeEventListener('notification:refresh', handler);
  }, [refreshNotifications]);


  return { notifications, unreadCount, wsStatus, markRead, markAllRead, sendReminder, refreshNotifications };
}
