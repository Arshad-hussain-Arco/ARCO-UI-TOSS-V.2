import React, { useEffect, useState } from 'react';
import { CockpitIcon } from './IconSprite';
import { getGroupColor } from './cockpitData';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { targetLabel } from '../scheduler/schedulerModel';

export function JobDetailDrawer({
  jobName,
  job,
  env,
  runId,
  onClose,
  onJobAction,
}) {
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'log'
  const [isExpanded, setIsExpanded] = useState(false);
  const [logText, setLogText] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchLog() {
      if (!env || !runId || !jobName || activeTab !== 'log') return;
      setLogLoading(true);
      setLogError(null);
      try {
        const text = await svc.getRunLog(env, runId, jobName);
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

  if (!jobName) return null;

  const status = job?.status || 'Waiting';
  const group = job?.group || job?.folder || 'EOD-CORE';
  const isRunning = status === 'Running';
  const isHold = status === 'On hold' || status === 'ON HOLD';

  const handleAction = async (action) => {
    setActionBusy(true);
    try {
      await onJobAction?.(jobName, action);
    } finally {
      setActionBusy(false);
    }
  };

  const reloadLog = async () => {
    if (!env || !runId || !jobName) return;
    setLogLoading(true);
    setLogError(null);
    try {
      const text = await svc.getRunLog(env, runId, jobName);
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
    <div className="cr-drawer-backdrop" onClick={onClose}>
      <div className={`cr-drawer ${isExpanded ? 'is-expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
        <header className="cr-drawer-header">
          <div className="cr-dh-title-col">
            <div className="cr-dh-type">JOB DETAILS</div>
            <h2 className="cr-dh-name">{jobName}</h2>
          </div>
          <div className="cr-dh-actions">
            <button
              type="button"
              className="cr-drawer-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
              aria-label={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
            >
              <CockpitIcon name="i-fit" className="xs" />
              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            </button>
            <button type="button" className="cr-drawer-close" onClick={onClose} title="Close drawer">
              <CockpitIcon name="i-x" className="sm" />
            </button>
          </div>
        </header>

        <div className="cr-drawer-meta-strip">
          <span className={`cr-status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`}>
            {status}
          </span>
          <span className="cr-drawer-group-chip" style={{ borderLeftColor: getGroupColor(group) }}>
            {group}
          </span>
          {job?.duration_seconds != null && (
            <span className="cr-drawer-dur-chip">
              Duration: <b>{job.duration_seconds}s</b>
            </span>
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
              <div className="cr-drawer-prop-row">
                <span className="cr-dp-k">Command</span>
                <span className="cr-dp-v mono">{job?.command || '—'}</span>
              </div>

              {job?.executable && (
                <div className="cr-drawer-prop-row">
                  <span className="cr-dp-k">Runs As</span>
                  <span className="cr-dp-v mono">
                    {[job.executable, ...(job.args ?? [])].join(' ')}
                  </span>
                </div>
              )}

              {job?.command_issues && job.command_issues.length > 0 && (
                <div className="cr-drawer-prop-row" style={{ color: 'var(--cr-st-failed)' }}>
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
                  {job?.started_at ? job.started_at.replace('T', ' ').replace('Z', '') : '–'}
                </span>
              </div>

              <div className="cr-drawer-prop-row">
                <span className="cr-dp-k">Ended At</span>
                <span className="cr-dp-v mono">
                  {job?.ended_at ? job.ended_at.replace('T', ' ').replace('Z', '') : '–'}
                </span>
              </div>

              <div className="cr-drawer-prop-row">
                <span className="cr-dp-k">Exit Code</span>
                <span className="cr-dp-v mono">{job?.exit_code ?? '–'}</span>
              </div>

              {runId && (
                <div className="cr-drawer-actions-panel">
                  <span className="cr-dap-title">OPERATOR ACTIONS (RUN #{runId})</span>
                  <div className="cr-dap-btns">
                    <button
                      type="button"
                      className="cr-btn sm primary"
                      disabled={actionBusy}
                      onClick={() => handleAction('rerun')}
                    >
                      Rerun Job
                    </button>
                    <button
                      type="button"
                      className="cr-btn sm cr-btn-outline"
                      disabled={actionBusy}
                      onClick={() => handleAction('skip')}
                    >
                      Mark as Done
                    </button>
                    <button
                      type="button"
                      className="cr-btn sm cr-btn-outline"
                      disabled={actionBusy}
                      onClick={() => handleAction(isHold ? 'release' : 'hold')}
                    >
                      {isHold ? 'Release Hold' : 'Put on Hold'}
                    </button>
                  </div>
                </div>
              )}
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
  );
}

export default JobDetailDrawer;
