import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Server,
  FileText,
  TrendingUp,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function JobOverview({ env, jobName, onOpenLog }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!env || !jobName) return;
    setLoading(true);
    try {
      const data = await svc.getJobMetrics(env, jobName);
      setMetrics(data);
    } catch (err) {
      console.warn('Failed to fetch job metrics', err);
    } finally {
      setLoading(false);
    }
  }, [env, jobName]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="cr-scoped-loading">
        <span className="cr-spinner" />
        <p>Loading metrics for job {jobName}...</p>
      </div>
    );
  }

  const m = metrics || {};
  const trend = m.trend || [];
  const maxDur = Math.max(1, ...(trend.map((t) => t.duration || 0)));

  return (
    <div className="cr-job-overview">
      <div className="cr-job-overview-header">
        <div>
          <h2>Job Metrics: <span className="cr-highlight-text">{jobName}</span></h2>
          <span className="cr-scoped-sub">
            Aggregated execution metrics, run-over-run duration trend, and server telemetry for environment <strong>{env}</strong>.
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
          <span className="kpi-label">LIFETIME RUNS</span>
          <div className="kpi-val-group">
            <Activity size={18} className="kpi-icon" />
            <span className="kpi-value">{m.total_executions || 0}</span>
          </div>
          <span className="kpi-sub">Total recorded executions</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">SUCCESS RATE</span>
          <div className="kpi-val-group">
            <CheckCircle2 size={18} className="kpi-icon success" />
            <span className="kpi-value">{m.success_rate || 0}%</span>
          </div>
          <span className="kpi-sub">{m.success_count || 0} passed / {m.failed_count || 0} failed</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">AVG DURATION</span>
          <div className="kpi-val-group">
            <Clock size={18} className="kpi-icon" />
            <span className="kpi-value">{m.avg_duration || 0}s</span>
          </div>
          <span className="kpi-sub">Min: {m.min_duration || 0}s · Max: {m.max_duration || 0}s</span>
        </div>

        <div className="cr-job-kpi-card">
          <span className="kpi-label">ASSIGNED SERVER</span>
          <div className="kpi-val-group">
            <Server size={18} className="kpi-icon" />
            <span className="kpi-value text-sm">{m.target?.name || m.target?.host || 'Auto Target'}</span>
          </div>
          <span className="kpi-sub mono">{m.target ? `${m.target.host}:${m.target.port}` : 'Default target node'}</span>
        </div>
      </div>

      {/* Duration Trend Chart */}
      <div className="cr-job-trend-card">
        <div className="cr-trend-card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={15} />
            <h3>Execution Duration Trend (Last {trend.length} Runs)</h3>
          </div>
          <span className="cr-trend-hint">Bars represent duration in seconds per run</span>
        </div>

        {trend.length === 0 ? (
          <div className="cr-trend-empty">No run history recorded for this job yet.</div>
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
                    <span className="cr-trend-run-label mono" title={t.run_id}>
                      #{t.run_id.slice(-6)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Latest Execution Details */}
      {trend.length > 0 && (
        <div className="cr-job-latest-card">
          <div className="cr-latest-head">
            <Terminal size={15} />
            <h3>Most Recent Execution Status</h3>
          </div>
          {(() => {
            const latest = trend[trend.length - 1];
            return (
              <div className="cr-latest-details-grid">
                <div>
                  <span className="meta-label">Run ID:</span>
                  <strong className="mono">{latest.run_id}</strong>
                </div>
                <div>
                  <span className="meta-label">Status:</span>
                  <span className={`cr-status-badge ${String(latest.status).toLowerCase()}`}>
                    {latest.status}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Started:</span>
                  <span className="mono">{latest.started || '—'}</span>
                </div>
                <div>
                  <span className="meta-label">Ended:</span>
                  <span className="mono">{latest.ended || '—'}</span>
                </div>
                <div>
                  <span className="meta-label">Duration:</span>
                  <strong className="mono">{latest.duration}s</strong>
                </div>
                <div>
                  <button
                    type="button"
                    className="cr-btn sm outline"
                    onClick={() => onOpenLog && onOpenLog(jobName, latest.run_id)}
                  >
                    <FileText size={13} />
                    <span>View Run Log</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
