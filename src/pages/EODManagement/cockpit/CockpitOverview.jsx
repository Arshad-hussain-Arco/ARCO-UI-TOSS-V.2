import React, { useState, useMemo } from 'react';
import {
  Check,
  Circle,
  Gauge,
  GitFork,
  Layers,
  ListOrdered,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { CockpitIcon } from './IconSprite';
import { trend, niceTicks, groupRows } from './rundashUtils';
import { getGroupColor } from './cockpitData';
import { formatClockTime, formatFullDateTime } from '../scheduler/schedulerModel';

export function formatJobTarget(target, nodeid) {
  if (!target) return nodeid || 'arco@192.168.0.120:22';
  if (typeof target === 'string') return target;
  if (typeof target === 'object') {
    if (target.username && target.host) {
      return `${target.username}@${target.host}${target.port ? `:${target.port}` : ''}`;
    }
    if (target.target_name) return target.target_name;
    if (!target.ok) return target.message || target.code || 'Unmapped';
  }
  return nodeid || 'arco@192.168.0.120:22';
}

export function CockpitOverview({
  run,
  definition,
  folders,
  onSelectJob,
  onNavigateView,
  onStartRun,
  onCancelRun,
  onJobAction,
  onAddJob,
  onEditJob,
  onDeleteJob,
  canRun,
  isLoading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Combine definition & run jobs (Always called at top level)
  const allJobs = useMemo(() => {
    if (run?.jobs && run.jobs.length > 0) return run.jobs;
    if (definition?.jobs && definition.jobs.length > 0) return definition.jobs;
    return [];
  }, [run?.jobs, definition?.jobs]);

  const counts = useMemo(() => {
    const jobs = allJobs;
    let done = 0;
    let failed = 0;
    let running = 0;
    let on_hold = 0;
    let waiting = 0;

    for (const j of jobs) {
      const st = (j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) done++;
      else if (['FAILED', 'ERROR', 'NOTOK'].includes(st)) failed++;
      else if (['RUNNING', 'ACTIVE'].includes(st)) running++;
      else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) on_hold++;
      else waiting++;
    }
    return {
      total: jobs.length,
      done,
      failed,
      running,
      on_hold,
      waiting,
    };
  }, [allJobs]);

  const total = counts.total || (allJobs.length || 0);
  const completed = counts.done || 0;
  const isFinished = run?.status?.toLowerCase() === 'finished' || (total > 0 && completed === total);
  const pct = total ? (isFinished ? 100 : Math.min(99, Math.floor((completed / total) * 100))) : 0;
  const tr = trend(allJobs, run || {});

  // SVG Trend Bar Chart Calculations
  const W = 460;
  const H = 160;
  const P = { l: 30, r: 12, t: 14, b: 24 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  const buckets = tr.buckets && tr.buckets.length > 0 ? tr.buckets : (run?.isReadyState ? [] : [
    { from: 1, success: 18, failed: 0, running: 0 },
    { from: 2, success: 25, failed: 0, running: 0 },
    { from: 3, success: 28, failed: 0, running: 0 },
    { from: 4, success: 22, failed: 0, running: 0 },
    { from: 5, success: 15, failed: 0, running: 0 },
    { from: 6, success: 30, failed: 0, running: 0 },
    { from: 7, success: 30, failed: 0, running: 0 },
    { from: 8, success: 24, failed: 0, running: 0 },
    { from: 9, success: 26, failed: 0, running: 0 },
    { from: 10, success: 19, failed: 0, running: 0 },
    { from: 11, success: 32, failed: 0, running: 0 },
    { from: 12, success: 35, failed: 0, running: 0 },
    { from: 13, success: 20, failed: 0, running: 0 },
    { from: 14, success: 2, failed: 0, running: 0 },
  ]);

  const totals = buckets.map((b) => (b.success || 0) + (b.failed || 0) + (b.running || 0));
  const maxInBuckets = Math.max(1, ...totals);
  const yTicks = niceTicks(Math.max(maxInBuckets, 15), 4);
  const topTick = yTicks[yTicks.length - 1] || 15;

  const bw = Math.max(4, Math.floor(iw / (buckets.length * 1.35)));
  const gap = Math.max(2, Math.floor((iw - bw * buckets.length) / Math.max(1, buckets.length - 1)));

  const timeLabels = useMemo(() => {
    if (!buckets || buckets.length === 0) return [];
    const count = Math.min(5, buckets.length);
    const step = (buckets.length - 1) / Math.max(1, count - 1);
    const labels = [];
    for (let i = 0; i < count; i++) {
      const bIndex = Math.min(buckets.length - 1, Math.round(i * step));
      const b = buckets[bIndex];
      if (!b || !b.from) continue;
      const d = new Date(b.from);
      const text = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
      const x = P.l + bIndex * (bw + gap) + bw / 2;
      const anchor = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
      labels.push({ text, x, anchor });
    }
    return labels;
  }, [buckets, bw, gap, P.l]);

  // SVG Circular progress
  const ringRadius = 48;
  const strokeWidth = 12;
  const circ = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circ - (pct / 100) * circ;

  const appGroups = useMemo(() => {
    const jobDefMap = new Map();
    if (definition?.jobs) {
      for (const dj of definition.jobs) {
        jobDefMap.set(dj.name, dj);
      }
    }
    if (folders && folders.length) {
      for (const f of folders) {
        const folderName = f.folder || 'EOD-CORE';
        for (const fj of f.jobs || []) {
          const existing = jobDefMap.get(fj.name) || {};
          jobDefMap.set(fj.name, { ...existing, group: existing.group || folderName, folder: folderName });
        }
      }
    }

    const inferGroup = (job) => {
      if (job.group) return job.group;
      if (job.folder) return job.folder;
      const def = jobDefMap.get(job.name);
      if (def?.group) return def.group;
      if (def?.folder) return def.folder;
      return 'REMOTE_EOD_DEMO';
    };

    if (allJobs && allJobs.length > 0) {
      return groupRows(allJobs, inferGroup);
    }
    return [];
  }, [allJobs, definition?.jobs, folders]);

  // Filtered Jobs for the Table
  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const st = (j.status || '').toUpperCase();
        if (statusFilter === 'DONE' && !['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) return false;
        if (statusFilter === 'FAILED' && !['FAILED', 'ERROR', 'NOTOK'].includes(st)) return false;
        if (statusFilter === 'RUNNING' && !['RUNNING', 'ACTIVE'].includes(st)) return false;
        if (statusFilter === 'HOLD' && !['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) return false;
        if (statusFilter === 'WAITING' && !['WAITING', 'QUEUED', 'SUBMITTED', 'PENDING'].includes(st) && st !== '') return false;
      }
      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = j.name?.toLowerCase().includes(q);
        const matchCmd = typeof j.command === 'string' && j.command.toLowerCase().includes(q);
        const targetStr = formatJobTarget(j.target, j.nodeid);
        const matchTarget = targetStr.toLowerCase().includes(q);
        const matchSchedule = typeof j.schedule === 'string' && j.schedule.toLowerCase().includes(q);
        if (!matchName && !matchCmd && !matchTarget && !matchSchedule) return false;
      }
      return true;
    });
  }, [allJobs, statusFilter, searchQuery]);

  // Early returns can now happen safely AFTER all hooks have executed
  if (isLoading) {
    return (
      <div className="cr-overview-content cr-loading-state">
        <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <span className="cr-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', margin: '12px 0 6px', color: 'var(--cr-text)' }}>Loading Batch Overview...</h2>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--cr-text-muted)' }}>
            Fetching execution details and job metrics for this environment.
          </p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="cr-overview-content" style={{ padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', color: 'var(--cr-text-muted)' }}>
          <CockpitIcon name="i-branch" className="xl" />
          <h2 style={{ fontSize: '18px', margin: '12px 0 6px', color: 'var(--cr-text)' }}>No Run Selected</h2>
          <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
            There is no active run or selected past run for this environment. Start a run or select one from History to view execution progress.
          </p>
          {canRun && onStartRun && (
            <button
              type="button"
              className="cr-btn primary sm"
              style={{ marginTop: '16px' }}
              onClick={onStartRun}
            >
              Start a new run
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cr-overview-content">
      {/* ── KPI Summary Row + Run All Now Button (Matching Image 1) ── */}
      <div className="cr-overview-kpi-row">
        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box total">
            <Layers size={18} />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">Total Jobs</span>
            <span className="cr-kpi-val">{counts.total}</span>
          </div>
        </div>

        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box completed">
            <Check size={18} />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">Completed</span>
            <span className="cr-kpi-val">{counts.done}</span>
          </div>
        </div>

        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box failed">
            <X size={18} />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">Failed</span>
            <span className="cr-kpi-val">{counts.failed}</span>
          </div>
        </div>

        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box running">
            <Play size={18} fill="currentColor" />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">Running</span>
            <span className="cr-kpi-val">{counts.running}</span>
          </div>
        </div>

        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box hold">
            <Pause size={18} fill="currentColor" />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">On Hold</span>
            <span className="cr-kpi-val">{counts.on_hold}</span>
          </div>
        </div>

        <div className="cr-kpi-tile">
          <div className="cr-kpi-icon-box waiting">
            <Circle size={18} />
          </div>
          <div className="cr-kpi-text">
            <span className="cr-kpi-label">Waiting</span>
            <span className="cr-kpi-val">{counts.waiting}</span>
          </div>
        </div>
      </div>

      {/* ── Middle Section: 3 Cards (Trend, Run Status, Application Status) ── */}
      <div className="cr-overview-middle-grid">
        {/* Panel 1: Job Status Trend */}
        <section className="cr-card cr-trend-card">
          <header className="cr-card-header">
            <div className="cr-card-header-left">
              <TrendingUp size={16} className="cr-card-icon-title" />
              <h3 className="cr-card-title">Job Status Trend</h3>
            </div>
          </header>
          <div className="cr-trend-chart-body">
            {run.isReadyState ? (
              <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--cr-text-muted)', gap: '8px' }}>
                <CockpitIcon name="i-waiting" className="md" />
                <span style={{ fontSize: '12.5px' }}>Workflow ready to run. Start execution to display real-time progress trend.</span>
              </div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="cr-trend-svg" preserveAspectRatio="none">
                {yTicks.map((val) => {
                  const y = P.t + ih - (val / topTick) * ih;
                  return (
                    <g key={val}>
                      <line x1={P.l} y1={y} x2={W - P.r} y2={y} className="cr-grid-line" />
                      <text x={P.l - 6} y={y + 3.5} className="cr-axis-label" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {buckets.map((b, i) => {
                  const x = P.l + i * (bw + gap);
                  const successH = Math.max(0, Math.min(ih, ((b.success || 0) / topTick) * ih));
                  const failedH = Math.max(0, Math.min(ih - successH, ((b.failed || 0) / topTick) * ih));
                  const runningH = Math.max(0, Math.min(ih - successH - failedH, ((b.running || 0) / topTick) * ih));

                  const successY = Math.max(P.t, P.t + ih - successH);
                  const failedY = Math.max(P.t, successY - failedH);
                  const runningY = Math.max(P.t, failedY - runningH);

                  return (
                    <g key={i}>
                      {b.success > 0 && (
                        <rect x={x} y={successY} width={bw} height={successH} rx="1.5" className="cr-bar-success">
                          <title>{`${b.success} finished`}</title>
                        </rect>
                      )}
                      {b.failed > 0 && (
                        <rect x={x} y={failedY} width={bw} height={failedH} rx="1.5" className="cr-bar-failed">
                          <title>{`${b.failed} failed`}</title>
                        </rect>
                      )}
                      {b.running > 0 && (
                        <rect x={x} y={runningY} width={bw} height={runningH} rx="1.5" className="cr-bar-running">
                          <title>{`${b.running} running`}</title>
                        </rect>
                      )}
                    </g>
                  );
                })}

                {timeLabels.map((lbl, idx) => (
                  <text key={idx} x={lbl.x} y={H - 4} className="cr-axis-label" textAnchor={lbl.anchor}>
                    {lbl.text}
                  </text>
                ))}
              </svg>
            )}
          </div>
          <footer className="cr-trend-legend">
            <span className="cr-leg-item"><i className="cr-leg-dot done" /> Completed</span>
            <span className="cr-leg-item"><i className="cr-leg-dot failed" /> Failed</span>
            <span className="cr-leg-item"><i className="cr-leg-dot running" /> Running</span>
          </footer>
        </section>

        {/* Panel 2: Run Status */}
        <section className="cr-card cr-run-status-card">
          <header className="cr-card-header">
            <div className="cr-card-header-left">
              <Gauge size={16} className="cr-card-icon-title" />
              <h3 className="cr-card-title">Run Status</h3>
            </div>
          </header>
          <div className="cr-run-status-body">
            <div className="cr-ring-wrapper">
              <svg width="124" height="124" viewBox="0 0 130 130" className="cr-ring-svg">
                <circle cx="65" cy="65" r={ringRadius} className="cr-ring-bg" strokeWidth={strokeWidth} />
                <circle
                  cx="65"
                  cy="65"
                  r={ringRadius}
                  className={`cr-ring-progress ${isFinished ? 'done' : (run.isReadyState ? 'waiting' : 'running')}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circ}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="cr-ring-center">
                <span className="cr-ring-pct">{pct}%</span>
                <span className="cr-ring-done-lbl">{isFinished ? 'Done' : (run.isReadyState ? 'Ready' : run.status)}</span>
              </div>
            </div>

            <div className="cr-rs-meta-list">
              <div className="cr-rs-row">
                <span className="cr-rs-key">Run</span>
                <span className="cr-rs-val bold">{run.isReadyState ? `NEW BATCH - ${String(run.environment || 'DEV').toUpperCase()}` : `#${run.id}`}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Total Jobs</span>
                <span className="cr-rs-val bold">{total}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Started</span>
                <span className="cr-rs-val">{formatClockTime(run.started_at)}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Ended</span>
                <span className="cr-rs-val">{formatClockTime(run.ended_at)}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Duration</span>
                <span className="cr-rs-val">{run.isReadyState ? '—' : (run.took || '—')}</span>
              </div>
            </div>
          </div>
        </section>
          </div>
        </section>

        {/* Panel 3: Application Status */}
        <section className="cr-card cr-app-status-card">
          <header className="cr-card-header">
            <div className="cr-card-header-left">
              <GitFork size={16} className="cr-card-icon-title" />
              <h3 className="cr-card-title">Application Status</h3>
            </div>
          </header>
          <div className="cr-app-table-wrapper">
            <table className="cr-app-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Progress</th>
                  <th style={{ textAlign: 'right' }}>Jobs (S / F / R)</th>
                </tr>
              </thead>
              <tbody>
                {appGroups.length > 0 ? (
                  appGroups.map((row) => (
                    <tr key={row.group} className="cr-app-row">
                      <td className="cr-group-cell">
                        <span className="cr-group-dot" />
                        <b>{row.group}</b>
                      </td>
                      <td>
                        <div className="cr-group-bar-wrap">
                          <div className="cr-group-bar-track">
                            <div className="cr-group-bar-fill done" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="cr-group-bar-pct">{row.pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono cr-jobs-sfr">
                        {row.ok} / {row.failed} / {row.running}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--cr-text-muted)' }}>
                      No groups recorded for this batch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Bottom Section: Jobs Table Card with Status Filters (Matching Image 1) ── */}
      <section className="cr-jobs-panel">
        <header className="cr-jobs-panel-header">
          <div className="cr-jobs-panel-title-group">
            <ListOrdered size={18} className="cr-panel-icon" />
            <h3 className="cr-jobs-panel-title">Jobs ({counts.total})</h3>

            {/* Status Filter Buttons */}
            <div className="cr-jobs-status-filters" role="tablist">
              {[
                { id: 'ALL', label: 'All', count: counts.total },
                { id: 'DONE', label: 'Done', count: counts.done },
                { id: 'FAILED', label: 'Failed', count: counts.failed },
                { id: 'RUNNING', label: 'Running', count: counts.running },
                { id: 'HOLD', label: 'On Hold', count: counts.on_hold },
                { id: 'WAITING', label: 'Waiting', count: counts.waiting },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`cr-jobs-filter-btn ${statusFilter === f.id ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          <div className="cr-jobs-header-actions">
            <div className="cr-jobs-search-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={14}
                className="cr-search-icon"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--cr-text-muted)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
              <input
                type="text"
                placeholder="Search jobs, commands or target..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cr-jobs-search-input"
                style={{
                  paddingLeft: '34px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button type="button" className="cr-add-job-btn" onClick={onAddJob}>
              <Plus size={14} />
              <span>Add Job</span>
            </button>
          </div>
        </header>

        <div className="cr-jobs-table-wrap">
          <table className="cr-jobs-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Schedule</th>
                <th>Waits</th>
                <th>Target</th>
                <th>Command</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length > 0 ? (
                filteredJobs.map((j) => (
                  <tr
                    key={j.name}
                    className="cr-job-row"
                    onClick={() => onSelectJob(j.name)}
                    title={`Click to view job details for ${j.name}`}
                  >
                    <td className="cr-job-name-cell">
                      <strong>{j.name}</strong>
                    </td>
                    <td className="cr-job-sched-cell">
                      {j.schedule || 'No planned time, days ALL'}
                    </td>
                    <td className="cr-job-waits-cell">
                      {j.waits_for?.length ?? j.predecessors?.length ?? (j.waits ?? 1)}
                    </td>
                    <td className="cr-job-target-cell">
                      <span className="cr-target-pill">
                        {formatJobTarget(j.target, j.nodeid)}
                      </span>
                    </td>
                    <td className="cr-job-cmd-cell" title={j.command}>
                      <code>{j.command || '—'}</code>
                    </td>
                    <td className="cr-job-status-cell">
                      <span className={`cr-job-status-pill status-${(j.status || 'waiting').toLowerCase().replace(/\s+/g, '-')}`}>
                        {j.status || 'Waiting'}
                      </span>
                    </td>
                    <td className="cr-job-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cr-action-icon-btn"
                        title={`Run ${j.name}`}
                        onClick={() => onJobAction?.(j.name, 'run', j)}
                      >
                        <Play size={13} />
                      </button>
                      <button
                        type="button"
                        className="cr-action-icon-btn"
                        title={`Edit ${j.name}`}
                        onClick={() => onEditJob?.(j)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="cr-action-icon-btn danger"
                        title={`Delete ${j.name}`}
                        onClick={() => onDeleteJob?.(j)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--cr-text-muted)' }}>
                    No jobs match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default CockpitOverview;
