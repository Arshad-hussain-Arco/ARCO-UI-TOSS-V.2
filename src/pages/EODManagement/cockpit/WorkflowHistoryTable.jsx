import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, FileText } from 'lucide-react';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';
import { formatFullDateTime } from '../scheduler/schedulerModel';

export function WorkflowHistoryTable({ env, folderName, onSelectRun }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!env || !folderName) return;
    setLoading(true);
    try {
      const data = await svc.getWorkflowHistory(env, folderName, 50);
      setHistory(data || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [env, folderName]);

  return (
    <div className="cr-history-container">
      <div className="cr-history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Workflow History: <span className="cr-highlight-text">{folderName}</span></h2>
          <span className="cr-history-sub">
            Historical executions of folder <strong>{folderName}</strong> across all batch runs in <strong>{env}</strong>.
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

      <div className="cr-history-table-card">
        {loading ? (
          <div className="cr-history-empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <span className="cr-spinner" style={{ width: '28px', height: '28px', marginBottom: '12px' }} />
            <p>Loading workflow history for {folderName}...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="cr-history-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p>No historical runs found for workflow {folderName}.</p>
          </div>
        ) : (
          <table className="cr-history-table">
            <thead>
              <tr>
                <th>RUN ID</th>
                <th>WORKFLOW NAME</th>
                <th>STATUS</th>
                <th>STARTED</th>
                <th>ENDED</th>
                <th>DURATION</th>
                <th>STARTED BY</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => {
                const status = h.status || 'Unknown';
                return (
                  <tr key={idx}>
                    <td>
                      <span className="cr-hist-run-id">#{h.run_id}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--c-primary, #005a36)' }}>
                        {h.name || folderName}
                      </span>
                    </td>
                    <td>
                      <span className={`cr-status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {status}
                      </span>
                    </td>
                    <td className="mono">{formatFullDateTime(h.started)}</td>
                    <td className="mono">{formatFullDateTime(h.ended, status === 'RUNNING' ? 'Running' : '—')}</td>
                    <td className="mono">{h.duration !== null ? `${h.duration}s` : '—'}</td>
                    <td>{h.started_by || 'scheduler'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="cr-btn sm outline"
                        onClick={() => onSelectRun && onSelectRun(h.run_id)}
                        title="Inspect this specific run in Cockpit"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
