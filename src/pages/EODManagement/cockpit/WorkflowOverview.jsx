import { useState, useMemo } from 'react';
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
import { trend, niceTicks } from './rundashUtils';
import { formatClockTime } from '../scheduler/schedulerModel';

export function formatJobTarget(target, nodeid) {
  if (!target) return nodeid || '—';
  if (typeof target === 'string') return target;
  if (typeof target === 'object') {
    if (target.username && target.host) {
      return `${target.username}@${target.host}${target.port ? `:${target.port}` : ''}`;
    }
    if (target.target_name) return target.target_name;
    if (!target.ok) return target.message || target.code || 'Unmapped';
  }
  return nodeid || '—';
}

export function WorkflowOverview({
  folderName,
  run,
  definition,
  folders = [],
  onSelectJob,
  onJobAction,
  onPlayJob,
  onAddJob,
  onEditJob,
  onDeleteJob,
  isLoading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [breakdownMode, setBreakdownMode] = useState('stages'); // 'stages' | 'targets' | 'subapps'

  // Combine definition & run jobs strictly belonging to this workflow folder
  const allJobs = useMemo(() => {
    const norm = String(folderName || '').trim().toUpperCase();
    const matchesFolder = (j) => {
      const jf = String(j.folder || j.group || '').trim().toUpperCase();
      return jf === norm;
    };

    // Pre-populate definition job details for this folder
    const defMap = new Map();
    if (definition?.jobs) {
      for (const dj of definition.jobs) {
        if (matchesFolder(dj)) {
          defMap.set(dj.name, dj);
        }
      }
    }
    if (folders && folders.length > 0) {
      const targetFolder = folders.find(
        (f) => String(f.folder || f.name || '').trim().toUpperCase() === norm,
      );
      if (targetFolder?.jobs) {
        for (const fj of targetFolder.jobs) {
          const ex = defMap.get(fj.name) || {};
          defMap.set(fj.name, { ...ex, ...fj });
        }
      }
    }

    // 1. From active or staged run (overlay onto definition so command/target are never lost)
    if (run?.jobs && run.jobs.length > 0) {
      const filtered = run.jobs.filter(matchesFolder);
      const targetList = filtered.length > 0 ? filtered : (run.jobs.every(matchesFolder) ? run.jobs : []);
      if (targetList.length > 0) {
        return targetList.map((rj) => {
          const dj = defMap.get(rj.name) || {};
          return {
            ...dj,
            ...rj,
            target: rj.target || dj.target,
            command: rj.command || dj.command,
            schedule: rj.schedule || dj.schedule,
            nodeid: rj.nodeid || dj.nodeid,
            sub_application: rj.sub_application || dj.sub_application,
            sub_app: rj.sub_app || dj.sub_app,
            predecessors: rj.predecessors?.length ? rj.predecessors : (dj.predecessors || []),
          };
        });
      }
    }

    return Array.from(defMap.values());
  }, [run?.jobs, definition?.jobs, folders, folderName]);

  // Counts specific to this workflow
  const counts = useMemo(() => {
    let done = 0;
    let failed = 0;
    let running = 0;
    let on_hold = 0;
    let waiting = 0;

    for (const j of allJobs) {
      const st = String(j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) done++;
      else if (['FAILED', 'ERROR', 'NOTOK', 'KILLED'].includes(st)) failed++;
      else if (['RUNNING', 'ACTIVE', 'QUEUED'].includes(st)) running++;
      else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) on_hold++;
      else waiting++;
    }
    return {
      total: allJobs.length,
      done,
      failed,
      running,
      on_hold,
      waiting,
    };
  }, [allJobs]);

  const total = counts.total;
  const completed = counts.done;
  const isFinished =
    run?.status?.toLowerCase() === 'finished' ||
    run?.status?.toLowerCase() === 'done' ||
    (total > 0 && completed === total);
  const pct = total ? (isFinished ? 100 : Math.min(99, Math.floor((completed / total) * 100))) : 0;

  // Real trend calculations for this workflow
  const isReady =
    !run ||
    run.isReadyState ||
    (!run.started_at && !allJobs.some((j) => j.started_at));

  const tr = useMemo(() => {
    if (isReady || !allJobs.length) {
      return { stepSeconds: 10, buckets: [] };
    }
    return trend(allJobs, run || {});
  }, [allJobs, run, isReady]);

  const buckets = useMemo(() => {
    return tr.buckets && tr.buckets.length > 0 ? tr.buckets : [];
  }, [tr.buckets]);

  // SVG Trend Bar Chart Calculations
  const W = 460;
  const H = 160;
  const P = { l: 30, r: 12, t: 14, b: 24 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  const totals = buckets.map((b) => (b.success || 0) + (b.failed || 0) + (b.running || 0));
  const maxInBuckets = Math.max(1, ...totals);
  const yTicks = niceTicks(Math.max(maxInBuckets, 15), 4);
  const topTick = yTicks[yTicks.length - 1] || 15;

  const bw = Math.max(4, Math.floor(iw / (Math.max(1, buckets.length) * 1.35)));
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

  // Breakdown 1: Execution Stages / Levels (Topological DAG calculation)
  const stageGroups = useMemo(() => {
    const byName = new Map(allJobs.map((j) => [j.name, j]));
    const computedLevels = new Map();
    for (const j of allJobs) {
      if (j.level) {
        computedLevels.set(j.name, j.level);
      } else {
        const preds = (j.predecessors || j.waits_for || []).filter((p) => byName.has(p));
        if (preds.length === 0) computedLevels.set(j.name, 1);
      }
    }
    let changed = true;
    let iter = 0;
    while (changed && iter < 50) {
      changed = false;
      iter++;
      for (const j of allJobs) {
        if (!j.level) {
          const preds = (j.predecessors || j.waits_for || []).filter((p) => byName.has(p));
          if (preds.length > 0) {
            let maxP = 0;
            for (const p of preds) maxP = Math.max(maxP, computedLevels.get(p) || 0);
            const newL = maxP > 0 ? maxP + 1 : 1;
            if (computedLevels.get(j.name) !== newL) {
              computedLevels.set(j.name, newL);
              changed = true;
            }
          }
        }
      }
    }

    const map = new Map();
    for (const j of allJobs) {
      const lvl = computedLevels.get(j.name) || j.level || 1;
      const key = `Stage ${lvl}`;
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          level: lvl,
          total: 0,
          ok: 0,
          failed: 0,
          running: 0,
          on_hold: 0,
          waiting: 0,
        });
      }
      const r = map.get(key);
      r.total++;
      const st = String(j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) r.ok++;
      else if (['FAILED', 'ERROR', 'NOTOK', 'KILLED'].includes(st)) r.failed++;
      else if (['RUNNING', 'ACTIVE', 'QUEUED'].includes(st)) r.running++;
      else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) r.on_hold++;
      else r.waiting++;
    }

    return Array.from(map.values())
      .sort((a, b) => a.level - b.level)
      .map((r) => ({
        ...r,
        group: r.name,
        pct: r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0,
      }));
  }, [allJobs]);

  // Breakdown 2: Target Servers
  const targetGroups = useMemo(() => {
    const map = new Map();
    for (const j of allJobs) {
      const tgt = formatJobTarget(j.target, j.nodeid);
      if (!map.has(tgt)) {
        map.set(tgt, {
          name: tgt,
          total: 0,
          ok: 0,
          failed: 0,
          running: 0,
          on_hold: 0,
          waiting: 0,
        });
      }
      const r = map.get(tgt);
      r.total++;
      const st = String(j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) r.ok++;
      else if (['FAILED', 'ERROR', 'NOTOK', 'KILLED'].includes(st)) r.failed++;
      else if (['RUNNING', 'ACTIVE', 'QUEUED'].includes(st)) r.running++;
      else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) r.on_hold++;
      else r.waiting++;
    }

    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        ...r,
        group: r.name,
        pct: r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0,
      }));
  }, [allJobs]);

  // Breakdown 3: Sub-Applications (if defined in XML)
  const subAppGroups = useMemo(() => {
    const map = new Map();
    for (const j of allJobs) {
      const sub = j.sub_application || j.sub_app;
      if (!sub) continue;
      if (!map.has(sub)) {
        map.set(sub, {
          name: sub,
          total: 0,
          ok: 0,
          failed: 0,
          running: 0,
          on_hold: 0,
          waiting: 0,
        });
      }
      const r = map.get(sub);
      r.total++;
      const st = String(j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) r.ok++;
      else if (['FAILED', 'ERROR', 'NOTOK', 'KILLED'].includes(st)) r.failed++;
      else if (['RUNNING', 'ACTIVE', 'QUEUED'].includes(st)) r.running++;
      else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) r.on_hold++;
      else r.waiting++;
    }

    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        ...r,
        group: r.name,
        pct: r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0,
      }));
  }, [allJobs]);

  const hasSubApps = subAppGroups.length > 0;

  // Active breakdown rows
  const activeBreakdownRows = useMemo(() => {
    if (breakdownMode === 'targets') return targetGroups;
    if (breakdownMode === 'subapps' && hasSubApps) return subAppGroups;
    return stageGroups;
  }, [breakdownMode, targetGroups, subAppGroups, stageGroups, hasSubApps]);

  // Filtered Jobs for the Table
  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const st = String(j.status || '').toUpperCase();
        if (statusFilter === 'DONE' && !['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) return false;
        if (statusFilter === 'FAILED' && !['FAILED', 'ERROR', 'NOTOK', 'KILLED'].includes(st)) return false;
        if (statusFilter === 'RUNNING' && !['RUNNING', 'ACTIVE', 'QUEUED'].includes(st)) return false;
        if (statusFilter === 'HOLD' && !['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) return false;
        if (statusFilter === 'WAITING' && !['WAITING', 'SUBMITTED', 'PENDING'].includes(st) && st !== '') return false;
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

  if (isLoading) {
    return (
      <div className="cr-overview-content cr-loading-state">
        <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <span className="cr-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', margin: '12px 0 6px', color: 'var(--cr-text)' }}>
            Loading Workflow Overview...
          </h2>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--cr-text-muted)' }}>
            Fetching execution details and job metrics for workflow {folderName}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cr-overview-content">
      {/* ── KPI Summary Row (Matching Attached Image) ── */}
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

      {/* ── Middle Section: 3 Cards (Trend, Run Status, Workflow Execution Breakdown) ── */}
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
            {isReady || buckets.length === 0 ? (
              <div
                style={{
                  height: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cr-text-muted)',
                  gap: '8px',
                }}
              >
                <CockpitIcon name="i-waiting" className="md" />
                <span style={{ fontSize: '12.5px' }}>
                  Workflow ready to run. Start execution to display real-time progress trend.
                </span>
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
                  className={`cr-ring-progress ${isFinished ? 'done' : isReady ? 'waiting' : 'running'}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circ}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="cr-ring-center">
                <span className="cr-ring-pct">{pct}%</span>
                <span className="cr-ring-done-lbl">
                  {isFinished ? 'Done' : isReady ? 'Ready' : (run?.status || 'Running')}
                </span>
              </div>
            </div>

            <div className="cr-rs-meta-list">
              <div className="cr-rs-row">
                <span className="cr-rs-key">Run</span>
                <span className="cr-rs-val bold">
                  {isReady
                    ? `NEW BATCH - ${folderName}`
                    : `#${run?.id || '—'} · ${folderName}`}
                </span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Total Jobs</span>
                <span className="cr-rs-val bold">{total}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Started</span>
                <span className="cr-rs-val">{formatClockTime(run?.started_at)}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Ended</span>
                <span className="cr-rs-val">{formatClockTime(run?.ended_at)}</span>
              </div>
              <div className="cr-rs-row">
                <span className="cr-rs-key">Duration</span>
                <span className="cr-rs-val">{isReady ? '—' : (run?.took || '—')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Panel 3: Workflow Execution Breakdown (Replacing Application Status with Meaningful Workflow Data) */}
        <section className="cr-card cr-app-status-card">
          <header className="cr-card-header">
            <div className="cr-card-header-left">
              <GitFork size={16} className="cr-card-icon-title" />
              <h3 className="cr-card-title">Workflow Execution Breakdown</h3>
            </div>
            <div className="cr-pill-toggle">
              <button
                type="button"
                className={`cr-toggle-pill-btn ${breakdownMode === 'stages' ? 'is-active' : ''}`}
                onClick={() => setBreakdownMode('stages')}
                title="View breakdown by dependency execution stages/levels"
              >
                Stages
              </button>
              <button
                type="button"
                className={`cr-toggle-pill-btn ${breakdownMode === 'targets' ? 'is-active' : ''}`}
                onClick={() => setBreakdownMode('targets')}
                title="View breakdown by target servers"
              >
                Targets
              </button>
              {hasSubApps && (
                <button
                  type="button"
                  className={`cr-toggle-pill-btn ${breakdownMode === 'subapps' ? 'is-active' : ''}`}
                  onClick={() => setBreakdownMode('subapps')}
                  title="View breakdown by sub-applications"
                >
                  Sub-Apps
                </button>
              )}
            </div>
          </header>
          <div className="cr-app-table-wrapper">
            <table className="cr-app-table">
              <thead>
                <tr>
                  <th>
                    {breakdownMode === 'targets'
                      ? 'Target Server'
                      : breakdownMode === 'subapps'
                        ? 'Sub-Application'
                        : 'Stage / Level'}
                  </th>
                  <th>Progress</th>
                  <th style={{ textAlign: 'right' }}>Jobs (S / F / R)</th>
                </tr>
              </thead>
              <tbody>
                {activeBreakdownRows.length > 0 ? (
                  activeBreakdownRows.map((row) => (
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
                    <td
                      colSpan={3}
                      style={{
                        textAlign: 'center',
                        padding: '24px 8px',
                        color: 'var(--cr-text-muted)',
                      }}
                    >
                      No execution breakdown available for this workflow.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Bottom Section: Jobs Table Card with Status Filters (Matching Attached Image) ── */}
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
            <div
              className="cr-jobs-search-wrap"
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
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
                      {j.waits_for?.length ?? j.predecessors?.length ?? (j.waits ?? 0)}
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
                      <span
                        className={`cr-job-status-pill status-${String(j.status || 'waiting')
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {j.status || 'Waiting'}
                      </span>
                    </td>
                    <td className="cr-job-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cr-action-icon-btn"
                        title={`Run ${j.name}`}
                        onClick={() =>
                          onPlayJob
                            ? onPlayJob(j.name)
                            : onJobAction?.(j.name, 'run', j)
                        }
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
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: '32px 16px',
                      color: 'var(--cr-text-muted)',
                    }}
                  >
                    No jobs in workflow {folderName} match the selected filter.
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

export default WorkflowOverview;
