import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@config/env';
import { storage } from '@utils/storage';
import { STORAGE_KEYS } from '@constants/storageKeys';

const apiBase = env.apiBaseUrl;

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
  HOLIDAY_ADDED:           { emoji: '🎉', color: '#3b82f6', label: 'Holiday Added' },
  HOLIDAY_REMOVED:         { emoji: '🗑️', color: '#ef4444', label: 'Holiday Removed' },
  HOLIDAY_MODIFIED:        { emoji: '✏️', color: '#f59e0b', label: 'Holiday Modified' },
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

/**
 * useNotifications(empId)
 *
 * Connects via WebSocket on mount.
 * - Initial unread dump populates the list.
 * - Real-time pushes are prepended.
 * - mark_read / mark_all_read are sent over the socket (REST fallback when disconnected).
 *
 * @param {number|string|null} empId
 */
export function useNotifications(empId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [wsStatus, setWsStatus]           = useState('disconnected');

  const wsRef             = useRef(null);
  const reconnectTimer    = useRef(null);
  const isMountedRef      = useRef(true);
  const connectRef        = useRef(null); // stable ref so onclose can call it

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

  // ── WebSocket ─────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!empId || !isMountedRef.current) return;
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    // WebSockets are temporarily disabled
    // return;

    const url = `${WS_BASE}/ws/notifications/${empId}/?token=${token}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;
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
          setNotifications(prev => {
            const next = prev.map(n =>
              n.id === data.notification_id ? { ...n, is_read: true } : n
            );
            setUnreadCount(calcUnread(next));
            return next;
          });
          return;
        }

        if (data.action === 'mark_all_read' && data.success) {
          setNotifications(prev => {
            const next = prev.map(n => ({ ...n, is_read: true }));
            setUnreadCount(0);
            return next;
          });
          return;
        }

        // Push notification (has an id field)
        if (data.id !== undefined) {
          upsert(data);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = (evt) => {
      if (!isMountedRef.current) return;
      setWsStatus('disconnected');
      wsRef.current = null;
      if (evt.code === 4001) return;                          // bad token — don't retry
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 5000);
    };

    ws.onerror = () => { /* handled in onclose */ };
  }, [empId, upsert]);

  // Keep a stable ref to connect so onclose can call it without stale closure
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    if (!empId) return;

    // 1. Fetch ALL notifications (read + unread) from REST so the list is
    //    always populated on refresh, even if all are read (WS only sends unread).
    restFetch(`/leaves/me/notifications/?emp_id=${empId}`)
      .then(data => {
        if (!isMountedRef.current) return;
        // API may return a paginated shape { results: [...] } or a plain array
        const list = Array.isArray(data) ? data : (data.results ?? []);
        // Sort newest-first
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNotifications(list);
        setUnreadCount(calcUnread(list));
      })
      .catch(() => {
        // If REST fails, fall back to just the unread-count badge
        restFetch(`/leaves/me/notifications/unread-count/?emp_id=${empId}`)
          .then(d => { if (isMountedRef.current) setUnreadCount(d.unread_count ?? 0); })
          .catch(() => {});
      });

    // 2. Connect WebSocket — server will push any unread items.
    //    upsert() merges them into the existing REST list, marking them unread.
    connect();

    return () => {
      isMountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent auto-reconnect on deliberate unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [empId, connect]);

  // Keep unreadCount synced whenever notifications list changes externally
  useEffect(() => {
    setUnreadCount(calcUnread(notifications));
  }, [notifications]);


  // ── Public API ────────────────────────────────────────────────────────────

  const markRead = useCallback((notificationId) => {
    // Optimistic
    setNotifications(prev => {
      const next = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      setUnreadCount(calcUnread(next));
      return next;
    });

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'mark_read', notification_id: notificationId }));
    } else {
      restFetch(`/leaves/me/notifications/${notificationId}/read/?emp_id=${empId}`, {
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

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'mark_all_read' }));
    } else {
      restFetch('/leaves/me/notifications/mark-all-read/', {
        method: 'POST',
        body: { emp_id: empId },
      }).catch(() => {});
    }
  }, [empId]);

  const sendReminder = useCallback((leaveId) => {
    return restFetch(`/leaves/me/leaves/${leaveId}/remind/`, {
      method: 'POST',
      body: { emp_id: empId },
    });
  }, [empId]);

  /**
   * refreshNotifications — re-fetches ALL notifications from REST.
   * Call this after on-behalf leave submissions where the backend sends a
   * notification to the *employee's* WS channel (not the manager's), so the
   * manager's dropdown won't auto-update via WebSocket alone.
   */
  const refreshNotifications = useCallback(() => {
    if (!empId || !isMountedRef.current) return;
    restFetch(`/leaves/me/notifications/?emp_id=${empId}`)
      .then(data => {
        if (!isMountedRef.current) return;
        const list = Array.isArray(data) ? data : (data.results ?? []);
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
      })
      .catch(() => {});
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
