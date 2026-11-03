import { useState } from 'react';
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
  const s = sched.data;

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
            </tr>
          </thead>
          <tbody>
            {s.folders.map((f) => (
              <tr key={f.folder}>
                <td>{f.folder}</td>
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
              </tr>
            ))}
            {!s.folders.length ? (
              <tr>
                <td colSpan={5} className="eodsch-muted">
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
            </tr>
          </thead>
          <tbody>
            {s.events.map((e) => (
              <tr key={`${e.ts}-${e.slot}-${e.outcome}`}>
                <td>{e.ts}</td>
                <td>{e.folder}</td>
                <td>{e.outcome}</td>
                <td className="eodsch-cell-command" title={e.detail}>
                  {e.detail || '—'}
                </td>
              </tr>
            ))}
            {!s.events.length ? (
              <tr>
                <td colSpan={4} className="eodsch-muted">
                  Nothing has been scheduled yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SchedulePanel;
