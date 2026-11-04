import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Play, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import {
  approvalState,
  filterJobs,
  groupMessages,
  isHHMM,
  nodeStates,
  targetLabel,
} from '../schedulerModel';
import { useResource } from '../useResource';
import { DependencyGraph } from './DependencyGraph';

const ROW_LIMIT = 200;

function Problems({ title, tone, messages, open }) {
  const groups = useMemo(() => groupMessages(messages), [messages]);
  if (!groups.length) return null;
  return (
    <details className={`eodsch-problems eodsch-problems-${tone}`} open={open}>
      <summary>
        {title} ({messages.length})
      </summary>
      <ul>
        {groups.map((g) => (
          <li key={g.text}>
            {g.count > 1 ? <strong>{g.count} jobs: </strong> : null}
            {g.text}
            {g.where.length ? (
              <span className="eodsch-muted">
                {' '}
                — {g.where.join(', ')}
                {g.count > g.where.length ? ', …' : ''}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function JobDetails({ job }) {
  if (!job)
    return (
      <p className="eodsch-muted">
        Select a job in the table or the graph to see its command and target.
      </p>
    );
  return (
    <dl className="eodsch-details">
      <dt>Job</dt>
      <dd>{job.name}</dd>
      <dt>Command</dt>
      <dd>
        <code>{job.command || '—'}</code>
      </dd>
      {job.command_ok ? (
        <>
          <dt>Runs as</dt>
          <dd>
            <code>{[job.executable, ...(job.args ?? [])].join(' ')}</code>
          </dd>
        </>
      ) : (
        <>
          <dt>Command problems</dt>
          <dd>
            {(job.command_issues ?? []).map(([code, reason]) => `${code}: ${reason}`).join('; ') ||
              'not permitted'}
          </dd>
        </>
      )}
      <dt>Target</dt>
      <dd>
        {job.target?.ok
          ? `${job.target.target_name} (${targetLabel(job.target)})`
          : job.target?.message || '—'}
      </dd>
      <dt>NODEID</dt>
      <dd>{job.nodeid || '—'}</dd>
      <dt>Schedule</dt>
      <dd>{job.schedule}</dd>
      <dt>Waits for</dt>
      <dd>{job.waits_for?.length ? `${job.waits_for.join(', ')} (${job.logic})` : '—'}</dd>
      <dt>Produces</dt>
      <dd>{job.produces?.length ? job.produces.join(', ') : '—'}</dd>
      <dt>Retries</dt>
      <dd>{job.retries}</dd>
    </dl>
  );
}

/** Upload, review, approve and start the active workflow of one environment. */
export function WorkflowPanel({ env, onRunStarted }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const wf = useResource(() => svc.getWorkflow(env), [env]);
  const runs = useResource(() => svc.listRuns(env), [env]);
  const [folderIdx, setFolderIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [colourRun, setColourRun] = useState('');
  const detail = useResource(
    () => (colourRun ? svc.getRun(env, colourRun) : Promise.resolve(null)),
    [env, colourRun],
  );
  const [runOpen, setRunOpen] = useState(false);
  const [runForm, setRunForm] = useState({ reference: '', overlap: false, sure: false });

  const view = wf.data;
  const state = approvalState(view, hasPermission);
  const folder = view?.folders?.[Math.min(folderIdx, (view?.folders?.length ?? 1) - 1)];
  const jobs = useMemo(() => filterJobs(folder?.jobs ?? [], query), [folder, query]);
  const shown = showAll ? jobs : jobs.slice(0, ROW_LIMIT);
  const job = folder?.jobs?.find((j) => j.name === selected) ?? null;
  const states = useMemo(() => nodeStates(detail.data), [detail.data]);

  const guarded = async (fn, ok) => {
    setBusy(true);
    try {
      const result = await fn();
      if (ok) toast.success(ok);
      return result;
    } catch (err) {
      toast.error(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const upload = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const done = await guarded(
      () => svc.uploadWorkflow(env, file),
      `${file.name} uploaded. Review it before approving.`,
    );
    if (done) {
      setReviewed(false);
      setSelected(null);
      setFolderIdx(0);
      setColourRun('');
      wf.reload();
    }
  };

  const approve = async () => {
    const done = await guarded(
      () => svc.approve(env, view.approval.digest),
      'Approved. Nothing runs until you start it or switch the scheduler on.',
    );
    if (done) {
      setReviewed(false);
      wf.reload();
    }
  };

  const startRun = async () => {
    const body = { allow_overlap: runForm.overlap };
    if (runForm.reference) body.reference = runForm.reference;
    setBusy(true);
    try {
      const { command_id: id } = await svc.runNow(env, body);
      let answer = null;
      for (let i = 0; i < 34; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        answer = await svc.getCommand(env, id);
        if (!['PENDING', 'CLAIMED'].includes(answer.status)) break;
      }
      if (answer?.status === 'DONE') {
        toast.success('The engine accepted the run.');
        setRunOpen(false);
        onRunStarted?.(answer.result?.runs?.[0]?.run_id);
      } else if (answer && !['PENDING', 'CLAIMED'].includes(answer.status)) {
        toast.error(answer.result?.message || `The engine answered ${answer.status}.`);
      } else {
        toast.error(
          'No engine answered within 30 seconds, so the request has expired and nothing was started. Make sure an engine is running for this environment (the bar at the top says whether one is serving it), then try again.',
        );
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const refMsg =
    runForm.reference && !isHHMM(runForm.reference) ? 'Use HH:MM, for example 18:30.' : '';

  if (wf.loading && !view) return <p className="eodsch-muted">Loading the workflow…</p>;
  if (wf.error) {
    return (
      <div className="eodsch-error" role="alert">
        {wf.error}{' '}
        <Button size="sm" variant="outline" onClick={() => wf.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="eodsch-stack">
      <div className="eodsch-toolbar">
        <div>
          {view.loaded ? (
            <>
              <strong>{view.meta.filename}</strong>
              <span className="eodsch-muted">
                {' '}
                uploaded {new Date(view.meta.uploaded_at).toLocaleString()} by{' '}
                {view.meta.uploaded_by || 'unknown'} · sha256 {view.meta.sha256.slice(0, 12)}…
              </span>
            </>
          ) : (
            <span className="eodsch-muted">
              No workflow has been uploaded to this environment yet.
            </span>
          )}
        </div>
        <div className="eodsch-actions">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={RefreshCw}
            onClick={() => wf.reload()}
            aria-label="Reload the review"
          />
          {hasPermission('EOD_SCHEDULER_UPLOAD') ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                hidden
                onChange={upload}
                aria-label="Control-M XML file"
              />
              <Button
                variant="outline"
                size="sm"
                leadingIcon={Upload}
                isLoading={busy}
                onClick={() => fileRef.current?.click()}
              >
                Upload Control-M XML
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {view.loaded ? (
        <>
          <div className="eodsch-stats">
            {[
              ['Workflows', view.summary.folders],
              ['Jobs', view.summary.jobs],
              ['Dependencies', view.summary.dependencies],
              ['Timed jobs', view.summary.timed_jobs],
              ['External conditions', view.summary.external_conditions],
              ['Warnings', view.summary.warnings],
              ['Errors', view.summary.errors],
            ].map(([label, value]) => (
              <div key={label} className="eodsch-stat" data-bad={label === 'Errors' && value > 0}>
                <span className="eodsch-stat-value">{value ?? 0}</span>
                <span className="eodsch-stat-label">{label}</span>
              </div>
            ))}
          </div>

          <Problems title="Problems to fix" tone="bad" messages={view.errors} open />
          <Problems title="Notes and warnings" tone="warn" messages={view.warnings} />

          <div className={`eodsch-approval eodsch-approval-${state.state}`}>
            <div className="eodsch-approval-text">
              {state.state === 'approved' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
              <div>
                <strong>{state.label}</strong>
                <div className="eodsch-muted">
                  {state.state === 'approved'
                    ? `Approved by ${view.meta.approved_by || 'unknown'} ${view.meta.approved_at ? `on ${new Date(view.meta.approved_at).toLocaleString()}` : ''}. Changing the file, a setting, a target server or a mapping cancels the approval.`
                    : 'Approval covers exactly the commands, target servers and settings shown below.'}
                </div>
              </div>
            </div>
            <div className="eodsch-actions">
              {state.state === 'pending' && state.canApprove ? (
                <>
                  <label className="eodsch-check">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    I reviewed the commands, targets and schedule
                  </label>
                  <Button size="sm" disabled={!reviewed} isLoading={busy} onClick={approve}>
                    Approve
                  </Button>
                </>
              ) : null}
              {state.state === 'approved' && state.canRun ? (
                <Button
                  size="sm"
                  leadingIcon={Play}
                  onClick={() => {
                    setRunForm({ reference: '', overlap: false, sure: false });
                    setRunOpen(true);
                  }}
                >
                  Run all now
                </Button>
              ) : null}
            </div>
          </div>

          <div className="eodsch-card">
            <div className="eodsch-toolbar">
              <div className="eodsch-actions">
                {view.folders.length > 1 ? (
                  <label className="eodsch-field-inline">
                    Workflow
                    <select
                      value={folderIdx}
                      onChange={(e) => {
                        setFolderIdx(Number(e.target.value));
                        setSelected(null);
                      }}
                    >
                      {view.folders.map((f, i) => (
                        <option key={f.folder} value={i}>
                          {f.folder} ({f.jobs.length})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <strong>{folder?.folder}</strong>
                )}
                <label className="eodsch-field-inline">
                  Colour by run
                  <select value={colourRun} onChange={(e) => setColourRun(e.target.value)}>
                    <option value="">none</option>
                    {(runs.data ?? [])
                      .filter((r) => r.folder === folder?.folder)
                      .map((r) => (
                        <option key={r.run_id} value={r.run_id}>
                          {r.run_id} ({r.status})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <input
                className="eodsch-search"
                type="search"
                placeholder="Filter jobs, commands, targets…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter jobs"
              />
            </div>
            {folder ? (
              <DependencyGraph
                graph={folder.graph}
                states={states}
                selected={selected}
                onSelect={setSelected}
              />
            ) : null}
          </div>

          <div className="eodsch-split">
            <div className="eodsch-card eodsch-table-wrap">
              <table className="eodsch-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Schedule</th>
                    <th>Waits for</th>
                    <th>Target</th>
                    <th>Command</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((j) => (
                    <tr key={j.name} data-selected={j.name === selected}>
                      <td>
                        <button
                          type="button"
                          className="eodsch-link"
                          onClick={() => setSelected(j.name)}
                          aria-pressed={j.name === selected}
                        >
                          {j.name}
                        </button>
                      </td>
                      <td>{j.schedule}</td>
                      <td>{j.waits_for.length ? j.waits_for.length : '—'}</td>
                      <td data-bad={!j.target?.ok}>{targetLabel(j.target)}</td>
                      <td className="eodsch-cell-command" title={j.command}>
                        {j.command || '—'}
                      </td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={5} className="eodsch-muted">
                        No job matches.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {!showAll && jobs.length > ROW_LIMIT ? (
                <div className="eodsch-more">
                  Showing {ROW_LIMIT} of {jobs.length} jobs.{' '}
                  <button type="button" className="eodsch-link" onClick={() => setShowAll(true)}>
                    Show all
                  </button>
                </div>
              ) : null}
            </div>
            <div className="eodsch-card eodsch-side">
              <JobDetails job={job} />
            </div>
          </div>
        </>
      ) : null}

      <AdminModal
        title="Run all now"
        isOpen={runOpen}
        onClose={() => !busy && setRunOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRunOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={startRun} isLoading={busy} disabled={!runForm.sure || Boolean(refMsg)}>
              Start now
            </Button>
          </>
        }
      >
        <p>
          This starts the approved workflow in <strong>{env}</strong> on its target servers now. The
          earliest job starts at the reference time and the others keep their original gaps. The
          normal schedule is not changed.
        </p>
        <label className="eodsch-field">
          Reference time (optional, HH:MM, default now)
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 14:00"
            value={runForm.reference}
            onChange={(e) => setRunForm({ ...runForm, reference: e.target.value.trim() })}
          />
          {refMsg ? <small className="eodsch-bad">{refMsg}</small> : null}
        </label>
        <label className="eodsch-check">
          <input
            type="checkbox"
            checked={runForm.overlap}
            onChange={(e) => setRunForm({ ...runForm, overlap: e.target.checked })}
          />
          Allow it to overlap a run that is still active
        </label>
        <label className="eodsch-check">
          <input
            type="checkbox"
            checked={runForm.sure}
            onChange={(e) => setRunForm({ ...runForm, sure: e.target.checked })}
          />
          I understand this really runs the commands on the target servers
        </label>
      </AdminModal>
    </div>
  );
}

export default WorkflowPanel;
