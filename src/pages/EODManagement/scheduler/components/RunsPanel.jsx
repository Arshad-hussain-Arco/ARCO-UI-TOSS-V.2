import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, RefreshCw, Search, WrapText, XCircle } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { formatDuration, jobTone, runTone, secondsBetween, formatFullDateTime } from '../schedulerModel';
import { usePolling, useResource } from '../useResource';

import './RunsPanel.css';

const NO_LOG = '(no log yet)';

/** The log endpoint may return plain text, a list of lines or an object: always end up with text. */
const toLogText = (res) => {
  if (res == null) return '';
  if (typeof res === 'string') return res;
  if (Array.isArray(res)) return res.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
  if (typeof res === 'object') {
    const inner = res.log ?? res.text ?? res.content ?? res.output;
    return inner != null ? toLogText(inner) : JSON.stringify(res, null, 2);
  }
  return String(res);
};

/** Groups any status text into a few visual buckets. */
const statusGroup = (status) => {
  const v = String(status || '').toUpperCase();
  if (v === 'SUCCESS') return 'ok';
  if (['FAILED', 'FAILURE', 'ERROR', 'UNCERTAIN', 'TIMEOUT'].includes(v)) return 'bad';
  if (v === 'RUNNING') return 'run';
  if (['SKIPPED', 'CANCELLED', 'CANCELED'].includes(v)) return 'skip';
  return 'other';
};

/** Format backend timestamp in user's local timezone */
const shortTime = (value) => formatFullDateTime(value);

export function Chip({ tone, children }) {
  return <span className={`eodsch-chip eodsch-tone-${tone}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Log viewer                                                          */
/* ------------------------------------------------------------------ */

export function LogViewer({ env, runId, jobs = [], running, job: jobProp, onJobChange }) {
  const toast = useToast();
  const [innerJob, setInnerJob] = useState('');
  const job = jobProp ?? innerJob;
  const setJob = onJobChange ?? setInnerJob;
  const [wrap, setWrap] = useState(false);
  const bodyRef = useRef(null);

  // Only a 404 means "no log yet". Any other failure is shown, not hidden.
  const log = useResource(async () => {
    try {
      return toLogText(await svc.getRunLog(env, runId, job));
    } catch (err) {
      if (err?.status === 404 || err?.response?.status === 404) return NO_LOG;
      throw err;
    }
  }, [env, runId, job]);
  usePolling(() => log.reload(true), 4000, running);

  // keep the newest lines in view while the run is live
  useEffect(() => {
    if (running && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [log.data, running]);

  const text = log.data || '';
  const failed = Boolean(log.error) && !log.data;
  const empty = !log.loading && !failed && (!text.trim() || text === NO_LOG);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Log copied.');
    } catch {
      toast.error('Could not copy the log.');
    }
  };

  return (
    <div className="eodsch-card eodr-root eodr-log" id="eodr-log">
      <div className="eodr-log-bar">
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
        {running ? <span className="eodr-live">Live</span> : null}
        <div className="eodr-spacer" />
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={WrapText}
          onClick={() => setWrap((w) => !w)}
          aria-pressed={wrap}
          aria-label="Toggle line wrap"
        />
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={Copy}
          onClick={copy}
          disabled={empty}
          aria-label="Copy the log"
        />
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
      <div className="eodr-log-body" ref={bodyRef} data-wrap={wrap}>
        {log.loading && !log.data ? (
          <p className="eodr-log-empty">Loading…</p>
        ) : failed ? (
          <p className="eodr-log-empty">Could not load the log.</p>
        ) : empty ? (
          <p className="eodr-log-empty">
            {job ? `No log for ${job} yet. Skipped jobs never produce one.` : 'No log yet.'}
          </p>
        ) : (
          <pre className="eodr-log-text">{text}</pre>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Run detail                                                          */
/* ------------------------------------------------------------------ */

function JobProgress({ jobs }) {
  const counts = { ok: 0, bad: 0, run: 0, skip: 0, other: 0 };
  jobs.forEach((j) => {
    counts[statusGroup(j.status)] += 1;
  });
  const total = jobs.length || 1;
  const legend = [
    ['ok', 'succeeded'],
    ['bad', 'failed'],
    ['run', 'running'],
    ['skip', 'skipped'],
    ['other', 'other'],
  ].filter(([key]) => counts[key]);

  return (
    <div className="eodr-progress">
      <div
        className="eodr-progress-bar"
        role="img"
        aria-label={legend.map(([k, label]) => `${counts[k]} ${label}`).join(', ')}
      >
        {legend.map(([key]) => (
          <span
            key={key}
            className={`eodr-seg eodr-seg-${key}`}
            style={{ width: `${(counts[key] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="eodr-progress-legend">
        <strong>{jobs.length} jobs</strong>
        {legend.map(([key, label]) => (
          <span key={key} className="eodr-legend-item">
            <i className={`eodr-dot eodr-seg-${key}`} />
            {counts[key]} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function JobRow({ j, maxSeconds, onShowLog, active }) {
  const [open, setOpen] = useState(false);
  const seconds = j.duration ?? secondsBetween(j.started, j.ended);
  const reason = j.reason || '';
  const long = reason.length > 90;
  const pct = seconds && maxSeconds ? Math.max(4, Math.round((seconds / maxSeconds) * 100)) : 0;
  const group = statusGroup(j.status);

  return (
    <tr className={`eodr-job eodr-job-${group}`} data-active={active}>
      <td className="eodr-job-name">{j.job}</td>
      <td>
        <Chip tone={jobTone(j.status)}>{j.status}</Chip>
      </td>
      <td className="eodr-num">{j.attempts}</td>
      <td className="eodr-num">{j.exit_code ?? '—'}</td>
      <td className="eodr-time">
        <span>{formatDuration(seconds)}</span>
        {pct ? (
          <span className="eodr-timebar">
            <span style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </td>
      <td className="eodr-why">
        <span className="eodr-why-text" data-open={open} title={open ? undefined : reason}>
          {reason || '—'}
        </span>
        {long ? (
          <button type="button" className="eodsch-link eodr-more" onClick={() => setOpen((o) => !o)}>
            {open ? 'less' : 'more'}
          </button>
        ) : null}
      </td>
      <td>
        <button
          type="button"
          className="eodsch-link"
          onClick={() => onShowLog(j.job)}
          aria-label={`Show the log of ${j.job}`}
        >
          Log
        </button>
      </td>
    </tr>
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
  const [jobFilter, setJobFilter] = useState('all');
  const [logJob, setLogJob] = useState('');
  const running = detail.data?.run?.status === 'RUNNING';
  usePolling(() => detail.reload(true), 4000, running);

  useEffect(() => {
    if (detail.data && !running) onChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const jobs = useMemo(() => detail.data?.jobs ?? [], [detail.data]);
  const maxSeconds = useMemo(
    () => Math.max(0, ...jobs.map((j) => j.duration ?? secondsBetween(j.started, j.ended) ?? 0)),
    [jobs],
  );

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

  const showLog = (jobName) => {
    setLogJob(jobName);
    document.getElementById('eodr-log')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  if (detail.loading && !detail.data) return <p className="eodsch-muted">Loading the run…</p>;
  if (detail.error && !detail.data)
    return (
      <div className="eodsch-error" role="alert">
        {detail.error}
      </div>
    );
  const { run } = detail.data;
  const attempts = detail.data.attempts ?? [];
  const conditions = detail.data.conditions ?? [];
  const notOk = jobs.filter((j) => statusGroup(j.status) !== 'ok');
  const visibleJobs = jobFilter === 'issues' ? notOk : jobs;
  const duration = run.ended ? secondsBetween(run.started, run.ended) : null;

  const meta = [
    ['Type', run.run_type],
    ['Business date', run.odate],
    ['Started', shortTime(run.started)],
    ['Ended', run.ended ? shortTime(run.ended) : 'still running'],
    ['Duration', duration != null ? formatDuration(duration) : running ? 'running…' : '—'],
    ['Started by', run.started_by || '—'],
    ['Approved by', run.approved_by || '—'],
  ];

  return (
    <div className="eodr-root eodr-stack">
      {detail.error ? (
        <div className="eodsch-notice eodsch-notice-warn" role="status">
          Couldn't refresh this run: {detail.error}
        </div>
      ) : null}

      <div className="eodsch-card eodr-summary">
        <div className="eodr-summary-head">
          <div className="eodr-title">
            <strong className="eodr-run-id">{run.run_id}</strong>
            {run.name && (
              <span style={{ fontWeight: 600, color: 'var(--c-primary, #005a36)', marginLeft: '8px', marginRight: '8px' }}>
                · {run.name}
              </span>
            )}
            <Chip tone={runTone(run.status)}>{run.status}</Chip>
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

        <dl className="eodr-meta">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {run.message ? <p className="eodr-message">{run.message}</p> : null}

        <JobProgress jobs={jobs} />
      </div>

      <div className="eodsch-card eodr-jobs">
        <div className="eodr-jobs-bar">
          <strong>Jobs</strong>
          <div className="eodr-seg-toggle" role="group" aria-label="Filter jobs">
            <button
              type="button"
              data-active={jobFilter === 'all'}
              onClick={() => setJobFilter('all')}
            >
              All ({jobs.length})
            </button>
            <button
              type="button"
              data-active={jobFilter === 'issues'}
              onClick={() => setJobFilter('issues')}
              disabled={!notOk.length}
            >
              Not successful ({notOk.length})
            </button>
          </div>
        </div>
        <div className="eodsch-table-wrap">
          <table className="eodsch-table eodr-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th className="eodr-num">Tries</th>
                <th className="eodr-num">Exit</th>
                <th>Time</th>
                <th>Why</th>
                <th aria-label="Log" />
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((j) => (
                <JobRow
                  key={j.job}
                  j={j}
                  maxSeconds={maxSeconds}
                  active={logJob === j.job}
                  onShowLog={showLog}
                />
              ))}
              {!visibleJobs.length ? (
                <tr>
                  <td colSpan={7} className="eodsch-muted">
                    No jobs to show.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {conditions.length ? (
          <details className="eodr-details">
            <summary>{conditions.length} condition(s) set</summary>
            <div className="eodr-conditions">
              {conditions.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
          </details>
        ) : null}

        {attempts.length ? (
          <details className="eodr-details">
            <summary>{attempts.length} attempt(s)</summary>
            <div className="eodsch-table-wrap">
              <table className="eodsch-table eodr-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th className="eodr-num">#</th>
                    <th>Status</th>
                    <th className="eodr-num">Exit</th>
                    <th>Time</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={`${a.job}-${a.attempt}`}>
                      <td className="eodr-job-name">{a.job}</td>
                      <td className="eodr-num">{a.attempt}</td>
                      <td>
                        <Chip tone={jobTone(a.status)}>{a.status}</Chip>
                      </td>
                      <td className="eodr-num">{a.exit_code ?? '—'}</td>
                      <td>{formatDuration(a.duration)}</td>
                      <td className="eodr-why" title={a.error}>
                        <span className="eodr-why-text">{a.error || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>

      <LogViewer
        env={env}
        runId={runId}
        jobs={jobs}
        running={running}
        job={logJob}
        onJobChange={setLogJob}
      />

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

/* ------------------------------------------------------------------ */
/* Run list                                                            */
/* ------------------------------------------------------------------ */

/** Run history of one environment with per-job results, attempts and logs. Refreshes while a run is active. */
export function RunsPanel({ env, focusRun }) {
  const runs = useResource(() => svc.listRuns(env), [env]);
  const [selected, setSelected] = useState(focusRun || '');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const anyRunning = (runs.data ?? []).some((r) => r.status === 'RUNNING');
  // fast while a run is live; every 20s otherwise (only a scheduled run starting needs noticing then)
  const anyRunLive = (runs.data ?? []).some((r) =>
    ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase()),
  );
  usePolling(() => runs.reload(true), anyRunLive ? 5000 : 20000, true);

  useEffect(() => {
    if (focusRun) setSelected(focusRun);
  }, [focusRun]);

  const all = useMemo(() => runs.data ?? [], [runs.data]);
  const statuses = useMemo(() => [...new Set(all.map((r) => r.status).filter(Boolean))], [all]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!statusFilter || r.status === statusFilter) &&
        (!q ||
          [r.run_id, r.run_type, r.started_by, r.approved_by].some((v) =>
            String(v || '')
              .toLowerCase()
              .includes(q),
          )),
    );
  }, [all, query, statusFilter]);

  if (runs.loading && !runs.data) return <p className="eodsch-muted">Loading runs…</p>;
  if (runs.error && !runs.data)
    return (
      <div className="eodsch-error" role="alert">
        {runs.error}
      </div>
    );

  return (
    <div className="eodr-root eodr-layout">
      <aside className="eodsch-card eodr-list">
        <div className="eodr-list-head">
          <strong>Runs</strong>
          <span className="eodr-count">{all.length}</span>
          {anyRunning ? <Chip tone="run">live</Chip> : null}
        </div>

        <div className="eodr-filters">
          <label className="eodr-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search runs"
              aria-label="Search runs"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {runs.error ? (
          <div className="eodsch-notice eodsch-notice-warn" role="status">
            Couldn't refresh runs: {runs.error}
          </div>
        ) : null}

        <ul className="eodr-items">
          {shown.map((r) => (
            <li key={r.run_id}>
              <button
                type="button"
                className="eodr-item"
                data-selected={r.run_id === selected}
                aria-pressed={r.run_id === selected}
                onClick={() => setSelected(r.run_id)}
              >
                <span className="eodr-item-top">
                  <span className="eodr-item-id">{r.run_id}</span>
                  <Chip tone={runTone(r.status)}>{r.status}</Chip>
                </span>
                <span className="eodr-item-sub">
                  {r.run_type} · {shortTime(r.started)}
                  {r.started_by ? ` · ${r.started_by}` : ''}
                </span>
              </button>
            </li>
          ))}
          {!shown.length ? (
            <li className="eodsch-muted eodr-empty">
              {all.length ? 'No runs match the filter.' : 'No runs yet in this environment.'}
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="eodr-main">
        {selected ? (
          <RunDetail
            key={selected}
            env={env}
            runId={selected}
            onChanged={() => runs.reload(true)}
          />
        ) : (
          <div className="eodsch-card eodr-placeholder">
            <strong>Select a run</strong>
            <p className="eodsch-muted">Pick a run on the left to see its jobs, attempts and logs.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default RunsPanel;