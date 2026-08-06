import React from 'react';
import { Server, Activity, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { useEodContext } from '../context/EodContext';
import { StatCard } from './StatCard';
import { StatusBadge } from './StatusBadge';

export function OverviewSection() {
  const { environments, isLoading, error, refreshEnvironments, metrics } = useEodContext();

  if (isLoading) {
    return <Loader message="Loading EOD overview status…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Overview status could not be loaded"
        description={error}
        onRetry={refreshEnvironments}
      />
    );
  }

  const { total, running, completed, failed, runningEnv } = metrics;

  return (
    <div className="eod-section">
      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div className="eod-stat-strip">
        <StatCard
          icon={<Server size={16} />}
          iconClass="s-blue"
          stripClass="s-blue"
          value={String(total)}
          label="Total Environments"
        />
        <StatCard
          icon={<Activity size={16} />}
          iconClass="s-green"
          stripClass="s-green"
          value={String(running)}
          label="Currently Running"
          live={running > 0}
        />
        <StatCard
          icon={<CheckCircle size={16} />}
          iconClass="s-purple"
          stripClass="s-purple"
          value={String(completed)}
          label="Completed Today"
        />
        <StatCard
          icon={<AlertCircle size={16} />}
          iconClass="s-red"
          stripClass="s-red"
          value={String(failed)}
          label="Failed / Errors"
        />
      </div>

      {/* ── Live Run Banner ────────────────────────────────────── */}
      {runningEnv && (
        <div className="eod-live-banner">
          <div className="eod-live-banner-header">
            <div className="eod-live-banner-title">
              <Activity size={12} className="eod-pulse-icon" style={{ color: 'var(--c-success)' }} />
              <span>Live Run — {runningEnv.name}</span>
            </div>
            <span className="eod-live-banner-timer">{runningEnv.duration}</span>
          </div>
          <div className="eod-live-banner-body" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <span className="eod-live-banner-step" style={{ fontWeight: 600 }}>
              JOB {runningEnv.runningJobNo || runningEnv.stepsDone || 1} OF {runningEnv.stepsTotal || 0}
            </span>
            <div className="eod-live-banner-track" style={{ flex: 1, minWidth: '150px' }}>
              <div className="eod-inline-fill" style={{ width: `${runningEnv.progress}%` }} />
            </div>
            <span className="eod-live-banner-pct">{runningEnv.progress}%</span>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
            <span>Current: <strong style={{ color: '#000000', fontFamily: 'monospace' }}>{runningEnv.runningJobName || runningEnv.currentStep || '—'}</strong></span>
            {runningEnv.nextJobName && (
              <span>Next: <strong style={{ color: '#6366f1', fontFamily: 'monospace' }}>{runningEnv.nextJobName}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ── Environment Status Table ────────────────────────────── */}
      <div className="eod-section-bar">
        <p className="eod-section-title">EOD Status</p>
        <button
          className="eod-add-btn"
          onClick={refreshEnvironments}
          style={{
            background: 'transparent',
            color: 'var(--c-primary)',
            border: '1px solid var(--c-primary)',
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div className="eod-env-table-wrap">
        <table className="eod-env-table">
          <thead>
            <tr className="eod-env-thead">
              <th className="eod-env-th eod-th-env">Environment</th>
              <th className="eod-env-th eod-th-status">Status</th>
              <th className="eod-env-th eod-th-progress">Progress</th>
              <th className="eod-env-th eod-th-date">Last Run</th>
              <th className="eod-env-th eod-th-date">Next Run</th>
              <th className="eod-env-th eod-th-dur">Duration</th>
            </tr>
          </thead>
          <tbody>
            {environments.map((env) => (
              <tr key={env.id} className="eod-env-row">
                <td className="eod-env-td eod-td-env">
                  <div className="eod-env-row-left">
                    <div className="eod-env-color-bar" style={{ background: env.color || '#6366f1' }} />
                    <span className="eod-env-row-name">{env.name}</span>
                  </div>
                </td>
                <td className="eod-env-td eod-td-status">
                  <StatusBadge status={env.status} />
                </td>
                <td className="eod-env-td eod-td-progress">
                  {env.status === 'running' || env.status === 'paused' ? (
                    <div className="eod-inline-progress">
                      <div className="eod-inline-bar">
                        <div className="eod-inline-fill" style={{ width: `${env.progress}%` }} />
                      </div>
                      <span className="eod-inline-pct">{env.progress}%</span>
                    </div>
                  ) : env.status === 'completed' ? (
                    <div className="eod-inline-progress">
                      <div className="eod-inline-bar">
                        <div className="eod-inline-fill" style={{ width: '100%', background: 'var(--c-success)' }} />
                      </div>
                      <span className="eod-inline-pct">100%</span>
                    </div>
                  ) : env.status === 'failed' ? (
                    <div className="eod-inline-progress">
                      <div className="eod-inline-bar">
                        <div className="eod-inline-fill" style={{ width: `${env.progress}%`, background: 'var(--c-danger)' }} />
                      </div>
                      <span className="eod-inline-pct" style={{ color: 'var(--c-danger)' }}>{env.progress}%</span>
                    </div>
                  ) : (
                    <span className="eod-td-empty">—</span>
                  )}
                </td>
                <td className="eod-env-td eod-td-date">{env.lastRun}</td>
                <td className="eod-env-td eod-td-date">{env.nextRun}</td>
                <td className="eod-env-td eod-td-dur">
                  <code className="eod-dur-code">{env.duration}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OverviewSection;
