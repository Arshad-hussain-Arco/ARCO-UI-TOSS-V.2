import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Copy, MoreVertical, Power, ClipboardCopy } from 'lucide-react';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { runTone } from '../schedulerModel';
import { useResource } from '../useResource';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

/** Automatic scheduling of one environment: the on/off switch, the next start per workflow, and what the scheduler decided recently. */
export function SchedulePanel({ env }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const sched = useResource(() => svc.getSchedule(env), [env]);
  const [busy, setBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, type: 'folder'|'event', item }
  const menuRef = useRef(null);
  const s = sched.data;

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRowContextMenu = (e, type, item) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 190;
    const menuHeight = 160;
    let x = e.clientX;
    if (x + menuWidth > window.innerWidth - 12) {
      x = window.innerWidth - menuWidth - 12;
    }
    let y = e.clientY;
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, e.clientY - menuHeight);
    }
    setContextMenu({ x, y, type, item });
  };

  const handleMoreButtonClick = (e, type, item) => {
    e.preventDefault();
    e.stopPropagation();
    const id = type === 'folder' ? item.folder : `${item.ts}-${item.slot}`;
    const curId = contextMenu ? (contextMenu.type === 'folder' ? contextMenu.item.folder : `${contextMenu.item.ts}-${contextMenu.item.slot}`) : null;
    if (contextMenu && curId === id) {
      closeContextMenu();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 190;
    const menuHeight = 160;
    let x = rect.right - menuWidth;
    if (x < 12) x = rect.left;
    let y = rect.bottom + 4;
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, rect.top - menuHeight - 4);
    }
    setContextMenu({ x, y, type, item });
  };

  useEffect(() => {
    if (!contextMenu) return;

    const handleDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeContextMenu();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleDocClick, true);
    window.addEventListener('resize', closeContextMenu);

    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleDocClick, true);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  const toggle = async (enabled) => {
    setBusy(true);
    try {
      await svc.setScheduler(env, enabled);
      toast.success(
        enabled
          ? 'The scheduler is on for this environment.'
          : 'The scheduler is off for this environment.',
      );
      sched.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRunFolderNow = async (folder) => {
    closeContextMenu();
    if (!hasPermission('EOD_SCHEDULER_EXECUTE')) {
      toast.error('You do not have permission to execute runs.');
      return;
    }
    try {
      await svc.runNow(env, { folder });
      toast.success(`Run started for workflow ${folder}.`);
      sched.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleCopyText = (text, label) => {
    closeContextMenu();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success(`Copied ${label}: ${text}`);
  };

  if (sched.loading && !s) return <p className="eodsch-muted">Loading the schedule…</p>;
  if (sched.error)
    return (
      <div className="eodsch-error" role="alert">
        {sched.error}
      </div>
    );

  return (
    <div className="eodsch-stack">
      <div className="eodsch-card">
        <div className="eodsch-toolbar">
          <div>
            <strong>Automatic scheduling</strong>
            <div className="eodsch-muted">
              Time zone {s.timezone} · now {when(s.now)} · jobs missed while the engine was down are{' '}
              {s.missed_policy === 'run' ? 'run late' : 'skipped'} after {s.grace_seconds}s
            </div>
          </div>
          <div className="eodsch-field-inline">
            <span>{s.enabled ? 'On' : 'Off'}</span>
            <Toggle
              checked={s.enabled}
              disabled={busy || !hasPermission('EOD_SCHEDULER_EXECUTE')}
              onChange={toggle}
              ariaLabel="Scheduler on or off"
            />
          </div>
        </div>
        <p className="eodsch-muted">
          The scheduler only starts workflows that are approved, and it only runs while an engine
          process is running for this environment.
        </p>
        <details>
          <summary>How scheduling decisions are made</summary>
          <p>{s.policy}</p>
        </details>
      </div>

      <div className="eodsch-card eodsch-table-wrap">
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Timed jobs</th>
              <th>Next scheduled start</th>
              <th>Last run</th>
              <th>Last scheduled run</th>
              <th style={{ width: '40px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {s.folders.map((f) => (
              <tr
                key={f.folder}
                onContextMenu={(e) => handleRowContextMenu(e, 'folder', f)}
                data-selected={contextMenu?.type === 'folder' && contextMenu?.item?.folder === f.folder}
              >
                <td><strong>{f.folder}</strong></td>
                <td>{f.timed_jobs}</td>
                <td>{when(f.next_scheduled_start)}</td>
                <td>
                  {f.last_run ? (
                    <span className={`eodsch-chip eodsch-tone-${runTone(f.last_run.status)}`}>
                      {f.last_run.status}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {f.last_scheduled_run ? (
                    <span
                      className={`eodsch-chip eodsch-tone-${runTone(f.last_scheduled_run.status)}`}
                    >
                      {f.last_scheduled_run.status}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="eodsch-link"
                    style={{ padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                    onClick={(e) => handleMoreButtonClick(e, 'folder', f)}
                    title="Workflow options"
                    aria-label="Workflow options"
                  >
                    <MoreVertical size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {!s.folders.length ? (
              <tr>
                <td colSpan={6} className="eodsch-muted">
                  Upload a workflow to see its schedule.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="eodsch-card eodsch-table-wrap">
        <div className="eodsch-toolbar">
          <strong>Recent scheduler decisions</strong>
        </div>
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Workflow</th>
              <th>Outcome</th>
              <th>Detail</th>
              <th style={{ width: '40px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {s.events.map((e) => (
              <tr
                key={`${e.ts}-${e.slot}-${e.outcome}`}
                onContextMenu={(ev) => handleRowContextMenu(ev, 'event', e)}
                data-selected={
                  contextMenu?.type === 'event' &&
                  contextMenu?.item?.ts === e.ts &&
                  contextMenu?.item?.slot === e.slot
                }
              >
                <td>{e.ts}</td>
                <td>{e.folder}</td>
                <td>{e.outcome}</td>
                <td className="eodsch-cell-command" title={e.detail}>
                  {e.detail || '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="eodsch-link"
                    style={{ padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                    onClick={(ev) => handleMoreButtonClick(ev, 'event', e)}
                    title="Decision options"
                    aria-label="Decision options"
                  >
                    <MoreVertical size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {!s.events.length ? (
              <tr>
                <td colSpan={5} className="eodsch-muted">
                  Nothing has been scheduled yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* ── Context Menu for Scheduler Panel ── */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="eodsch-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          role="menu"
          aria-label="Schedule context menu"
        >
          {contextMenu.type === 'folder' ? (
            <>
              <div className="eodsch-context-menu-header">
                Workflow: {contextMenu.item.folder}
              </div>
              {hasPermission('EOD_SCHEDULER_EXECUTE') && (
                <button
                  type="button"
                  className="eodsch-context-menu-item"
                  role="menuitem"
                  onClick={() => handleRunFolderNow(contextMenu.item.folder)}
                >
                  <Play size={13} className="eodsch-context-menu-icon primary" />
                  <span>Run Now</span>
                </button>
              )}
              <button
                type="button"
                className="eodsch-context-menu-item"
                role="menuitem"
                onClick={() => handleCopyText(contextMenu.item.folder, 'workflow')}
              >
                <Copy size={13} className="eodsch-context-menu-icon" />
                <span>Copy Workflow Name</span>
              </button>
              {hasPermission('EOD_SCHEDULER_EXECUTE') && (
                <button
                  type="button"
                  className="eodsch-context-menu-item"
                  role="menuitem"
                  onClick={() => {
                    closeContextMenu();
                    toggle(!s.enabled);
                  }}
                >
                  <Power size={13} className="eodsch-context-menu-icon" />
                  <span>Turn Scheduler {s.enabled ? 'Off' : 'On'}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="eodsch-context-menu-header">
                Decision: {contextMenu.item.outcome}
              </div>
              <button
                type="button"
                className="eodsch-context-menu-item"
                role="menuitem"
                onClick={() => handleCopyText(contextMenu.item.detail || contextMenu.item.outcome, 'detail')}
              >
                <ClipboardCopy size={13} className="eodsch-context-menu-icon" />
                <span>Copy Decision Detail</span>
              </button>
              {contextMenu.item.slot && (
                <button
                  type="button"
                  className="eodsch-context-menu-item"
                  role="menuitem"
                  onClick={() => handleCopyText(contextMenu.item.slot, 'slot')}
                >
                  <Copy size={13} className="eodsch-context-menu-icon" />
                  <span>Copy Slot Time</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SchedulePanel;
