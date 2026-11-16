import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
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
  mergeFolderGraphs,
  nodeStates,
  targetLabel,
} from '../schedulerModel';
import { usePolling, useResource } from '../useResource';
import { DependencyGraph } from './DependencyGraph';
import { DeleteDialog } from './DeleteDialog';
import { FolderFormModal } from './FolderFormModal';
import { JobFormModal } from './JobFormModal';
import { WorkflowFilesModal } from './WorkflowFilesModal';

import './WorkflowPanel.css';

const ROW_LIMIT = 200;

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '—');

function Problems({ title, tone, messages, open }) {
  const groups = useMemo(() => groupMessages(messages), [messages]);
  if (!groups.length) return null;
  return (
    <details className={`eodw-problems eodw-problems-${tone}`} open={open}>
      <summary>
        <span className="eodw-problems-title">{title}</span>
        <span className="eodw-problems-count">{messages.length}</span>
      </summary>
      <ul>
        {groups.map((g) => (
          <li key={g.text}>
            {g.count > 1 ? <strong>{g.count} jobs: </strong> : null}
            {g.text}
            {g.where.length ? (
              <span className="eodw-muted">
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
      <div className="eodw-side-empty">
        <strong>No job selected</strong>
        <p className="eodw-muted">
          Select a job in the table or the graph to see its command and target.
        </p>
      </div>
    );

  const rows = [
    ['NODEID', job.nodeid || '—'],
    ['Schedule', job.schedule || '—'],
    ['Retries', job.retries ?? '—'],
    [
      'Waits for',
      job.waits_for?.length ? `${job.waits_for.join(', ')} (${job.logic})` : '—',
    ],
    ['Produces', job.produces?.length ? job.produces.join(', ') : '—'],
  ];

  return (
    <div className="eodw-side">
      <div className="eodw-side-head">
        <strong className="eodw-side-title">{job.name}</strong>
        <span className="eodw-pill" data-ok={Boolean(job.command_ok)}>
          {job.command_ok ? 'Command permitted' : 'Command blocked'}
        </span>
      </div>

      <section>
        <h4>Command</h4>
        <pre className="eodw-code">{job.command || '—'}</pre>
        {job.command_ok ? (
          <>
            <h4>Runs as</h4>
            <pre className="eodw-code">{[job.executable, ...(job.args ?? [])].join(' ')}</pre>
          </>
        ) : (
          <div className="eodw-issue">
            {(job.command_issues ?? []).map(([code, reason]) => `${code}: ${reason}`).join('; ') ||
              'not permitted'}
          </div>
        )}
      </section>

      <section>
        <h4>Target</h4>
        <div className="eodw-target" data-ok={Boolean(job.target?.ok)}>
          {job.target?.ok
            ? `${job.target.target_name} (${targetLabel(job.target)})`
            : job.target?.message || '—'}
        </div>
      </section>

      <dl className="eodw-kv">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Upload, review, approve and start the active workflow of one environment. */
export function WorkflowPanel({ env, onRunStarted }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const wf = useResource(() => svc.getWorkflow(env), [env]);
  const runs = useResource(() => svc.listRuns(env), [env]);
  const [folderChoice, setFolderChoice] = useState('ALL');
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
  const view = wf.data;
  const isAll = folderChoice === 'ALL' || !view?.folders?.length;
  const folderIdx = isAll ? 0 : Number(folderChoice);
  const folder = view?.folders?.[Math.min(folderIdx, (view?.folders?.length ?? 1) - 1)];
  const folderName = isAll ? null : folder?.folder;
  const folderRuns = isAll
    ? (runs.data ?? [])
    : (runs.data ?? []).filter((r) => r.folder === folderName); // newest first
  const liveRun = (folderRuns.find((r) => r.status === 'RUNNING') ?? folderRuns[0])?.run_id ?? '';
  const colourRun = colourChoice === 'auto' ? liveRun : colourChoice === 'none' ? '' : colourChoice;
  const detail = useResource(
    () => (colourRun ? svc.getRun(env, colourRun) : Promise.resolve(null)),
    [env, colourRun],
  );
  // the graph is a live view: new runs appear in the list, and the coloured run refreshes while it is running
  const colourRunning = detail.data?.run?.status === 'RUNNING';
  // fast while a run is live; when nothing runs, only a scheduled run starting needs noticing (actions here reload at once anyway)
  const anyRunLive = (runs.data ?? []).some((r) =>
    ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase()),
  );
  usePolling(() => runs.reload(true), anyRunLive ? 3000 : 20000);
  usePolling(() => wf.reload(true), 10000, !busy); // uploads, approvals and settings changes made by someone else
  usePolling(() => detail.reload(true), 2000, colourRunning);

  const state = approvalState(view, hasPermission);

  const allFolderJobs = useMemo(() => {
    return (view?.folders ?? []).flatMap((f) =>
      (f.jobs || []).map((j) => ({ ...j, folder: f.folder }))
    );
  }, [view]);

  const activeJobs = useMemo(() => {
    if (isAll) return allFolderJobs;
    return (folder?.jobs || []).map((j) => ({ ...j, folder: folder?.folder }));
  }, [isAll, allFolderJobs, folder]);

  const jobs = useMemo(() => filterJobs(activeJobs, query), [activeJobs, query]);
  const shown = showAll ? jobs : jobs.slice(0, ROW_LIMIT);
  const job = allFolderJobs.find((j) => j.name === selected) ?? null;
  const states = useMemo(() => nodeStates(detail.data), [detail.data]);

  const graph = useMemo(() => {
    if (!view?.folders?.length) return { nodes: [], edges: [] };
    if (!isAll && folder?.graph) {
      return folder.graph;
    }
    return mergeFolderGraphs(view.folders);
  }, [view, isAll, folder]);

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
    const targetFolder = jobModal?.folder || folderName || payload.folder;
    if (jobModal.mode === 'edit') {
      await svc.updateJob(env, workflowId, targetFolder, jobModal.job, payload);
      afterEdit(`Job ${jobModal.job} saved. Review and approve the workflow again.`);
    } else {
      await svc.addJob(env, workflowId, targetFolder, payload);
      afterEdit(`Job ${payload.name} added. Review and approve the workflow again.`);
    }
  };
  const saveFolder = async (payload) => {
    await svc.addFolder(env, workflowId, { ...payload, base_sha256: baseSha });
    setFolderChoice(String(view.folders.length)); // the new, last workflow
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
      setFolderChoice('ALL');
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

    const cleanName = (file.name || '').trim();

    // 1. Check if a file with the exact same name already exists in this environment
    const duplicateByName = files.find(
      (f) => (f.filename || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicateByName) {
      toast.error(`Workflow file "${cleanName}" already exists in this environment. Redundant file uploads are not accepted.`);
      return;
    }

    // 2. Check if identical content (SHA-256) already exists in this environment
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const duplicateByHash = files.find(
        (f) => (f.sha256 || '').trim().toLowerCase() === fileHash.toLowerCase()
      );
      if (duplicateByHash) {
        toast.error(`An identical workflow already exists as "${duplicateByHash.filename}". Duplicate files are not accepted.`);
        return;
      }
    } catch {
      // Proceed if crypto digest unavailable
    }

    const done = await guarded(() => svc.uploadWorkflow(env, file));
    if (done) {
      if (done.uploaded?.active) {
        toast.success(`${file.name} uploaded and active. Review it before approving.`);
        setReviewed(false);
        setSelected(null);
        setFolderChoice('ALL');
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
  // a failed background refresh must not replace a workflow that is already on screen
  if (wf.error && !view) {
    return (
      <div className="eodsch-error" role="alert">
        {wf.error}{' '}
        <Button size="sm" variant="outline" onClick={() => wf.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const canUpload = hasPermission('EOD_SCHEDULER_UPLOAD');
  const stats = [
    ['Workflows', view.summary?.folders, ''],
    ['Jobs', view.summary?.jobs, ''],
    ['Dependencies', view.summary?.dependencies, ''],
    ['Timed jobs', view.summary?.timed_jobs, ''],
    ['External conditions', view.summary?.external_conditions, ''],
    ['Warnings', view.summary?.warnings, 'warn'],
    ['Errors', view.summary?.errors, 'bad'],
  ];

  return (
    <div className="eodw-root eodw-stack">
      {wf.error && view ? (
        <div className="eodsch-notice eodsch-notice-warn" role="status">
          Couldn&apos;t refresh the workflow: {wf.error}
        </div>
      ) : null}

      {/* ---------- file header ---------- */}
      <div className="eodsch-card eodw-header">
        <div className="eodw-header-info">
          {view.loaded ? (
            <>
              <div className="eodw-file">
                <FileText size={18} aria-hidden="true" />
                <strong>{view.meta.filename}</strong>
              </div>
              <div className="eodw-meta">
                <span>
                  Uploaded {formatWhen(view.meta.uploaded_at)} by{' '}
                  {view.meta.uploaded_by || 'unknown'}
                </span>
                {view.meta.edited_at ? (
                  <span>
                    Edited {formatWhen(view.meta.edited_at)} by {view.meta.edited_by || 'unknown'}
                  </span>
                ) : null}
                <span title={view.meta.sha256}>
                  sha256 <code>{view.meta.sha256.slice(0, 12)}…</code>
                </span>
              </div>
            </>
          ) : (
            <span className="eodw-muted">
              No workflow has been uploaded to this environment yet.
            </span>
          )}
        </div>
        <div className="eodw-header-actions">
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
          {canUpload ? (
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

      {!view.loaded ? (
        <div className="eodsch-card eodw-empty">
          <Upload size={28} aria-hidden="true" />
          <strong>No workflow yet</strong>
          <p className="eodw-muted">
            {canUpload
              ? 'Upload a Control-M XML file to review its jobs, approve it and run it.'
              : 'Ask someone with upload permission to add a workflow to this environment.'}
          </p>
        </div>
      ) : (
        <>
          {/* ---------- summary ---------- */}
          <div className="eodw-stats">
            {stats.map(([label, value, tone]) => (
              <div
                key={label}
                className="eodw-stat"
                data-tone={tone && value > 0 ? tone : undefined}
              >
                <span className="eodw-stat-value">{value ?? 0}</span>
                <span className="eodw-stat-label">{label}</span>
              </div>
            ))}
          </div>

          <Problems title="Problems to fix" tone="bad" messages={view.errors} open />
          <Problems title="Notes and warnings" tone="warn" messages={view.warnings} />

          {/* ---------- approval ---------- */}
          <div className="eodw-approval" data-state={state.state}>
            <div className="eodw-approval-main">
              <span className="eodw-approval-icon">
                {state.state === 'approved' ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldAlert size={22} />
                )}
              </span>
              <div>
                <strong>{state.label}</strong>
                <p className="eodw-muted">
                  {state.state === 'approved'
                    ? `Approved by ${view.meta.approved_by || 'unknown'}${view.meta.approved_at ? ` on ${formatWhen(view.meta.approved_at)}` : ''
                    }. Changing the file, a setting, a target server or a mapping cancels the approval.`
                    : 'Approval covers exactly the commands, target servers and settings shown below.'}
                </p>
              </div>
            </div>
            <div className="eodw-approval-actions">
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

          {/* ---------- graph ---------- */}
          <div className="eodsch-card eodw-graph">
            <div className="eodw-graph-bar">
              <div className="eodw-graph-controls">
                {view.folders.length > 1 ? (
                  <label className="eodsch-field-inline">
                    Workflow
                    <select
                      value={folderChoice}
                      onChange={(e) => {
                        setFolderChoice(e.target.value);
                        setSelected(null);
                      }}
                    >
                      <option value="ALL">
                        All Workflows ({allFolderJobs.length})
                      </option>
                      {view.folders.map((f, i) => (
                        <option key={f.folder} value={String(i)}>
                          {f.folder} ({f.jobs.length})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <strong className="eodw-folder-name">{folder?.folder}</strong>
                )}
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
                    {folderRuns.map((r) => (
                      <option key={r.run_id} value={r.run_id}>
                        {r.run_id} ({isAll && r.folder ? `${r.folder}: ` : ''}{r.status})
                      </option>
                    ))}
                  </select>
                </label>
                {colourChoice !== 'auto' && liveRun ? (
                  <Button size="sm" variant="outline" onClick={() => setColourChoice('auto')}>
                    Follow the live run
                  </Button>
                ) : null}
                {colourRunning ? <span className="eodw-live">Live</span> : null}
              </div>
              {canEdit ? (
                <div className="eodw-graph-actions">
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
                  {folder && !isAll ? (
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
                </div>
              ) : null}
            </div>
            <div className="eodw-graph-body">
              {graph?.nodes?.length ? (
                <DependencyGraph
                  graph={graph}
                  jobs={activeJobs}
                  detail={detail.data}
                  states={states}
                  selected={selected}
                  onSelect={setSelected}
                  isAllWorkflows={isAll}
                  env={env}
                  folder={folder?.folder}
                  onRunRecorded={(runId) => {
                    runs.reload(true);
                    setColourChoice(runId);
                  }}
                  onViewLogs={(runId) => {
                    onRunStarted?.(runId);
                  }}
                />
              ) : null}
            </div>
          </div>

          {/* ---------- jobs + details ---------- */}
          <div className="eodw-split">
            <div className="eodsch-card eodw-jobs">
              <div className="eodw-jobs-bar">
                <div className="eodw-jobs-title">
                  <strong>Jobs</strong>
                  <span className="eodw-count">
                    {query ? `${jobs.length} of ${activeJobs.length}` : jobs.length}
                  </span>
                </div>
                <label className="eodw-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Filter jobs, commands, targets…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Filter jobs"
                  />
                </label>
                {canEdit && !isAll && folder ? (
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
                ) : null}
              </div>
              <div className="eodw-table-scroll">
                <table className="eodsch-table eodw-table">
                  <thead>
                    <tr>
                      {isAll ? <th>Workflow</th> : null}
                      <th>Job</th>
                      <th>Schedule</th>
                      <th className="eodw-num">Waits</th>
                      <th>Target</th>
                      <th>Command</th>
                      {canEdit ? <th aria-label="Actions" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((j) => (
                      <tr
                        key={j.name}
                        data-selected={j.name === selected}
                        onClick={() => setSelected(j.name)}
                      >
                        {isAll ? (
                          <td className="eodw-nowrap">
                            <span className="eodw-pill">{j.folder}</span>
                          </td>
                        ) : null}
                        <td>
                          <button
                            type="button"
                            className="eodsch-link eodw-job-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(j.name);
                            }}
                            aria-pressed={j.name === selected}
                          >
                            {j.name}
                          </button>
                        </td>
                        <td className="eodw-nowrap">{j.schedule}</td>
                        <td className="eodw-num">{j.waits_for?.length ? j.waits_for.length : '—'}</td>
                        <td>
                          <span className="eodw-target-chip" data-ok={Boolean(j.target?.ok)}>
                            {targetLabel(j.target)}
                          </span>
                        </td>
                        <td className="eodw-cmd" title={j.command}>
                          {j.command || '—'}
                        </td>
                        {canEdit ? (
                          <td className="eodw-row-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={Pencil}
                              disabled={!editable}
                              title={editHint ?? `Edit ${j.name}`}
                              aria-label={`Edit ${j.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setJobModal({ mode: 'edit', job: j.name, folder: j.folder || folder?.folder });
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={Trash2}
                              disabled={!editable}
                              title={editHint ?? `Delete ${j.name}`}
                              aria-label={`Delete ${j.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                startDelete({ kind: 'job', folder: j.folder || folder?.folder, job: j.name });
                              }}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!shown.length ? (
                      <tr>
                        <td colSpan={canEdit ? (isAll ? 7 : 6) : (isAll ? 6 : 5)} className="eodw-muted eodw-none">
                          No job matches.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {!showAll && jobs.length > ROW_LIMIT ? (
                <div className="eodw-more">
                  Showing {ROW_LIMIT} of {jobs.length} jobs.{' '}
                  <button type="button" className="eodsch-link" onClick={() => setShowAll(true)}>
                    Show all
                  </button>
                </div>
              ) : null}
            </div>

            <aside className="eodsch-card eodw-details">
              <JobDetails job={job} />
            </aside>
          </div>
        </>
      )}

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