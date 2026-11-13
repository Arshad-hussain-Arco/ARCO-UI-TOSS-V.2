import React, { useMemo } from 'react';
import { CockpitIcon } from './IconSprite';
import { tiles, trend, distribution, upcoming, runningRows, failureRows, niceTicks, groupRows } from './rundashUtils';
import { getGroupColor } from './cockpitData';

export function CockpitOverview({
  run,
  definition,
  folders,
  onSelectJob,
  onNavigateView,
  onStartRun,
  onCancelRun,
  canRun,
  isLoading = false,
}) {
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

  const counts = useMemo(() => {
    if (run.jobs && run.jobs.length > 0) {
      const jobs = run.jobs;
      let done = 0;
      let failed = 0;
      let running = 0;
      let on_hold = 0;
      let waiting = 0;
      let skipped = 0;
      let killed = 0;
      let queued = 0;

      for (const j of jobs) {
        const st = (j.status || '').toUpperCase();
        if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) done++;
        else if (['FAILED', 'ERROR', 'NOTOK'].includes(st)) failed++;
        else if (['RUNNING', 'ACTIVE'].includes(st)) running++;
        else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) on_hold++;
        else if (['KILLED', 'CANCELLED', 'ABORTED'].includes(st)) killed++;
        else if (['QUEUED', 'SUBMITTED'].includes(st)) queued++;
        else if (['SKIPPED', 'IGNORED'].includes(st)) skipped++;
        else waiting++;
      }
      return {
        total: jobs.length,
        done,
        failed,
        running,
        on_hold,
        waiting,
        skipped,
        killed,
        queued,
      };
    }
    return run.counts || {};
  }, [run.jobs, run.counts]);

  const tileItems = tiles(counts, run.status);
  const total = counts.total || (run.jobs ? run.jobs.length : 309);
  const completed = counts.done || 0;
  const isFinished = run.status?.toLowerCase() === 'finished' || (total > 0 && completed === total);
  const pct = total ? (isFinished ? 100 : Math.min(99, Math.floor((completed / total) * 100))) : 0;
  const tr = trend(run.jobs || [], run);

  // SVG Trend Bar Chart Calculations
  const W = 460;
  const H = 160;
  const P = { l: 30, r: 12, t: 14, b: 24 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  const buckets = tr.buckets && tr.buckets.length > 0 ? tr.buckets : [
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
  ];

  const totals = buckets.map((b) => (b.success || 0) + (b.failed || 0) + (b.running || 0));
  const maxInBuckets = Math.max(1, ...totals);
  const yTicks = niceTicks(Math.max(maxInBuckets, 40), 4);
  const topTick = yTicks[yTicks.length - 1] || 40;

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
      const text = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const x = P.l + bIndex * (bw + gap) + bw / 2;
      const anchor = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
      labels.push({ text, x, anchor });
    }
    return labels;
  }, [buckets, bw, gap, P.l]);

  // SVG Circular progress
  const ringRadius = 52;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circ - (pct / 100) * circ;

  const upcomingList = upcoming(run.jobs || [], 5);
  const runningList = runningRows(run.jobs || [], 5);
  const failureList = failureRows(run.jobs || [], 5);

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
      const lvl = job.level ?? def?.level ?? 1;
      if (lvl <= 3) return 'INTRADAY';
      if (lvl <= 8) return 'PRE-EOD';
      if (lvl <= 13) return 'MARKET-DATA';
      if (lvl <= 26) return 'TRADE-FEEDS';
      return 'EOD-CORE';
    };

    if (run?.jobs && run.jobs.length > 0) {
      return groupRows(run.jobs, inferGroup);
    }
    if (definition?.jobs && definition.jobs.length > 0) {
      return groupRows(
        definition.jobs.map((dj) => ({ ...dj, status: 'Waiting' })),
        inferGroup
      );
    }
    return [];
  }, [run?.jobs, definition?.jobs, folders]);

  const totalGroupJobs = useMemo(
    () => appGroups.reduce((acc, g) => acc + (g.total || 0), 0),
    [appGroups]
  );

  return (
    <div className="cr-overview-content">
      {/* ── Metric KPI Cards (6 items) ── */}
      <div className="cr-metric-grid">
        {tileItems.map((item) => (
          <div key={item.key} className={`cr-metric-card tone-${item.tone}`}>
            <div className="cr-mc-icon-wrapper">
              <CockpitIcon name={
                item.key === 'total' ? 'i-list' :
                item.key === 'completed' ? 'i-done' :
                item.key === 'failed' ? 'i-failed' :
                item.key === 'running' ? 'i-running' :
                item.key === 'hold' ? 'i-hold' : 'i-waiting'
              } />
            </div>
            <div className="cr-mc-details">
              <span className="cr-mc-label">{item.label}</span>
              <div className="cr-mc-val-row">
                <span className="cr-mc-value">{item.value}</span>
              </div>
              <span className="cr-mc-sub">{item.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Middle Section: 3 Cards (Trend, Run Status, Application Status) ── */}
      <div className="cr-middle-grid">
        {/* Panel 1: Job Status Trend */}
        <section className="cr-card cr-trend-card">
          <header className="cr-card-header">
            <div>
              <h2 className="cr-card-title">JOB STATUS TREND</h2>
              <span className="cr-card-sub">jobs per {tr.stepSeconds || 10} s, over the run</span>
            </div>
          </header>
          <div className="cr-trend-chart-body">
            <svg viewBox={`0 0 ${W} ${H}`} className="cr-trend-svg" preserveAspectRatio="none">
              {/* Y grid lines & labels */}
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

              {/* Stacked Bars with safe height clamping */}
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
                      <rect
                        x={x}
                        y={successY}
                        width={bw}
                        height={successH}
                        rx="1.5"
                        className="cr-bar-success"
                      >
                        <title>{`${b.success} finished`}</title>
                      </rect>
                    )}
                    {b.failed > 0 && (
                      <rect
                        x={x}
                        y={failedY}
                        width={bw}
                        height={failedH}
                        rx="1.5"
                        className="cr-bar-failed"
                      >
                        <title>{`${b.failed} failed`}</title>
                      </rect>
                    )}
                    {b.running > 0 && (
                      <rect
                        x={x}
                        y={runningY}
                        width={bw}
                        height={runningH}
                        rx="1.5"
                        className="cr-bar-running"
                      >
                        <title>{`${b.running} running`}</title>
                      </rect>
                    )}
                  </g>
                );
              })}

              {/* Dynamic Time tick labels at bottom */}
              {timeLabels.map((lbl, idx) => (
                <text
                  key={idx}
                  x={lbl.x}
                  y={H - 4}
                  className="cr-axis-label"
                  textAnchor={lbl.anchor}
                >
                  {lbl.text}
                </text>
              ))}
            </svg>
          </div>
          <footer className="cr-trend-legend">
            <span className="cr-leg-item"><i className="cr-leg-dot done" /> Finished</span>
            <span className="cr-leg-item"><i className="cr-leg-dot failed" /> Failed</span>
            <span className="cr-leg-item"><i className="cr-leg-dot running" /> Started, still running</span>
          </footer>
        </section>

        {/* Panel 2: Run Status */}
        <section className="cr-card cr-run-status-card">
          <header className="cr-card-header">
            <div>
              <h2 className="cr-card-title">RUN STATUS</h2>
              <span className="cr-card-sub">
                #{run.id} · {run.environment?.toUpperCase()}
              </span>
            </div>
          </header>
          <div className="cr-ring-section">
            <div className="cr-ring-wrapper">
              <svg width="130" height="130" viewBox="0 0 130 130" className="cr-ring-svg">
                <circle
                  cx="65"
                  cy="65"
                  r={ringRadius}
                  className="cr-ring-bg"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx="65"
                  cy="65"
                  r={ringRadius}
                  className={`cr-ring-progress ${isFinished ? 'done' : (run.status === 'Needs attention' ? 'hold' : 'running')}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circ}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="cr-ring-center">
                <span className="cr-ring-pct">{pct}%</span>
                <span className="cr-ring-done-lbl">{isFinished ? 'DONE' : 'RUNNING'}</span>
              </div>
            </div>
            <div className="cr-ring-status-col">
              <div className={`cr-ring-status-badge ${isFinished ? 'ok' : run.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                <CockpitIcon name={isFinished ? 'i-done' : (run.status === 'Needs attention' ? 'i-hold' : 'i-running')} className="sm" />
                {run.status === 'Needs attention' ? 'Needs attention' : (isFinished ? 'Done' : run.status)}
              </div>
              <div className="cr-ring-counts-meta">
                <b>{completed}</b>
                <span>{pct}%</span>
              </div>
            </div>
          </div>

          <div className="cr-run-meta-grid">
            <div className="cr-rm-item">
              <span className="cr-rm-k">FINISHED</span>
              <span className="cr-rm-v">{completed} / {total}</span>
            </div>
            <div className="cr-rm-item">
              <span className="cr-rm-k">TOOK</span>
              <span className="cr-rm-v">{run.took || '02:59'}</span>
            </div>
            <div className="cr-rm-item">
              <span className="cr-rm-k">STARTED</span>
              <span className="cr-rm-v">{run.started_at ? run.started_at.replace('T', ' ').replace('Z', '') : '–'}</span>
            </div>
            <div className="cr-rm-item">
              <span className="cr-rm-k">ENDED</span>
              <span className="cr-rm-v">{run.ended_at ? run.ended_at.replace('T', ' ').replace('Z', '') : '–'}</span>
            </div>
            <div className="cr-rm-item cr-rm-full">
              <span className="cr-rm-k">FILE</span>
              <span className="cr-rm-v mono">{run.file_name || 'murex_eod_full_20261027_1344.xml'}</span>
            </div>
          </div>
          <div className="cr-card-footer-pills">
            <span className="cr-pill-simulated">Simulated</span>
          </div>
        </section>

        {/* Panel 3: Application Status */}
        <section className="cr-card cr-app-status-card">
          <header className="cr-card-header">
            <div>
              <h2 className="cr-card-title">APPLICATION STATUS</h2>
              <span className="cr-card-sub">
                {appGroups.length} groups · {totalGroupJobs || total} jobs
              </span>
            </div>
            <button
              type="button"
              className="cr-link-btn"
              onClick={() => onNavigateView('flow')}
              title="View full DAG workflow"
            >
              View all
            </button>
          </header>
          <div className="cr-app-table-wrapper">
            <table className="cr-app-table">
              <thead>
                <tr>
                  <th>GROUP</th>
                  <th>STATE</th>
                  <th style={{ textAlign: 'right' }}>JOBS (S / F / R)</th>
                </tr>
              </thead>
              <tbody>
                {appGroups.length > 0 ? (
                  appGroups.map((row) => {
                    const color = getGroupColor(row.group);
                    return (
                      <tr
                        key={row.group}
                        className="cr-app-row clickable"
                        onClick={() => onNavigateView('flow', row.group)}
                        title={`Click to filter Flow by ${row.group} (${row.total} jobs)`}
                      >
                        <td className="cr-group-cell">
                          <div className="cr-group-title-row">
                            <span className="cr-group-dot" style={{ backgroundColor: color }} />
                            <b>{row.group}</b>
                            <span className="cr-group-pct">{row.pct}%</span>
                          </div>
                          <div
                            className="cr-group-bar"
                            title={`${row.group}: ${row.ok} completed, ${row.running} running, ${row.failed} failed, ${row.on_hold} on hold, ${row.waiting} waiting of ${row.total}`}
                          >
                            <div
                              className="cr-group-bar-fill done"
                              style={{ width: `${row.total ? (row.ok / row.total) * 100 : 0}%` }}
                            />
                            {row.running > 0 && (
                              <div
                                className="cr-group-bar-fill running"
                                style={{ width: `${row.total ? (row.running / row.total) * 100 : 0}%` }}
                              />
                            )}
                            {row.failed > 0 && (
                              <div
                                className="cr-group-bar-fill failed"
                                style={{ width: `${row.total ? (row.failed / row.total) * 100 : 0}%` }}
                              />
                            )}
                            {row.on_hold > 0 && (
                              <div
                                className="cr-group-bar-fill hold"
                                style={{ width: `${row.total ? (row.on_hold / row.total) * 100 : 0}%` }}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          {row.state === 'good' && (
                            <span className="cr-state-circle ok" title="All jobs completed successfully">
                              <CockpitIcon name="i-done" className="xs" />
                            </span>
                          )}
                          {row.state === 'run' && (
                            <span className="cr-state-circle running pulse" title={`${row.running} jobs actively running`}>
                              <CockpitIcon name="i-running" className="xs" />
                            </span>
                          )}
                          {row.state === 'bad' && (
                            <span className="cr-state-circle failed" title={`${row.failed} jobs failed in this group`}>
                              <CockpitIcon name="i-failed" className="xs" />
                            </span>
                          )}
                          {row.state === 'hold' && (
                            <span className="cr-state-circle hold" title={`${row.on_hold} jobs on hold`}>
                              <CockpitIcon name="i-hold" className="xs" />
                            </span>
                          )}
                          {(row.state === 'partial' || row.state === 'waiting') && (
                            <span className={`cr-state-circle ${row.state}`} title={`${row.ok} of ${row.total} completed`}>
                              <CockpitIcon name="i-waiting" className="xs" />
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono cr-jobs-sfr">
                          <span className={row.ok > 0 ? 's-val ok' : 's-val'}>{row.ok}</span>
                          <span className="sfr-slash"> / </span>
                          <span className={row.failed > 0 ? 'f-val bad' : 'f-val'}>{row.failed}</span>
                          <span className="sfr-slash"> / </span>
                          <span className={row.running > 0 ? 'r-val warn' : 'r-val'}>{row.running}</span>
                        </td>
                      </tr>
                    );
                  })
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
          <div className="cr-card-footer-legend">
            <span className="cr-leg-sub">Click a group to inspect in Flow</span>
          </div>
        </section>
      </div>

      {/* ── Bottom Section: 3 Cards (Upcoming, Running, Failures) ── */}
      <div className="cr-bottom-grid">
        {/* Upcoming Jobs */}
        <section className="cr-card cr-sub-panel">
          <header className="cr-card-header">
            <h2 className="cr-card-title">UPCOMING JOBS</h2>
            <button type="button" className="cr-btn cr-btn-outline xs" onClick={() => onNavigateView('flow')}>
              View all
            </button>
          </header>
          <div className="cr-sub-panel-body">
            {upcomingList.length ? (
              <div className="cr-sub-list">
                {upcomingList.map((j) => (
                  <div key={j.name} className="cr-sub-row" onClick={() => onSelectJob(j.name)}>
                    <span className="cr-sub-name">{j.name}</span>
                    <span className="cr-sub-badge waiting">{j.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cr-empty-sub">Nothing is waiting.</div>
            )}
          </div>
        </section>

        {/* Running Jobs */}
        <section className="cr-card cr-sub-panel">
          <header className="cr-card-header">
            <h2 className="cr-card-title">RUNNING JOBS ({runningList.length})</h2>
            <button type="button" className="cr-btn cr-btn-outline xs" onClick={() => onNavigateView('flow')}>
              View all
            </button>
          </header>
          <div className="cr-sub-panel-body">
            {runningList.length ? (
              <div className="cr-sub-list">
                {runningList.map((j) => (
                  <div key={j.name} className="cr-sub-row" onClick={() => onSelectJob(j.name)}>
                    <span className="cr-sub-name">{j.name}</span>
                    <span className="cr-sub-badge running">{j.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cr-empty-sub">Nothing is running right now.</div>
            )}
          </div>
        </section>

        {/* Recent Failures */}
        <section className="cr-card cr-sub-panel">
          <header className="cr-card-header">
            <h2 className="cr-card-title">RECENT FAILURES ({failureList.length})</h2>
          </header>
          <div className="cr-sub-panel-body">
            {failureList.length ? (
              <div className="cr-sub-list">
                {failureList.map((j) => (
                  <div key={j.name} className="cr-sub-row" onClick={() => onSelectJob(j.name)}>
                    <span className="cr-sub-name">{j.name}</span>
                    <span className="cr-sub-badge failed">{j.error_message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cr-failures-empty-box">
                <span className="cr-fe-icon">
                  <CockpitIcon name="i-done" />
                </span>
                <div className="cr-fe-text">
                  <b>No failures</b>
                  <span>No failed or killed jobs in this run.</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CockpitOverview;
