import React, { useEffect, useState, useMemo } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function WorkflowOverview({ env, folderName, run, onSelectJob }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    if (!env || !folderName) return;
    setLoading(true);
    try {
      const data = await svc.getWorkflowMetrics(env, folderName);
      setMetrics(data);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [env, folderName]);

  // Jobs belonging to this folder in the current active run
  const folderJobs = useMemo(() => {
    const list = run?.jobs || [];
    return list.filter((j) => (j.group || j.folder) === folderName);
  }, [run, folderName]);

  const counts = useMemo(() => {
    let done = 0;
    let failed = 0;
    let running = 0;
    let waiting = 0;
    for (const j of folderJobs) {
      const st = (j.status || '').toUpperCase();
      if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) done++;
      else if (['FAILED', 'ERROR', 'NOTOK'].includes(st)) failed++;
      else if (['RUNNING', 'ACTIVE'].includes(st)) running++;
      else waiting++;
    }
    return { total: folderJobs.length, done, failed, running, waiting };
  }, [folderJobs]);

  // Find slowest jobs in this folder
  const slowestJobs = useMemo(() => {
    return [...folderJobs]
      .filter((j) => j.duration && j.duration > 0)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);
  }, [folderJobs]);

  if (loading) {
    return (
      <div className="cr-scoped-loading">
        <span className="cr-spinner" />
        <p>Loading metrics for workflow {folderName}...</p>
      </div>
    );
  }

  const m = metrics || {};
  const trend = m.trend || [];
  const maxDur = Math.max(1, ...(trend.map((t) => t.duration || 0)));

  return (
    <div className="cr-workflow-overview">
      <div className="cr-job-overview-header">
        <div>
          <h2>Workflow Metrics: <span className="cr-highlight-text">{folderName}</span></h2>
          <span className="cr-scoped-sub">
            Aggregated workflow performance, bottleneck job analysis, and runtime trend in environment <strong>{env}</strong>.
          </span>
        </div>
        <button
          type="button"
          className="cr-btn sm outline"
          onClick={fetchMetrics}
          title="Refresh metrics"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="cr-job-kpi-grid">
        <div className="cr-job-kpi-card">
          <span className="kpi-label">TOTAL WORKFLOW RUNS</span>
          <div className="kpi-val-group">
            <Cpu size={18} className="kpi-icon" />
            <span className="kpi-value">{m.total_runs || 0}</span>
          </div>
          <span className="kpi-sub">Lifetime executions of {folderName}</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">WORKFLOW PASS RATE</span>
          <div className="kpi-val-group">
            <CheckCircle2 size={18} className="kpi-icon success" />
            <span className="kpi-value">
              {m.total_runs ? Math.round((m.success_count / m.total_runs) * 100) : 0}%
            </span>
          </div>
          <span className="kpi-sub">{m.success_count || 0} passed / {m.failed_count || 0} failed</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">AVG WORKFLOW DURATION</span>
          <div className="kpi-val-group">
            <Clock size={18} className="kpi-icon" />
            <span className="kpi-value">{m.avg_duration || 0}s</span>
          </div>
          <span className="kpi-sub">Mean runtime across all runs</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">ACTIVE RUN STATUS</span>
          <div className="kpi-val-group">
            <Layers size={18} className="kpi-icon" />
            <span className="kpi-value text-sm">
              {counts.total > 0 ? `${counts.done}/${counts.total} Done` : 'Idle / Ready'}
            </span>
          </div>
          <span className="kpi-sub">
            {counts.running} running · {counts.failed} failed · {counts.waiting} waiting
          </span>
        </div>
      </div>

      <div className="cr-workflow-cols-grid">
        {/* Left: Duration Trend */}
        <div className="cr-job-trend-card">
          <div className="cr-trend-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={15} />
              <h3>Workflow Runtime Trend ({trend.length} Runs)</h3>
            </div>
            <span className="cr-trend-hint">Total elapsed duration per run</span>
          </div>

          {trend.length === 0 ? (
            <div className="cr-trend-empty">No run history recorded for this workflow folder yet.</div>
          ) : (
            <div className="cr-job-trend-chart">
              <div className="cr-job-trend-bars">
                {trend.map((t, idx) => {
                  const dur = t.duration || 0;
                  const heightPct = Math.max(8, Math.round((dur / maxDur) * 100));
                  const isFail = (t.status || '').toUpperCase().includes('FAIL');

                  return (
                    <div key={idx} className="cr-trend-col">
                      <div className="cr-trend-bar-wrapper">
                        <div
                          className={`cr-trend-bar ${isFail ? 'failed' : 'success'}`}
                          style={{ height: `${heightPct}%` }}
                          title={`Run: ${t.run_id}\nDuration: ${dur}s\nStatus: ${t.status}\nStarted: ${t.started || '—'}`}
                        />
                      </div>
                      <span className="cr-trend-dur-label">{dur > 0 ? `${dur}s` : '0s'}</span>
                      <span className="cr-trend-run-label mono">#{t.run_id.slice(-6)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Bottleneck Jobs */}
        <div className="cr-job-latest-card">
          <div className="cr-latest-head">
            <Flame size={15} color="#e11d48" />
            <h3>Top Bottleneck Jobs in {folderName}</h3>
          </div>
          {slowestJobs.length === 0 ? (
            <p className="cr-empty-sub">Run duration data will appear here once jobs execute.</p>
          ) : (
            <div className="cr-slowest-jobs-list">
              {slowestJobs.map((j) => (
                <div
                  key={j.name}
                  className="cr-slowest-job-item"
                  onClick={() => onSelectJob && onSelectJob(j.name)}
                  title="Click to view detailed metrics for this job"
                >
                  <div className="cr-sjob-info">
                    <strong>{j.name}</strong>
                    <span className="cr-sjob-status mono">{j.status}</span>
                  </div>
                  <div className="cr-sjob-dur">
                    <span className="mono">{j.duration}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
