import React, { useEffect, useState } from 'react';
import { Activity, FileText, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';
import { formatFullDateTime } from '../scheduler/schedulerModel';

export function JobHistoryTable({ env, jobName, onOpenLog }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!env || !jobName) return;
    setLoading(true);
    try {
      const data = await svc.getJobHistory(env, jobName, 50);
      setHistory(data || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [env, jobName]);

  return (
    <div className="cr-history-container">
      <div className="cr-history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Execution History: <span className="cr-highlight-text">{jobName}</span></h2>
          <span className="cr-history-sub">
            All historical executions and logs of <strong>{jobName}</strong> across batch runs in <strong>{env}</strong>.
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
            <p>Loading execution history for {jobName}...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="cr-history-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p>No historical runs found for {jobName}.</p>
          </div>
        ) : (
          <table className="cr-history-table">
            <thead>
              <tr>
                <th>RUN ID</th>
                <th>STATUS</th>
                <th>STARTED</th>
                <th>ENDED</th>
                <th>DURATION</th>
                <th>EXIT CODE</th>
                <th>TARGET / NODE</th>
                <th>ATTEMPTS</th>
                <th style={{ textAlign: 'right' }}>LOG</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => {
                const status = h.status || 'Unknown';
                const isFail = ['FAILED', 'ERROR', 'NOTOK'].includes(status.toUpperCase());
                return (
                  <tr key={idx}>
                    <td>
                      <span className="cr-hist-run-id">#{h.run_id}</span>
                    </td>
                    <td>
                      <span className={`cr-status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {status}
                      </span>
                    </td>
                    <td className="mono">{formatFullDateTime(h.started)}</td>
                    <td className="mono">{formatFullDateTime(h.ended, status === 'RUNNING' ? 'Running' : '—')}</td>
                    <td className="mono">{h.duration !== null ? `${h.duration}s` : '—'}</td>
                    <td className="mono">
                      <span style={{ color: isFail ? '#e11d48' : 'inherit', fontWeight: isFail ? 600 : 'normal' }}>
                        {h.exit_code !== null ? h.exit_code : '—'}
                      </span>
                    </td>
                    <td className="mono">{h.target || '—'}</td>
                    <td className="mono">{h.attempts || 1}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="cr-btn sm outline"
                        onClick={() => onOpenLog && onOpenLog(jobName, h.run_id)}
                        title="View Execution Log"
                      >
                        <FileText size={12} />
                        <span>Log</span>
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
