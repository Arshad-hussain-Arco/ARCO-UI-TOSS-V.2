import React, { useState } from 'react';
import { RunDetailModal } from './RunDetailModal';

export function CockpitHistory({ runs = [], onSelectRun, currentRunId, env }) {
  const list = runs || [];
  const [viewingRunId, setViewingRunId] = useState(null);

  return (
    <div className="cr-history-container">
      <div className="cr-history-header">
        <h2>Run Execution History</h2>
        <span className="cr-history-sub">
          Inspect past batch runs, execution durations, and metrics for environment{' '}
          <strong>{String(env).toUpperCase()}</strong>.
        </span>
      </div>

      <div className="cr-history-table-card">
        {list.length === 0 ? (
          <div className="cr-history-empty" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--cr-text-muted)' }}>
            <p>No runs recorded yet for this environment.</p>
            <span style={{ fontSize: '12px' }}>Start a run from the Cockpit to view its history here.</span>
          </div>
        ) : (
          <table className="cr-history-table">
            <thead>
              <tr>
                <th>RUN ID</th>
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

                return (
                  <tr key={runId} className={isCurrent ? 'is-active-row' : ''}>
                    <td>
                      <span className="cr-hist-run-id">#{runId}</span>
                      {isCurrent && <span className="cr-curr-pill">Active</span>}
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
                      {started ? new Date(started).toLocaleString() : '—'}
                    </td>
                    <td className="mono">
                      {ended ? new Date(ended).toLocaleString() : (status === 'RUNNING' || status === 'Running' ? 'In progress' : '—')}
                    </td>
                    <td className="mono">{total}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="cr-btn sm outline"
                          onClick={() => setViewingRunId(runId)}
                          title="View complete run info, jobs table, and execution logs"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={`cr-btn sm ${isCurrent ? 'cr-btn-outline' : 'primary'}`}
                          onClick={() => onSelectRun(runId, runEnv)}
                          title="Open run summary in Cockpit"
                        >
                          Summary
                        </button>
                      </div>
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
