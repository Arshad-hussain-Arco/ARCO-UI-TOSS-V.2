import React, { useState } from 'react';
import { RunDetailModal } from './RunDetailModal';
import { formatFullDateTime } from '../scheduler/schedulerModel';

export function CockpitHistory({ runs = [], onSelectRun, currentRunId, env, isLoading = false }) {
  const list = (runs || []).filter((r) => {
    if (!r) return false;
    const rEnv = r.environment || r.partition;
    return !rEnv || String(rEnv).trim().toUpperCase() === String(env).trim().toUpperCase();
  });
  const [viewingRunId, setViewingRunId] = useState(null);

  return (
    <div className="cr-history-container">
      <div className="cr-history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Run Execution History</h2>
          <span className="cr-history-sub">
            Inspect past batch runs, execution durations, and metrics for environment{' '}
            <strong>{String(env).toUpperCase()}</strong>.
          </span>
        </div>
        {currentRunId && currentRunId !== 'current_workflow' && (
          <button
            type="button"
            className="cr-btn sm outline"
            onClick={() => onSelectRun('current_workflow', env)}
            title="Return to the active uploaded workflow in Cockpit"
          >
            ★ Switch to Current Uploaded Workflow
          </button>
        )}
      </div>

      <div className="cr-history-table-card">
        {isLoading ? (
          <div className="cr-history-empty" style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--cr-text-muted)' }}>
            <span className="cr-spinner" style={{ width: '28px', height: '28px', marginBottom: '12px' }} />
            <p style={{ margin: '8px 0 0', fontWeight: 500 }}>Loading run history...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="cr-history-empty" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--cr-text-muted)' }}>
            <p>No runs recorded yet for this environment.</p>
            <span style={{ fontSize: '12px' }}>Start a run from the Cockpit to view its history here.</span>
          </div>
        ) : (
          <table className="cr-history-table">
            <thead>
              <tr>
                <th>RUN ID</th>
                <th>SCHEDULE / JOB</th>
                <th>ENVIRONMENT</th>
                <th>STATUS</th>
                <th>STARTED AT</th>
                <th>ENDED AT</th>
                <th>TOTAL JOBS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const runId = r.id || r.run_id;
                const isCurrent = String(currentRunId) === String(runId);
                const status = r.status || 'Unknown';
                const started = r.started_at || r.started;
                const ended = r.ended_at || r.ended;
                const total = r.counts?.total ?? r.total_jobs ?? '—';
                const runEnv = r.environment || env;
                const runName = r.name || (r.target_job ? `Target: ${r.target_job}` : 'EOD Batch Run');

                return (
                  <tr key={runId} className={isCurrent ? 'is-active-row' : ''}>
                    <td>
                      <span className="cr-hist-run-id">#{runId}</span>
                      {isCurrent && <span className="cr-curr-pill">Active</span>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--c-primary, #005a36)', fontSize: '13px' }}>
                        {runName}
                      </span>
                    </td>
                    <td>
                      <span className={`cr-env-pill ${String(runEnv).toLowerCase()}`}>
                        {String(runEnv).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`cr-status-badge ${String(status).toLowerCase().replace(/\s+/g, '-')}`}>
                        {status}
                      </span>
                    </td>
                    <td className="mono">
                      {formatFullDateTime(started)}
                    </td>
                    <td className="mono">
                      {formatFullDateTime(ended, (status === 'RUNNING' || status === 'Running' ? 'In progress' : '—'))}
                    </td>
                    <td className="mono">{total}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="cr-btn sm outline"
                        onClick={() => setViewingRunId(runId)}
                        title="View complete run info, jobs table, and execution logs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Complete Run Detail & Logs Popup Modal ── */}
      <RunDetailModal
        isOpen={Boolean(viewingRunId)}
        runId={viewingRunId}
        env={env}
        onClose={() => setViewingRunId(null)}
      />
    </div>
  );
}

export default CockpitHistory;
