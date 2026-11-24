import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CockpitIcon } from './IconSprite';
import { getGroupColor } from './cockpitData';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { targetLabel, formatFullDateTime } from '../scheduler/schedulerModel';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';
import { useToast } from '@hooks/useToast';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export function JobDetailDrawer({
  jobName,
  job,
  allJobs = [],
  env,
  runId,
  onClose,
  onJobAction,
  onFocusScope,
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'log'
  const [logText, setLogText] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [predModalOpen, setPredModalOpen] = useState(false);

  // Dynamic drag-to-resize logic (anchored to viewport right)
  const [drawerWidth, setDrawerWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('toss.cockpit.drawerWidth');
      const parsed = saved ? parseInt(saved, 10) : 480;
      return isNaN(parsed) || parsed < 380 ? 480 : Math.min(parsed, Math.floor(window.innerWidth * 0.92));
    } catch (_) {
      return 480;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(drawerWidth);

  const isWide = drawerWidth >= 680;

  const handleStartResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = drawerWidth;

    const handleMouseMove = (ev) => {
      // Anchored to right edge: moving cursor left expands width
      const delta = resizeStartXRef.current - ev.clientX;
      const nextWidth = resizeStartWidthRef.current + delta;
      const minW = 380;
      const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.92));
      const clamped = Math.min(Math.max(nextWidth, minW), maxW);
      setDrawerWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDrawerWidth((finalWidth) => {
        try {
          localStorage.setItem('toss.cockpit.drawerWidth', String(finalWidth));
        } catch (e) {
          /* ignore storage quota error */
        }
        return finalWidth;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchLog() {
      if (!env || !jobName || activeTab !== 'log') return;
      setLogLoading(true);
      setLogError(null);
      try {
        const text = await svc.getRunLog(env, runId || 'latest', jobName);
        if (!cancelled) setLogText(text || 'No log output captured for this job yet.');
      } catch (err) {
        if (!cancelled) setLogError(errorText(err));
      } finally {
        if (!cancelled) setLogLoading(false);
      }
    }
    fetchLog();
    return () => {
      cancelled = true;
    };
  }, [env, runId, jobName, activeTab]);

  // Compute all predecessors and their live statuses from allJobs
  const predecessorsInfo = useMemo(() => {
    if (!jobName) return [];
    const jobsMap = new Map((allJobs || []).map((j) => [j.name, j]));
    const predSet = new Set();

    if (Array.isArray(job?.predecessors)) {
      job.predecessors.forEach((p) => predSet.add(p));
    }
    if (Array.isArray(job?.waits_for)) {
      job.waits_for.forEach((wf) => {
        if (jobsMap.has(wf)) predSet.add(wf);
      });
    }
    for (const other of allJobs || []) {
      if (Array.isArray(other.successors) && other.successors.includes(jobName)) {
        predSet.add(other.name);
      }
    }

    const COMPLETED_STATUSES = new Set(['DONE', 'SUCCESS', 'FINISHED', 'OK', 'COMPLETE', 'COMPLETED']);

    return Array.from(predSet).map((pName) => {
      const pJob = jobsMap.get(pName);
      const pStatus = pJob?.status || 'Waiting';
      const isComplete = COMPLETED_STATUSES.has(String(pStatus).trim().toUpperCase());
      return {
        name: pName,
        status: pStatus,
        group: pJob?.group || pJob?.folder || 'EOD-CORE',
        isComplete,
        job: pJob,
      };
    });
  }, [jobName, job?.predecessors, job?.waits_for, allJobs]);

  const incompletePreds = useMemo(
    () => predecessorsInfo.filter((p) => !p.isComplete),
    [predecessorsInfo]
  );

  if (!jobName) return null;

  const status = job?.status || 'Waiting';
  const group = job?.group || job?.folder || 'EOD-CORE';
  const isRunning = status === 'Running';

  const handleAction = async (action) => {
    setActionBusy(true);
    try {
      await onJobAction?.(jobName, action);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRerunClick = async () => {
    if (incompletePreds.length === 0) {
      if (predecessorsInfo.length > 0) {
        toast.success(`Predecessors verified (${predecessorsInfo.length}/${predecessorsInfo.length} complete). Rerunning ${jobName}...`);
      }
      await handleAction('rerun');
      return;
    }

    // Predecessors are incomplete: open verification modal
    setPredModalOpen(true);
  };

  const handleRerunChain = async () => {
    setPredModalOpen(false);
    setActionBusy(true);
    try {
      toast.info(`Executing ${incompletePreds.length} predecessor(s) before running ${jobName}...`);
      for (const p of incompletePreds) {
        await onJobAction?.(p.name, 'rerun');
      }
      await onJobAction?.(jobName, 'rerun');
      toast.success(`Dispatched rerun for predecessors (${incompletePreds.map((p) => p.name).join(', ')}) followed by ${jobName}.`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleForceRerun = async () => {
    setPredModalOpen(false);
    await handleAction('rerun');
  };

  const reloadLog = async () => {
    if (!env || !jobName) return;
    setLogLoading(true);
    setLogError(null);
    try {
      const text = await svc.getRunLog(env, runId || 'latest', jobName);
      setLogText(text || 'No log output captured for this job yet.');
    } catch (err) {
      setLogError(errorText(err));
    } finally {
      setLogLoading(false);
    }
  };

  const targetStr = job?.target
    ? (typeof job.target === 'object' ? (job.target.ok ? `${job.target.target_name} (${targetLabel(job.target)})` : job.target.message || 'Unmapped') : String(job.target))
    : '—';

  return (
    <>
      <div className="cr-drawer-backdrop" onClick={onClose} role="presentation">
        <div
          className={`cr-drawer ${isResizing ? 'is-resizing' : ''} ${isWide ? 'is-wide' : ''}`}
          style={{ width: `${drawerWidth}px` }}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {/* Left edge drag handle to resize drawer */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="cr-drawer-resizer"
            onMouseDown={handleStartResize}
            title="Drag left/right to resize drawer"
            aria-label="Resize drawer handle"
          >
            <div className="cr-drawer-resizer-line" />
          </div>

          <header className="cr-drawer-header">
            <div className="cr-dh-title-col">
              <div className="cr-dh-type">JOB DETAILS</div>
              <h2 className="cr-dh-name">{jobName}</h2>
            </div>
            <div className="cr-dh-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onFocusScope && (
                <button
                  type="button"
                  className="cr-btn sm outline"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => {
                    onFocusScope(jobName, group);
                    onClose();
                  }}
                  title="Switch Cockpit scope to this workflow folder"
                >
                  View Workflow
                </button>
              )}
              <button
                type="button"
                className="cr-drawer-close"
                onClick={onClose}
                title="Close drawer"
                aria-label="Close drawer"
              >
                <CockpitIcon name="i-x" className="sm" />
              </button>
            </div>
          </header>

          <div className="cr-drawer-meta-strip">
            <div className="cr-dms-left">
              <span className={`cr-status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                {status}
              </span>
              <span className="cr-drawer-group-chip" style={{ borderLeftColor: getGroupColor(group) }}>
                {group}
              </span>
              <button
                type="button"
                className="cr-drawer-rerun-btn"
                onClick={handleRerunClick}
                disabled={actionBusy}
                title="Rerun this job (validates and checks all predecessors first)"
              >
                <CockpitIcon name="i-refresh" className="xs" />
                <span>Rerun</span>
              </button>
            </div>
            {job?.duration_seconds != null && (
              <div className="cr-dms-right">
                <span className="cr-drawer-dur-chip">
                  Duration: <b>{job.duration_seconds}s</b>
                </span>
              </div>
            )}
          </div>

          <div className="cr-drawer-subtabs">
            <button
              type="button"
              className={`cr-drawer-subtab ${activeTab === 'details' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Overview & Properties
            </button>
            <button
              type="button"
              className={`cr-drawer-subtab ${activeTab === 'log' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('log')}
            >
              Execution Log {isRunning ? '●' : ''}
            </button>
          </div>

          <div className="cr-drawer-body">
            {activeTab === 'details' ? (
              <div className="cr-drawer-section">
                <div className="cr-drawer-grid">
                  <div className="cr-drawer-prop-row is-full-width">
                    <span className="cr-dp-k">Command</span>
                    <span className="cr-dp-v mono">{job?.command || '—'}</span>
                  </div>

                  {job?.executable && (
                    <div className="cr-drawer-prop-row is-full-width">
                      <span className="cr-dp-k">Runs As</span>
                      <span className="cr-dp-v mono">
                        {[job.executable, ...(job.args ?? [])].join(' ')}
                      </span>
                    </div>
                  )}

                  {job?.command_issues && job.command_issues.length > 0 && (
                    <div className="cr-drawer-prop-row is-full-width" style={{ color: 'var(--cr-st-failed)' }}>
                      <span className="cr-dp-k">Command Issues</span>
                      <span className="cr-dp-v">
                        {job.command_issues.map(([code, reason]) => `${code}: ${reason}`).join('; ')}
                      </span>
                    </div>
                  )}

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Target Server</span>
                    <span className="cr-dp-v mono">{targetStr}</span>
                  </div>

                  {job?.nodeid && (
                    <div className="cr-drawer-prop-row">
                      <span className="cr-dp-k">NODEID</span>
                      <span className="cr-dp-v mono">{job.nodeid}</span>
                    </div>
                  )}

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Schedule</span>
                    <span className="cr-dp-v">{job?.schedule || 'Run with workflow'}</span>
                  </div>

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Waits For</span>
                    <span className="cr-dp-v">
                      {job?.waits_for?.length
                        ? `${job.waits_for.join(', ')}${job.logic ? ` (${job.logic})` : ''}`
                        : (job?.predecessors?.length ? job.predecessors.join(', ') : 'None (Root)')}
                    </span>
                  </div>

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Produces</span>
                    <span className="cr-dp-v">
                      {job?.produces?.length
                        ? job.produces.join(', ')
                        : (job?.successors?.length ? job.successors.join(', ') : 'None')}
                    </span>
                  </div>

                  {job?.retries != null && (
                    <div className="cr-drawer-prop-row">
                      <span className="cr-dp-k">Retries</span>
                      <span className="cr-dp-v">{job.retries}</span>
                    </div>
                  )}

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Started At</span>
                    <span className="cr-dp-v mono">
                      {formatFullDateTime(job?.started_at, '–')}
                    </span>
                  </div>

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Ended At</span>
                    <span className="cr-dp-v mono">
                      {formatFullDateTime(job?.ended_at, '–')}
                    </span>
                  </div>

                  <div className="cr-drawer-prop-row">
                    <span className="cr-dp-k">Exit Code</span>
                    <span className="cr-dp-v mono">{job?.exit_code ?? '–'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cr-drawer-log-box">
                <div className="cr-log-toolbar">
                  <span className="cr-log-title">
                    {jobName} output {runId ? `(Run #${runId})` : ''}
                  </span>
                  <button
                    type="button"
                    className="cr-btn outline xs"
                    onClick={reloadLog}
                    disabled={logLoading}
                  >
                    {logLoading ? 'Loading…' : 'Refresh Log'}
                  </button>
                </div>
                {logError ? (
                  <div className="cr-log-error" role="alert">
                    {logError}
                  </div>
                ) : (
                  <pre className="cr-log-pre">
                    {logLoading && !logText ? 'Loading execution log…' : (logText || 'No log output captured for this job yet.')}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Predecessor Verification Modal ── */}
      <AdminModal
        isOpen={predModalOpen}
        onClose={() => setPredModalOpen(false)}
        title={`Predecessor Check: ${jobName}`}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPredModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleForceRerun}
              title="Force run this job without waiting for predecessors"
            >
              Force Rerun Alone
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRerunChain}
              isLoading={actionBusy}
            >
              Rerun Predecessors in Sequence First
            </Button>
          </div>
        }
      >
        <div className="cr-pred-modal-body">
          <div className="cr-pred-alert">
            <AlertTriangle className="cr-pred-alert-icon" size={18} />
            <div className="cr-pred-alert-content">
              <div className="cr-pred-alert-title">Predecessor Dependencies Incomplete</div>
              <div className="cr-pred-alert-desc">
                <strong>{jobName}</strong> cannot safely execute because{' '}
                <strong>{incompletePreds.length}</strong> of its{' '}
                <strong>{predecessorsInfo.length}</strong> predecessor job(s) have not yet completed
                successfully.
              </div>
            </div>
          </div>

          <div className="cr-pred-table-wrap">
            <table className="cr-pred-table">
              <thead>
                <tr>
                  <th>Predecessor Job</th>
                  <th>Folder / Group</th>
                  <th>Status</th>
                  <th>Prerequisite</th>
                </tr>
              </thead>
              <tbody>
                {predecessorsInfo.map((p) => (
                  <tr key={p.name}>
                    <td className="cr-pred-job-name">{p.name}</td>
                    <td>{p.group}</td>
                    <td>
                      <span className={`cr-status-badge ${p.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {p.isComplete ? (
                        <span className="cr-pred-status-badge is-ok">
                          <CheckCircle2 size={12} /> Satisfied
                        </span>
                      ) : (
                        <span className="cr-pred-status-badge is-fail">
                          <XCircle size={12} /> Incomplete
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="cr-pred-help-text">
            To ensure data integrity and workflow continuity, choose <strong>&quot;Rerun Predecessors in Sequence First&quot;</strong> to
            automatically trigger the pending predecessors in order followed by {jobName}.
          </p>
        </div>
      </AdminModal>
    </>
  );
}

export default JobDetailDrawer;
