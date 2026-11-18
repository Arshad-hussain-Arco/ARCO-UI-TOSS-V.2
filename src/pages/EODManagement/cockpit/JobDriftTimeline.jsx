import { useEffect, useState, useMemo, useCallback } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function JobDriftTimeline({ env, jobName }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!env || !jobName) return;
    setLoading(true);
    try {
      const data = await svc.getJobHistory(env, jobName, 30);
      setHistory(data || []);
    } catch (err) {
      console.warn('Failed to fetch job drift timeline', err);
    } finally {
      setLoading(false);
    }
  }, [env, jobName]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const items = useMemo(() => {
    return [...history].reverse().filter((h) => h.started);
  }, [history]);

  if (loading) {
    return (
      <div className="cr-scoped-loading">
        <span className="cr-spinner" />
        <p>Loading timeline for job {jobName}...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="cr-timeline-empty">
        <span className="cr-tl-empty-icon">
          <Clock size={32} />
        </span>
        <h2>No Timeline Data for {jobName}</h2>
        <p>This job has not been executed yet in environment {env}.</p>
      </div>
    );
  }

  const maxDur = Math.max(1, ...(items.map((i) => i.duration || 0)));

  return (
    <div className="cr-job-drift-timeline">
      <div className="cr-job-overview-header">
        <div>
          <h2>Job Execution Window & SLA Drift: <span className="cr-highlight-text">{jobName}</span></h2>
          <span className="cr-scoped-sub">
            Run-over-run start time consistency and duration variance across past {items.length} batch executions in <strong>{env}</strong>.
          </span>
        </div>
        <button
          type="button"
          className="cr-btn sm outline"
          onClick={fetchHistory}
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="cr-drift-chart-card">
        <div className="cr-drift-chart-head">
          <span>Execution Window Comparison</span>
          <span className="cr-trend-hint">Start time & duration per run</span>
        </div>

        <div className="cr-drift-list">
          {items.map((item, idx) => {
            const isFail = ['FAILED', 'ERROR', 'NOTOK'].includes((item.status || '').toUpperCase());
            const dur = item.duration || 0;
            const barWidthPct = Math.max(4, Math.min(100, Math.round((dur / maxDur) * 80)));
            const startTimeStr = item.started ? new Date(item.started).toLocaleTimeString() : '—';
            const startDateStr = item.started ? new Date(item.started).toLocaleDateString() : '';

            return (
              <div key={idx} className="cr-drift-row">
                <div className="cr-drift-meta">
                  <span className="mono bold">#{item.run_id.slice(-8)}</span>
                  <span className="cr-drift-date mono">{startDateStr} {startTimeStr}</span>
                </div>

                <div className="cr-drift-track">
                  <div
                    className={`cr-drift-bar ${isFail ? 'failed' : 'success'}`}
                    style={{ width: `${barWidthPct}%` }}
                    title={`Run ID: ${item.run_id}\nStarted: ${item.started}\nDuration: ${dur}s\nStatus: ${item.status}`}
                  >
                    <span className="cr-drift-bar-text">{dur}s</span>
                  </div>
                </div>

                <div className="cr-drift-badge-col">
                  <span className={`cr-status-badge ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
