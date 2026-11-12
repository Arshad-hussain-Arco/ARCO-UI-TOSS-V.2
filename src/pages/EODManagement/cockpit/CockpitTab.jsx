import React, { useState, useRef, useMemo } from 'react';
import { IconSprite, CockpitIcon } from './IconSprite';
import { CockpitOverview } from './CockpitOverview';
import { CockpitFlow } from './CockpitFlow';
import { CockpitTimeline } from './CockpitTimeline';
import { CockpitHistory } from './CockpitHistory';
import { JobDetailDrawer } from './JobDetailDrawer';
import { StartRunModal } from './StartRunModal';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { usePolling, useResource } from '../scheduler/useResource';
import { approvalState, groupMessages } from '../scheduler/schedulerModel';

import './Cockpit.css';

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'flow', label: 'Flow' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'history', label: 'History' },
];

function Problems({ title, tone, messages, open }) {
  const groups = useMemo(() => groupMessages(messages), [messages]);
  if (!groups.length) return null;
  return (
    <details className={`eodsch-problems eodsch-problems-${tone}`} open={open} style={{ margin: '6px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        {title} ({messages.length})
      </summary>
      <ul style={{ margin: '6px 0 0 16px', fontSize: '12px' }}>
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

export function CockpitTab({ env } = {}) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [activeView, setActiveView] = useState('overview');
  const [selectedJobName, setSelectedJobName] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRunPaused, setIsRunPaused] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [isStartRunOpen, setIsStartRunOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flowGroupFilter, setFlowGroupFilter] = useState(null);

  const handleNavigateView = (view, group = null) => {
    if (group) {
      setFlowGroupFilter(group);
    }
    setActiveView(view);
  };

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const canUpload = hasPermission('EOD_SCHEDULER_UPLOAD');

  // Load real resources from backend
  const wf = useResource(() => (env ? svc.getWorkflow(env) : Promise.resolve(null)), [env]);
  const def = useResource(() => (env ? svc.getCockpitDefinition(env) : Promise.resolve(null)), [env]);
  const runsList = useResource(
    () => (env ? svc.getCockpitRuns(env).catch(() => svc.listRuns(env)) : Promise.resolve([])),
    [env],
  );

  const runs = useMemo(() => runsList.data || [], [runsList.data]);
  const liveRun = (runs.find((r) => r.status === 'RUNNING' || r.status === 'Running') ?? runs[0])?.id ?? (runs[0]?.run_id ?? '');
  const currentRunId = selectedRunId || liveRun || '';

  const runDetail = useResource(
    () => (env && currentRunId ? svc.getCockpitRun(env, currentRunId).catch(() => svc.getRun(env, currentRunId)) : Promise.resolve(null)),
    [env, currentRunId],
  );

  const isRunningBatch = runDetail.data?.status === 'Running' || runDetail.data?.status === 'RUNNING';
  const isBackendPaused = runDetail.data?.status === 'Paused' || runDetail.data?.status === 'PAUSED';
  const isPaused = isRunPaused || isBackendPaused;
  const isRunActive = isRunningBatch || isPaused;

  // Polling for live status
  usePolling(() => runsList.reload(true), 4000);
  usePolling(() => runDetail.reload(true), 2500, isRunActive);
  usePolling(() => wf.reload(true), 10000, !busy);

  const view = wf.data;
  const state = approvalState(view, hasPermission);

  // Enrich definition jobs with rich validation/target info from wf.data.folders
  const enrichedDefinition = useMemo(() => {
    if (!def.data) return null;
    const wfJobsMap = new Map();
    for (const f of view?.folders || []) {
      for (const j of f.jobs || []) {
        wfJobsMap.set(j.name, j);
      }
    }
    return {
      ...def.data,
      jobs: (def.data.jobs || []).map((dj) => {
        const wj = wfJobsMap.get(dj.name);
        return wj ? { ...dj, ...wj } : dj;
      }),
    };
  }, [def.data, view]);

  // Merge selected job properties from workflow definition + active run
  const selectedJobObj = useMemo(() => {
    if (!selectedJobName) return null;
    let wfJob = null;
    for (const f of view?.folders || []) {
      const found = f.jobs?.find((j) => j.name === selectedJobName);
      if (found) {
        wfJob = found;
        break;
      }
    }
    const defJob = def.data?.jobs?.find((j) => j.name === selectedJobName);
    const runJob = runDetail.data?.jobs?.find((j) => j.name === selectedJobName);
    return wfJob || defJob || runJob ? { ...defJob, ...wfJob, ...runJob } : null;
  }, [selectedJobName, view, def.data, runDetail.data]);

  // Actions
  const guarded = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (okMsg) toast.success(okMsg);
      return res;
    } catch (err) {
      toast.error(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const done = await guarded(
      () => svc.uploadWorkflow(env, file),
      `${file.name} uploaded. Review it before approving.`,
    );
    if (done) {
      setReviewed(false);
      setSelectedJobName(null);
      await Promise.all([wf.reload(true), def.reload(true)]);
    }
  };

  const handleApprove = async () => {
    if (!view?.approval?.digest) return;
    const done = await guarded(
      () => svc.approve(env, view.approval.digest),
      'Approved. Batch is now permitted to execute.',
    );
    if (done) {
      setReviewed(false);
      wf.reload(true);
    }
  };

  const handleStartRun = async (options = {}) => {
    setBusy(true);
    try {
      const { command_id: id } = await svc.runNow(env, {
        allow_overlap: options.allow_overlap ?? false,
      });
      let answer = null;
      for (let i = 0; i < 34; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        answer = await svc.getCommand(env, id);
        if (!['PENDING', 'CLAIMED'].includes(answer.status)) break;
      }
      if (answer?.status === 'DONE') {
        toast.success('The engine accepted and started the batch run.');
        await runsList.reload(true);
        const newRunId = answer.result?.runs?.[0]?.run_id;
        if (newRunId) {
          setSelectedRunId(newRunId);
        }
        await runDetail.reload(true);
        setActiveView('flow');
      } else if (answer && !['PENDING', 'CLAIMED'].includes(answer.status)) {
        toast.error(answer.result?.message || `The engine answered ${answer.status}.`);
      } else {
        toast.error(
          'No engine answered within 30 seconds. Verify that an engine is serving this environment.',
        );
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelRun = async () => {
    if (!currentRunId) return;
    setBusy(true);
    try {
      await svc.cancelRun(env, currentRunId);
      toast.success('Cancel requested. Running jobs are instructed to stop.');
      await Promise.all([runDetail.reload(true), runsList.reload(true)]);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePause = async () => {
    if (!currentRunId) return;
    const nextPaused = !isPaused;
    setIsRunPaused(nextPaused);
    try {
      if (nextPaused) {
        await svc.pauseRun?.(env, currentRunId).catch(() => {});
        toast.success(`Run #${currentRunId} paused. Dispatch has been halted.`);
      } else {
        await svc.resumeRun?.(env, currentRunId).catch(() => {});
        toast.success(`Run #${currentRunId} resumed. Continuing batch execution.`);
      }
      await Promise.all([runDetail.reload(true), runsList.reload(true)]);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleJobAction = async (jobName, action) => {
    if (!currentRunId) return;
    try {
      await svc.cockpitJobAction(env, currentRunId, jobName, action);
      toast.success(`Action '${action}' applied to ${jobName}.`);
      await runDetail.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleSelectRun = (runId) => {
    setSelectedRunId(runId);
  };

  const run = runDetail.data;

  return (
    <div className="cr-cockpit">
      {/* ── Internal SVG Icon Sprites ── */}
      <IconSprite />

      {/* ── Workflow & Ingestion Management Strip ── */}
      <div className="cr-workflow-strip">
        <div className="cr-wf-info">
          {view?.loaded ? (
            <>
              <span className="cr-wf-badge">ACTIVE BATCH</span>
              {state.state === 'approved' ? (
                <span className="cr-approval-badge approved">
                  <CockpitIcon name="i-done" className="xs" /> Approved
                </span>
              ) : (
                <span className="cr-approval-badge pending">
                  <CockpitIcon name="i-hold" className="xs" /> Needs Approval
                </span>
              )}
              <strong className="cr-wf-filename">{view.meta.filename}</strong>
              <span className="cr-wf-meta">
                sha256 {view.meta.sha256.slice(0, 10)}… · uploaded {new Date(view.meta.uploaded_at).toLocaleDateString()} by {view.meta.uploaded_by || 'unknown'}
              </span>
              <div className="cr-wf-counts">
                <span className="cr-wf-count-chip">{view.summary?.jobs ?? 0} jobs</span>
                <span className="cr-wf-count-chip">{view.summary?.dependencies ?? 0} dependencies</span>
                {view.summary?.errors > 0 && (
                  <span className="cr-wf-count-chip bad">{view.summary.errors} errors</span>
                )}
                {view.summary?.warnings > 0 && (
                  <span className="cr-wf-count-chip warn">{view.summary.warnings} warnings</span>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="cr-approval-badge empty">No Workflow</span>
              <span className="cr-wf-empty-text">
                No workflow definition uploaded to {String(env).toUpperCase()} yet. Upload a Control-M XML file to begin.
              </span>
            </>
          )}
        </div>

        <div className="cr-wf-actions">
          {view?.loaded && (
            <button
              type="button"
              className={`cr-btn sm ${showDiagnostics ? 'primary' : 'outline'}`}
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              title="Toggle batch validation metrics and issues"
            >
              Diagnostics & Review
              {view.summary?.errors > 0 ? ` (${view.summary.errors} errors)` : ''}
            </button>
          )}
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                hidden
                onChange={handleUpload}
                aria-label="Upload Control-M XML"
              />
              <button
                type="button"
                className="cr-btn outline sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <CockpitIcon name="i-branch" className="xs" /> Upload XML
              </button>
            </>
          )}
          <button
            type="button"
            className="cr-btn outline sm"
            onClick={() => {
              wf.reload(true);
              def.reload(true);
              runsList.reload(true);
              runDetail.reload(true);
            }}
            title="Refresh batch and runs"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Validation Diagnostics & Review Panel ── */}
      {view?.loaded && (showDiagnostics || (view.errors && view.errors.length > 0)) && (
        <div className="cr-review-panel">
          <div className="cr-review-stats-grid">
            {[
              ['Workflows', view.summary?.folders],
              ['Jobs', view.summary?.jobs],
              ['Dependencies', view.summary?.dependencies],
              ['Timed jobs', view.summary?.timed_jobs],
              ['External conditions', view.summary?.external_conditions],
              ['Warnings', view.summary?.warnings],
              ['Errors', view.summary?.errors],
            ].map(([label, value]) => (
              <div key={label} className={`cr-review-stat ${label === 'Errors' && value > 0 ? 'bad' : ''}`}>
                <span className="cr-review-stat-val">{value ?? 0}</span>
                <span className="cr-review-stat-lbl">{label}</span>
              </div>
            ))}
          </div>

          <div className="cr-review-problems-group">
            <Problems title="Problems to fix" tone="bad" messages={view.errors} open />
            <Problems title="Notes and warnings" tone="warn" messages={view.warnings} />
          </div>
        </div>
      )}

      {/* ── 4-Eyes Approval Banner ── */}
      {view?.loaded && state.state === 'pending' && (
        <div className="cr-approval-banner is-pending">
          <div className="cr-ab-text">
            <CockpitIcon name="i-hold" className="sm" />
            <div>
              <strong>Batch Review & Approval Required</strong>
              <span className="cr-ab-sub">
                Approval covers the commands, targets and schedule in {view.meta.filename}.
              </span>
            </div>
          </div>
          {state.canApprove ? (
            <div className="cr-ab-actions">
              <label className="cr-ab-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed the commands, targets and schedule
              </label>
              <button
                type="button"
                className="cr-btn primary sm"
                disabled={!reviewed || busy}
                onClick={handleApprove}
              >
                Approve Batch
              </button>
            </div>
          ) : (
            <span className="eodsch-muted">Ask an authorized user to approve this workflow.</span>
          )}
        </div>
      )}

      {view?.loaded && state.state === 'approved' && (
        <div className="cr-approval-banner is-approved">
          <CockpitIcon name="i-done" className="xs" />
          <span>
            Batch approved by {view.meta.approved_by || 'system'}{' '}
            {view.meta.approved_at ? `on ${new Date(view.meta.approved_at).toLocaleString()}` : ''}. Changing XML, targets or settings revokes approval.
          </span>
        </div>
      )}

      {/* ── Subtabs Navigation Bar ── */}
      <div className="cr-subtabs-bar">
        <div className="cr-subtabs-list" role="tablist">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeView === tab.id}
              className={`cr-subtab-btn ${activeView === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRunActive && (
            <>
              <button
                type="button"
                className={`cr-btn sm ${isPaused ? 'primary' : 'outline'}`}
                disabled={busy}
                onClick={handleTogglePause}
                title={isPaused ? "Resume batch execution" : "Pause batch execution"}
              >
                <CockpitIcon name={isPaused ? "i-play" : "i-hold"} className="xs" />
                {isPaused ? 'Resume' : 'Pause'}
              </button>

              <button
                type="button"
                className="cr-btn outline sm cr-btn-danger"
                disabled={busy}
                onClick={handleCancelRun}
                title="Cancel run"
              >
                Cancel Run
              </button>
            </>
          )}

          {state.state === 'approved' && state.canRun && (
            <button
              type="button"
              className="cr-btn primary sm cr-start-new-run-btn"
              disabled={busy}
              onClick={() => setIsStartRunOpen(true)}
            >
              Start a new run
            </button>
          )}
        </div>
      </div>

      {/* ── Run Context Strip ── */}
      {run ? (
        <div className="cr-run-context-strip">
          <div className="cr-rcs-left">
            <span className="cr-scope-pill">RUN #{run.id}</span>
            <span className={`cr-env-pill ${String(env).toLowerCase()}`}>{String(env).toUpperCase()}</span>
            <span className={`cr-status-badge ${isPaused ? 'paused' : String(run.status).toLowerCase().replace(/\s+/g, '-')}`}>
              {isPaused ? 'Paused' : run.status}
            </span>
            <span className="cr-rcs-started">
              started {run.started_at ? new Date(run.started_at).toLocaleTimeString([], { hour12: false }) : '—'}
            </span>
            <span className="cr-rcs-desc">
              {activeView === 'overview' && 'High level status, metrics, and progress for this run.'}
              {activeView === 'flow' && 'The jobs of the batch file and how they depend on each other, coloured by this run.'}
              {activeView === 'timeline' && 'When each job of this run started and ended.'}
            </span>
          </div>

          <div className="cr-rcs-right">
            <label className="cr-run-switch-label">
              <span>RUN</span>
              <select
                className="cr-select sm cr-run-switch-select"
                value={currentRunId}
                onChange={(e) => handleSelectRun(e.target.value)}
              >
                {runs.map((r) => {
                  const rid = r.id || r.run_id;
                  const rstat = r.status || 'Unknown';
                  const rstart = r.started_at || r.started;
                  return (
                    <option key={rid} value={rid}>
                      #{rid} · {rstat} · {rstart ? new Date(rstart).toLocaleTimeString([], { hour12: false }) : '—'}
                      {String(currentRunId) === String(rid) ? ' (current)' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="cr-run-context-strip" style={{ justifyContent: 'flex-start', color: 'var(--cr-text-muted)' }}>
          <span style={{ fontSize: '12px' }}>
            No runs recorded for {String(env).toUpperCase()} yet. Click &ldquo;Start a new run&rdquo; above once approved.
          </span>
        </div>
      )}

      {/* ── Active View Body ── */}
      <main className="cr-main-pane">
        {busy && (
          <div className="cr-loading-overlay">
            <span className="cr-spinner" />
          </div>
        )}

        {activeView === 'overview' && (
          <CockpitOverview
            run={run ? { ...run, status: isPaused ? 'Paused' : run.status } : null}
            definition={enrichedDefinition}
            folders={view?.folders || []}
            onSelectJob={(name) => {
              setSelectedJobName(name);
              setIsDrawerOpen(true);
            }}
            onNavigateView={handleNavigateView}
            onStartRun={() => setIsStartRunOpen(true)}
            onCancelRun={handleCancelRun}
            canRun={state.state === 'approved' && state.canRun}
          />
        )}

        {activeView === 'flow' && (
          <CockpitFlow
            definition={enrichedDefinition}
            run={run ? { ...run, status: isPaused ? 'Paused' : run.status } : null}
            selectedJob={selectedJobName}
            onSelectJob={setSelectedJobName}
            onOpenDrawer={(name) => {
              setSelectedJobName(name);
              setIsDrawerOpen(true);
            }}
            onCancelRun={handleCancelRun}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            folders={view?.folders || []}
            initialGroupFilter={flowGroupFilter}
            onClearGroupFilter={() => setFlowGroupFilter(null)}
          />
        )}

        {activeView === 'timeline' && (
          <CockpitTimeline
            run={run ? { ...run, status: isPaused ? 'Paused' : run.status } : null}
            definition={enrichedDefinition}
            selectedJob={selectedJobName}
            onSelectJob={(name) => {
              setSelectedJobName(name);
              setIsDrawerOpen(true);
            }}
          />
        )}

        {activeView === 'history' && (
          <CockpitHistory
            runs={runs}
            currentRunId={currentRunId}
            env={env}
            onSelectRun={(id) => {
              handleSelectRun(id);
              setActiveView('overview');
            }}
          />
        )}
      </main>

      {/* ── Slide-Out Job Detail Drawer ── */}
      {selectedJobName && isDrawerOpen && (
        <JobDetailDrawer
          jobName={selectedJobName}
          job={selectedJobObj}
          env={env}
          runId={currentRunId}
          onClose={() => setIsDrawerOpen(false)}
          onJobAction={handleJobAction}
        />
      )}

      {/* ── Start Run Modal ── */}
      <StartRunModal
        isOpen={isStartRunOpen}
        onClose={() => setIsStartRunOpen(false)}
        onStart={handleStartRun}
        currentEnv={env}
      />
    </div>
  );
}

export default CockpitTab;
