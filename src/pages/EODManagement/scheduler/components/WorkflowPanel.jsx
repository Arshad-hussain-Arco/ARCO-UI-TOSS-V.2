import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import {
  approvalState,
  filterJobs,
  groupMessages,
  nodeStates,
  targetLabel,
} from '../schedulerModel';
import { usePolling, useResource } from '../useResource';
import { DependencyGraph } from './DependencyGraph';
import { DeleteDialog } from './DeleteDialog';
import { FolderFormModal } from './FolderFormModal';
import { JobFormModal } from './JobFormModal';
import { WorkflowFilesModal } from './WorkflowFilesModal';

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
  const [filesOpen, setFilesOpen] = useState(false);
  const [jobModal, setJobModal] = useState(null); // { mode: 'add' | 'edit', job? }
  const [folderModal, setFolderModal] = useState(false);
  const [del, setDel] = useState(null); // what the delete dialog is about, see DeleteDialog
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');
  const [colourChoice, setColourChoice] = useState('auto'); // 'auto' follows the live run, 'none', or the run id picked by hand
  const folderName =
    wf.data?.folders?.[Math.min(folderIdx, (wf.data?.folders?.length ?? 1) - 1)]?.folder;
  const folderRuns = (runs.data ?? []).filter((r) => r.folder === folderName); // newest first
  const liveRun = (folderRuns.find((r) => r.status === 'RUNNING') ?? folderRuns[0])?.run_id ?? '';
  const colourRun = colourChoice === 'auto' ? liveRun : colourChoice === 'none' ? '' : colourChoice;
  const detail = useResource(
    () => (colourRun ? svc.getRun(env, colourRun) : Promise.resolve(null)),
    [env, colourRun],
  );
  // the graph is a live view: new runs appear in the list, and the coloured run refreshes while it is running
  const colourRunning = detail.data?.run?.status === 'RUNNING';
  usePolling(() => runs.reload(true), 3000);
  usePolling(() => wf.reload(true), 10000, !busy); // uploads, approvals and settings changes made by someone else
  usePolling(() => detail.reload(true), 2000, colourRunning);

  const view = wf.data;
  const state = approvalState(view, hasPermission);
  const folder = view?.folders?.[Math.min(folderIdx, (view?.folders?.length ?? 1) - 1)];
  const jobs = useMemo(() => filterJobs(folder?.jobs ?? [], query), [folder, query]);
  const shown = showAll ? jobs : jobs.slice(0, ROW_LIMIT);
  const job = folder?.jobs?.find((j) => j.name === selected) ?? null;
  const states = useMemo(() => nodeStates(detail.data), [detail.data]);

  // editing: needs the settings permission and no run in progress (the server enforces both)
  const running = (runs.data ?? []).some((r) => r.status === 'RUNNING');
  const canEdit = hasPermission('EOD_SCHEDULER_SETTINGS');
  const editable = canEdit && !running;
  const editHint = running ? 'A run is in progress in this environment' : undefined;
  const workflowId = view?.meta?.id;
  const baseSha = view?.meta?.sha256;
  const files = view?.workflows ?? [];
  const suggestions = useMemo(() => {
    const all = (view?.folders ?? []).flatMap((f) => f.jobs);
    return {
      nodeids: [...new Set(all.map((j) => j.nodeid).filter(Boolean))].sort(),
      conditions: [
        ...new Set(all.flatMap((j) => [...(j.waits_for ?? []), ...(j.produces ?? [])])),
      ].sort(),
    };
  }, [view]);

  const afterEdit = (message) => {
    toast.success(message);
    setSelected(null);
    wf.reload(true);
  };
  const saveJob = async (payload) => {
    if (jobModal.mode === 'edit') {
      await svc.updateJob(env, workflowId, folderName, jobModal.job, payload);
      afterEdit(`Job ${jobModal.job} saved. Review and approve the workflow again.`);
    } else {
      await svc.addJob(env, workflowId, folderName, payload);
      afterEdit(`Job ${payload.name} added. Review and approve the workflow again.`);
    }
  };
  const saveFolder = async (payload) => {
    await svc.addFolder(env, workflowId, { ...payload, base_sha256: baseSha });
    setFolderIdx(view.folders.length); // the new, last workflow
    afterEdit(`Workflow ${payload.name} added.`);
  };
  const startDelete = async (next) => {
    setDelError('');
    if (next.kind !== 'folder') {
      setDel(next);
      return;
    }
    try {
      // a workflow always asks first: the answer lists its jobs and what would stall
      await svc.deleteFolder(env, workflowId, next.folder, { baseSha256: baseSha });
      setDel(null);
      afterEdit(`Workflow ${next.folder} deleted.`);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.needs_confirm) setDel({ ...next, info: data });
      else {
        setDel(null);
        toast.error(errorText(err));
      }
    }
  };
  const confirmDelete = async () => {
    setDelBusy(true);
    setDelError('');
    const confirm = Boolean(del.info) || del.kind === 'folder';
    try {
      if (del.kind === 'file') {
        await svc.deleteWorkflow(env, del.file.id);
        toast.success(`${del.file.filename} deleted.`);
        wf.reload(true);
      } else if (del.kind === 'folder') {
        await svc.deleteFolder(env, workflowId, del.folder, { confirm, baseSha256: baseSha });
        afterEdit(`Workflow ${del.folder} deleted.`);
      } else {
        await svc.deleteJob(env, workflowId, del.folder, del.job, { confirm, baseSha256: baseSha });
        afterEdit(`Job ${del.job} deleted. Review and approve the workflow again.`);
      }
      setDel(null);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.needs_confirm) setDel({ ...del, info: data });
      else setDelError(errorText(err));
    } finally {
      setDelBusy(false);
    }
  };
  const activate = async (file) => {
    const done = await guarded(
      () => svc.activateWorkflow(env, file.id),
      `${file.filename} is now the active workflow. Review it before approving.`,
    );
    if (done) {
      setSelected(null);
      setFolderIdx(0);
      setColourChoice('auto');
      wf.reload(true);
    }
  };

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
    const done = await guarded(() => svc.uploadWorkflow(env, file));
    if (done) {
      if (done.uploaded?.active) {
        toast.success(`${file.name} uploaded and active. Review it before approving.`);
        setReviewed(false);
        setSelected(null);
        setFolderIdx(0);
        setColourChoice('auto');
      } else {
        toast.success(`${file.name} stored. Choose it in "Workflow file" to review and run it.`);
      }
      wf.reload(true);
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
    setBusy(true);
    try {
      const { command_id: id } = await svc.runNow(env, { allow_overlap: false });
      let answer = null;
      for (let i = 0; i < 34; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        answer = await svc.getCommand(env, id);
        if (!['PENDING', 'CLAIMED'].includes(answer.status)) break;
      }
      if (answer?.status === 'DONE') {
        toast.success('The engine accepted the run.');
        setColourChoice('auto'); // stay on this tab and show the new run in the graph
        runs.reload(true);
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
                {view.meta.uploaded_by || 'unknown'}
                {view.meta.edited_at
                  ? ` · edited ${new Date(view.meta.edited_at).toLocaleString()} by ${view.meta.edited_by || 'unknown'}`
                  : ''}{' '}
                · sha256 {view.meta.sha256.slice(0, 12)}…
              </span>
            </>
          ) : (
            <span className="eodsch-muted">
              No workflow has been uploaded to this environment yet.
            </span>
          )}
        </div>
        <div className="eodsch-actions">
          {files.length ? (
            <>
              <label className="eodsch-field-inline">
                Workflow file
                <select
                  value={files.find((f) => f.active)?.id ?? ''}
                  disabled={busy || !canEdit || running}
                  title={editHint}
                  onChange={(e) => {
                    const file = files.find((f) => String(f.id) === e.target.value);
                    if (file && !file.active) activate(file);
                  }}
                  aria-label="Workflow file"
                >
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.filename}
                      {f.active ? ' (active)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={FileText}
                onClick={() => setFilesOpen(true)}
              >
                Files ({files.length})
              </Button>
            </>
          ) : null}
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
                <Button size="sm" leadingIcon={Play} isLoading={busy} onClick={startRun}>
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
                {canEdit ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      leadingIcon={Plus}
                      disabled={!editable}
                      title={editHint}
                      onClick={() => setFolderModal(true)}
                    >
                      Add workflow
                    </Button>
                    {folder ? (
                      <Button
                        size="sm"
                        variant="outline"
                        leadingIcon={Trash2}
                        disabled={!editable}
                        title={editHint}
                        onClick={() => startDelete({ kind: 'folder', folder: folder.folder })}
                      >
                        Delete workflow
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <label className="eodsch-field-inline">
                  Colour by run
                  <select
                    value={colourRun || 'none'}
                    onChange={(e) => {
                      const v = e.target.value;
                      // picking the run that is being followed keeps following; any other run is a manual choice
                      setColourChoice(v === liveRun ? 'auto' : v);
                    }}
                  >
                    <option value="none">none</option>
                    {(runs.data ?? [])
                      .filter((r) => r.folder === folder?.folder)
                      .map((r) => (
                        <option key={r.run_id} value={r.run_id}>
                          {r.run_id} ({r.status})
                        </option>
                      ))}
                  </select>
                </label>
                {colourChoice !== 'auto' && liveRun ? (
                  <Button size="sm" variant="outline" onClick={() => setColourChoice('auto')}>
                    Follow the live run
                  </Button>
                ) : null}
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
              {canEdit && folder ? (
                <div className="eodsch-toolbar">
                  <span className="eodsch-muted">
                    {folder.jobs.length} job(s) in {folder.folder}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    leadingIcon={Plus}
                    disabled={!editable}
                    title={editHint}
                    onClick={() => setJobModal({ mode: 'add' })}
                  >
                    Add job
                  </Button>
                </div>
              ) : null}
              <table className="eodsch-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Schedule</th>
                    <th>Waits for</th>
                    <th>Target</th>
                    <th>Command</th>
                    {canEdit ? <th aria-label="Actions" /> : null}
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
                      {canEdit ? (
                        <td>
                          <div className="eodsch-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={Pencil}
                              disabled={!editable}
                              title={editHint ?? `Edit ${j.name}`}
                              aria-label={`Edit ${j.name}`}
                              onClick={() => setJobModal({ mode: 'edit', job: j.name })}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={Trash2}
                              disabled={!editable}
                              title={editHint ?? `Delete ${j.name}`}
                              aria-label={`Delete ${j.name}`}
                              onClick={() =>
                                startDelete({ kind: 'job', folder: folder.folder, job: j.name })
                              }
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={canEdit ? 6 : 5} className="eodsch-muted">
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
      <WorkflowFilesModal
        isOpen={filesOpen}
        onClose={() => setFilesOpen(false)}
        files={files}
        canManage={canEdit}
        canRun={!running}
        busy={busy}
        onActivate={async (f) => {
          await activate(f);
          setFilesOpen(false);
        }}
        onDelete={(f) => setDel({ kind: 'file', file: f })}
      />
      <JobFormModal
        isOpen={Boolean(jobModal)}
        onClose={() => setJobModal(null)}
        mode={jobModal?.mode}
        env={env}
        workflowId={workflowId}
        folder={folderName}
        job={jobModal?.job}
        baseSha256={baseSha}
        nodeids={suggestions.nodeids}
        conditions={suggestions.conditions}
        onSave={saveJob}
      />
      <FolderFormModal
        isOpen={folderModal}
        onClose={() => setFolderModal(false)}
        onSave={saveFolder}
      />
      <DeleteDialog
        state={del}
        busy={delBusy}
        error={delError}
        onClose={() => setDel(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default WorkflowPanel;
