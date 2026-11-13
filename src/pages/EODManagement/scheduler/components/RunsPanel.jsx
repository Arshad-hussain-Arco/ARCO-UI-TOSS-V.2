import { useEffect, useState } from 'react';
import { RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { formatDuration, jobTone, runTone, secondsBetween } from '../schedulerModel';
import { usePolling, useResource } from '../useResource';

export function Chip({ tone, children }) {
  return <span className={`eodsch-chip eodsch-tone-${tone}`}>{children}</span>;
}

export function LogViewer({ env, runId, jobs = [], running }) {
  const [job, setJob] = useState('');
  const log = useResource(
    () => svc.getRunLog(env, runId, job).catch(() => '(no log yet)'),
    [env, runId, job]
  );
  usePolling(() => log.reload(true), 4000, running);
  return (
    <div className="eodsch-card">
      <div className="eodsch-toolbar">
        <label className="eodsch-field-inline">
          Log
          <select value={job} onChange={(e) => setJob(e.target.value)}>
            <option value="">Workflow log</option>
            {(jobs || []).map((j) => (
              <option key={j.job || j.name} value={j.job || j.name}>
                {j.job || j.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={RefreshCw}
          onClick={() => log.reload()}
          aria-label="Reload the log"
        />
      </div>
      {log.error ? (
        <div className="eodsch-error" role="alert">
          {log.error}
        </div>
      ) : null}
      {/* plain text only: never rendered as HTML */}
      <pre className="eodsch-log">{log.loading && !log.data ? 'Loading…' : log.data}</pre>
    </div>
  );
}

export function RunDetail({ env, runId, onChanged }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const detail = useResource(async () => {
    try {
      const res = await svc.getRun(env, runId);
      if (res && res.run) return res;
    } catch {
      // try cockpit run fallback
    }
    try {
      const cRes = await svc.getCockpitRun(env, runId);
      if (cRes) {
        return {
          run: {
            run_id: cRes.id || runId,
            run_type: 'FORCED',
            odate: cRes.started_at ? cRes.started_at.slice(0, 10).replace(/-/g, '') : '',
            started: cRes.started_at,
            ended: cRes.ended_at,
            started_by: 'operator',
            approved_by: 'system',
            status: cRes.status,
            message: '',
          },
          jobs: (cRes.jobs || []).map((j) => ({
            job: j.name,
            status: j.status,
            attempts: j.attempt || 1,
            exit_code: j.exit_code,
            duration: j.duration_seconds,
            started: j.started_at,
            ended: j.ended_at,
            reason: j.error_message || '',
          })),
          attempts: [],
          conditions: [],
        };
      }
    } catch {
      // ignore
    }
    return svc.getRun(env, runId);
  }, [env, runId]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = detail.data?.run?.status === 'RUNNING';
  usePolling(() => detail.reload(true), 4000, running);

  useEffect(() => {
    if (detail.data && !running) onChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const cancel = async () => {
    setBusy(true);
    try {
      await svc.cancelRun(env, runId);
      toast.success(
        'Cancel requested. Running jobs are asked to stop; a remote command cannot be killed and is reported as uncertain if it does not end.',
      );
      setConfirm(false);
      detail.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading && !detail.data) return <p className="eodsch-muted">Loading the run…</p>;
  if (detail.error)
    return (
      <div className="eodsch-error" role="alert">
        {detail.error}
      </div>
    );
  const { run, jobs, attempts, conditions } = detail.data;

  return (
    <div className="eodsch-stack">
      <div className="eodsch-card">
        <div className="eodsch-toolbar">
          <div>
            <strong>{run.run_id}</strong>
            {run.name && (
              <span style={{ fontWeight: 600, color: 'var(--c-primary, #005a36)', marginLeft: '8px', marginRight: '8px' }}>
                · {run.name}
              </span>
            )}
            <Chip tone={runTone(run.status)}>{run.status}</Chip>
            <div className="eodsch-muted">
              {run.run_type} · business date {run.odate} · started {run.started} ·{' '}
              {run.started_by ? `started by ${run.started_by} · ` : ''}
              {run.approved_by ? `approved by ${run.approved_by} · ` : ''}
              {run.ended ? `ended ${run.ended}` : 'still running'}
              {run.message ? ` · ${run.message}` : ''}
            </div>
          </div>
          {running && hasPermission('EOD_SCHEDULER_EXECUTE') ? (
            <Button
              variant="danger"
              size="sm"
              leadingIcon={XCircle}
              onClick={() => setConfirm(true)}
            >
              Cancel run
            </Button>
          ) : null}
        </div>
        <div className="eodsch-table-wrap">
          <table className="eodsch-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Tries</th>
                <th>Exit</th>
                <th>Time</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job}>
                  <td>{j.job}</td>
                  <td>
                    <Chip tone={jobTone(j.status)}>{j.status}</Chip>
                  </td>
                  <td>{j.attempts}</td>
                  <td>{j.exit_code ?? '—'}</td>
                  <td>{formatDuration(j.duration ?? secondsBetween(j.started, j.ended))}</td>
                  <td className="eodsch-cell-command" title={j.reason}>
                    {j.reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {attempts.length ? (
          <details>
            <summary>{attempts.length} attempt(s)</summary>
            <table className="eodsch-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>#</th>
                  <th>Status</th>
                  <th>Exit</th>
                  <th>Time</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={`${a.job}-${a.attempt}`}>
                    <td>{a.job}</td>
                    <td>{a.attempt}</td>
                    <td>{a.status}</td>
                    <td>{a.exit_code ?? '—'}</td>
                    <td>{formatDuration(a.duration)}</td>
                    <td className="eodsch-cell-command" title={a.error}>
                      {a.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
        {conditions.length ? (
          <p className="eodsch-muted">Conditions set: {conditions.join(', ')}</p>
        ) : null}
      </div>
      <LogViewer env={env} runId={runId} jobs={jobs} running={running} />
      <AdminModal
        title="Cancel this run?"
        isOpen={confirm}
        onClose={() => !busy && setConfirm(false)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
              Keep running
            </Button>
            <Button variant="danger" onClick={cancel} isLoading={busy}>
              Cancel run
            </Button>
          </>
        }
      >
        <p>
          Jobs that have not started will be skipped. A command already running on a target server
          is not killed by SSH; if it does not end, the job is reported as uncertain and is never
          retried automatically.
        </p>
      </AdminModal>
    </div>
  );
}

/** Run history of one environment with per-job results, attempts and logs. Refreshes while a run is active. */
export function RunsPanel({ env, focusRun }) {
  const runs = useResource(() => svc.listRuns(env), [env]);
  const [selected, setSelected] = useState(focusRun || '');
  const anyRunning = (runs.data ?? []).some((r) => r.status === 'RUNNING');
  usePolling(() => runs.reload(true), 5000, true);

  useEffect(() => {
    if (focusRun) setSelected(focusRun);
  }, [focusRun]);

  if (runs.loading && !runs.data) return <p className="eodsch-muted">Loading runs…</p>;
  if (runs.error)
    return (
      <div className="eodsch-error" role="alert">
        {runs.error}
      </div>
    );

  return (
    <div className="eodsch-split eodsch-split-runs">
      <div className="eodsch-card eodsch-table-wrap">
        <div className="eodsch-toolbar">
          <strong>Runs</strong>
          {anyRunning ? <Chip tone="run">live</Chip> : null}
        </div>
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Type</th>
              <th>Status</th>
              <th>Started by</th>
              <th>Approved by</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.map((r) => (
              <tr key={r.run_id} data-selected={r.run_id === selected}>
                <td>
                  <button
                    type="button"
                    className="eodsch-link"
                    aria-pressed={r.run_id === selected}
                    onClick={() => setSelected(r.run_id)}
                  >
                    {r.run_id}
                  </button>
                </td>
                <td>{r.run_type}</td>
                <td>
                  <Chip tone={runTone(r.status)}>{r.status}</Chip>
                </td>
                <td>{r.started_by || '—'}</td>
                <td>{r.approved_by || '—'}</td>
                <td>{r.started}</td>
              </tr>
            ))}
            {!runs.data.length ? (
              <tr>
                <td colSpan={6} className="eodsch-muted">
                  No runs yet in this environment.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div>
        {selected ? (
          <RunDetail
            key={selected}
            env={env}
            runId={selected}
            onChanged={() => runs.reload(true)}
          />
        ) : (
          <p className="eodsch-muted">Select a run to see its jobs and logs.</p>
        )}
      </div>
    </div>
  );
}

export default RunsPanel;
