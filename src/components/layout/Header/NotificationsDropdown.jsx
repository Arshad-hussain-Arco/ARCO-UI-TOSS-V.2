import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, BellOff, Check, CheckCheck, X,
  CalendarClock, CheckCircle2, XCircle, CalendarX,
  FileEdit, Undo2, Timer, Hourglass, RefreshCcw,
  CalendarCheck, AlertCircle, Wifi, WifiOff, PlayCircle,
} from 'lucide-react';
import { getNotifConfig } from '@hooks/useNotifications';
import './NotificationsDropdown.css';

/* ── Icon + colour map per notification type ─────────────────────────────── */
const TYPE_MAP = {
  LEAVE_APPLIED:           { Icon: CalendarClock,  hue: 'blue'   },
  LEAVE_APPROVED:          { Icon: CheckCircle2,   hue: 'emerald' },
  LEAVE_REJECTED:          { Icon: XCircle,        hue: 'red'    },
  LEAVE_CANCELLED:         { Icon: CalendarX,      hue: 'slate'  },
  LEAVE_MODIFIED:          { Icon: FileEdit,       hue: 'amber'  },
  LEAVE_PARTIAL_CANCELLED: { Icon: Undo2,          hue: 'purple' },
  REMINDER:                { Icon: Bell,           hue: 'orange' },
  MOD_REQUESTED:           { Icon: RefreshCcw,     hue: 'cyan'   },
  MOD_APPROVED:            { Icon: CalendarCheck,  hue: 'emerald' },
  MOD_REJECTED:            { Icon: AlertCircle,    hue: 'red'    },
  OW_EXCESS_REQUESTED:     { Icon: Timer,          hue: 'amber'  },
  OW_EXCESS_APPROVED:      { Icon: Hourglass,      hue: 'emerald' },
  OW_EXCESS_REJECTED:      { Icon: XCircle,        hue: 'red'    },
  EOD_JOB_STARTED:         { Icon: PlayCircle,     hue: 'emerald' },
  EOD_JOB_COMPLETED:       { Icon: CheckCircle2,   hue: 'emerald' },
  EOD_JOB_FAILED:          { Icon: AlertCircle,    hue: 'red'    },
};

const HUES = {
  blue:    'var(--c-info)',
  emerald: 'var(--c-success)',
  red:     'var(--c-danger)',
  slate:   'var(--text-secondary)',
  amber:   'var(--c-warning)',
  purple:  '#8b5cf6',
  orange:  'var(--c-warning)',
  cyan:    '#06b6d4',
};

function getType(type) {
  const t = TYPE_MAP[type];
  return { Icon: t?.Icon ?? Bell, color: HUES[t?.hue ?? 'slate'] };
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ── Component ────────────────────────────────────────────────────────────── */
export function NotificationsDropdown({
  isOpen, onClose, notifications, unreadCount, wsStatus, onMarkRead, onMarkAllRead,
}) {
  const [tab, setTab] = useState('all'); // 'all' | 'unread'
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Reset tab when closed
  useEffect(() => { if (!isOpen) setTab('all'); }, [isOpen]);

  const onBdClick = useCallback((e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const connected = wsStatus === 'open';
  const list = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div className="nd-bd" onMouseDown={onBdClick} aria-hidden="true">
      <div
        ref={panelRef}
        className="nd-panel"
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="nd-hd">
          <div className="nd-hd-top">
            <h2 className="nd-hd-title">Notifications</h2>
            <div className="nd-hd-actions">
              <span
                className={`nd-ws-chip ${connected ? 'nd-ws-chip--on' : 'nd-ws-chip--off'}`}
                title={connected ? 'Receiving live updates' : 'Reconnecting…'}
              >
                <span className={`nd-ws-dot ${connected ? 'nd-ws-dot--on' : ''}`} />
                {connected ? 'Live' : 'Offline'}
              </span>
              {unreadCount > 0 && (
                <button type="button" className="nd-mark-btn" onClick={onMarkAllRead}>
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button type="button" className="nd-close" onClick={onClose} aria-label="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="nd-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'all'}
              className={`nd-tab ${tab === 'all' ? 'nd-tab--active' : ''}`}
              onClick={() => setTab('all')}
            >
              All
            </button>
            <button
              role="tab"
              aria-selected={tab === 'unread'}
              className={`nd-tab ${tab === 'unread' ? 'nd-tab--active' : ''}`}
              onClick={() => setTab('unread')}
            >
              Unread
              {unreadCount > 0 && <span className="nd-tab-count nd-tab-count--red">{unreadCount}</span>}
            </button>
          </div>
        </div>

        {/* ── List ── */}
        <div className="nd-list" role="list">
          {list.length === 0 ? (
            <div className="nd-empty">
              <div className="nd-empty-ring">
                <BellOff size={22} className="nd-empty-ico" />
              </div>
              <p className="nd-empty-h">
                {tab === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
              </p>
              <p className="nd-empty-p">
                {tab === 'unread' ? 'All caught up — great job!' : 'New notifications will appear here.'}
              </p>
            </div>
          ) : (
            list.map((n, i) => {
              const { Icon, color } = getType(n.notification_type);
              const cfg = getNotifConfig(n.notification_type);
              const unread = !n.is_read;

              return (
                <div
                  key={n.id}
                  className={`nd-item${unread ? ' nd-item--ur' : ''}`}
                  role="listitem"
                  onClick={() => unread && onMarkRead(n.id)}
                  tabIndex={unread ? 0 : -1}
                  onKeyDown={(e) => e.key === 'Enter' && unread && onMarkRead(n.id)}
                >
                  {/* Left stripe */}
                  {unread && (
                    <span className="nd-stripe" style={{ background: color }} />
                  )}

                  {/* Icon */}
                  <span className="nd-ico-wrap" style={{ '--nd-c': color }}>
                    <Icon size={14} strokeWidth={2.2} />
                  </span>

                  {/* Content */}
                  <div className="nd-body">
                    <div className="nd-row">
                      <span className="nd-type">{cfg.label}</span>
                      <span className="nd-age">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="nd-msg">{n.message}</p>
                  </div>

                  {/* Read / Unread indicator */}
                  {unread ? (
                    <span className="nd-pip" style={{ background: color }} title="Unread" />
                  ) : (
                    <span className="nd-read-check" title="Read">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div className="nd-ft">
            <span className="nd-ft-hint">
              {unreadCount === 0 ? 'All notifications read' : `${unreadCount} unread`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationsDropdown;
