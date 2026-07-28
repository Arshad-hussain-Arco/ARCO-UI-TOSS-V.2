import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Settings,
  Calendar,
  Play,
  Pause,
  Square,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Database,
  Terminal,
  RefreshCw,
  Plus,
  Server,
  Maximize2,
  Wifi,
  WifiOff,
  Edit2,
  Trash2,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { eodService } from '@services/eodService';

import './EODManagementPage.css';

/** End-of-day batch management: overview, configuration, schedules and controls. */
export function EODManagementPage() {
  useDocumentTitle('EOD Management');

  const [activeSection, setActiveSection] = useState('overview');

  const fetchEod = useCallback(() => eodService.getEodStatus(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchEod);

  /**
   * Environments are held locally because the control actions (start / pause /
   * stop) mutate them optimistically; the loaded payload seeds this state.
   */
  const [environments, setEnvironments] = useState([]);

  useEffect(() => {
    if (data?.environments) setEnvironments(data.environments);
  }, [data]);

  const schedules = data?.schedules ?? [];
  const handleToggleActive = (id) =>
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e)));
  const handleStartEOD = (id) =>
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'running', progress: 0, stepsDone: 0, currentStep: 'Initializing...' }
          : e,
      ),
    );
  const handlePauseEOD = (id) =>
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: e.status === 'paused' ? 'running' : 'paused' } : e,
      ),
    );
  const handleStopEOD = (id) =>
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: 'idle', progress: 0, currentStep: 'Stopped' } : e,
      ),
    );
  // Connection testing is a backend concern; wired up when the endpoint exists.
  const handleTestConnection = () => {};
  const running = environments.filter((e) => e.status === 'running').length;
  const completed = environments.filter((e) => e.status === 'completed').length;
  const failed = environments.filter((e) => e.status === 'failed').length;
  const tabs = [
    { key: 'overview', label: 'Overview', Icon: Activity },
    { key: 'configuration', label: 'Configuration', Icon: Settings },
    { key: 'schedules', label: 'Schedules', Icon: Calendar },
    { key: 'control', label: 'Control', Icon: Zap },
  ];
  if (error) {
    return (
      <ErrorState
        title="EOD status could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !data) {
    return <Loader message="Loading EOD status…" />;
  }

  return (
    <div className="eod-page">
      {/* Header */}
      <div className="eod-header">
        <div className="eod-header-left">
          <p className="eod-title">EOD Management</p>
          <p className="eod-subtitle">End-of-day processing across all environments</p>
        </div>
        <div className="eod-header-pills">
          {running > 0 && (
            <span className="eod-header-pill running">
              <span className="eod-pill-dot" />
              {running} Running
            </span>
          )}
          {completed > 0 && (
            <span className="eod-header-pill info">
              <CheckCircle size={10} />
              {completed} Done
            </span>
          )}
          {failed > 0 && (
            <span className="eod-header-pill alert">
              <AlertCircle size={10} />
              {failed} Failed
            </span>
          )}
        </div>
        <button className="eod-header-add-btn" onClick={() => setActiveSection('control')}>
          <Play size={12} /> Run EOD
        </button>
      </div>

      {/* Tabs */}
      <div className="eod-tabs">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`eod-tab${activeSection === key ? ' active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            <Icon size={13} className="eod-tab-icon" />
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="eod-body">
        {activeSection === 'overview' && <OverviewSection environments={environments} />}
        {activeSection === 'configuration' && (
          <ConfigSection
            environments={environments}
            onToggle={handleToggleActive}
            onTest={handleTestConnection}
          />
        )}
        {activeSection === 'schedules' && (
          <SchedulesSection schedules={schedules} environments={environments} />
        )}
        {activeSection === 'control' && (
          <ControlSection
            environments={environments}
            onStart={handleStartEOD}
            onPause={handlePauseEOD}
            onStop={handleStopEOD}
          />
        )}
      </div>
    </div>
  );
}
function OverviewSection({ environments }) {
  const total = environments.length;
  const running = environments.filter((e) => e.status === 'running').length;
  const completed = environments.filter((e) => e.status === 'completed').length;
  const failed = environments.filter((e) => e.status === 'failed').length;
  const runningEnv = environments.find((e) => e.status === 'running');
  return (
    <div className="eod-section">
      {/* Stat strip */}
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

      {/* Live run highlight */}
      {runningEnv && (
        <div
          style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--c-success)',
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              background: 'var(--c-success-light)',
              borderBottom: '1px solid rgba(16,185,129,.2)',
            }}
          >
            <Activity size={12} color="var(--c-success)" className="eod-pulse-icon" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success)' }}>
              Live Run — {runningEnv.name}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)' }}>
              {runningEnv.duration}
            </span>
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 140 }}>
              Step {runningEnv.stepsDone}/{runningEnv.stepsTotal} — {runningEnv.currentStep}
            </span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--bg-tertiary)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div className="eod-inline-fill" style={{ width: `${runningEnv.progress}%` }} />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--c-success)',
                minWidth: 35,
                textAlign: 'right',
              }}
            >
              {runningEnv.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Environment status table */}
      <div className="eod-section-bar">
        <p className="eod-section-title">Environment Status</p>
        <button
          className="eod-add-btn"
          style={{
            background: 'transparent',
            color: 'var(--c-primary)',
            border: '1px solid var(--c-primary)',
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div className="eod-env-table">
        <div className="eod-env-thead">
          <div className="eod-env-thead-cell">Environment</div>
          <div className="eod-env-thead-cell">Status</div>
          <div className="eod-env-thead-cell">Progress</div>
          <div className="eod-env-thead-cell">Last Run</div>
          <div className="eod-env-thead-cell">Next Run</div>
          <div className="eod-env-thead-cell">Duration</div>
        </div>
        {environments.map((env) => (
          <div key={env.id} className="eod-env-row">
            <div className="eod-env-row-left">
              <div className="eod-env-color-bar" style={{ background: env.color }} />
              <span className="eod-env-row-name">{env.name}</span>
            </div>
            <div className="eod-env-row-cell">
              <StatusBadge status={env.status} />
            </div>
            <div className="eod-inline-progress">
              {env.status === 'running' || env.status === 'paused' ? (
                <>
                  <div className="eod-inline-bar">
                    <div className="eod-inline-fill" style={{ width: `${env.progress}%` }} />
                  </div>
                  <span className="eod-inline-pct">{env.progress}%</span>
                </>
              ) : env.status === 'completed' ? (
                <>
                  <div className="eod-inline-bar">
                    <div
                      className="eod-inline-fill"
                      style={{ width: '100%', background: 'var(--c-success)' }}
                    />
                  </div>
                  <span className="eod-inline-pct">100%</span>
                </>
              ) : env.status === 'failed' ? (
                <>
                  <div className="eod-inline-bar">
                    <div
                      className="eod-inline-fill"
                      style={{ width: `${env.progress}%`, background: 'var(--c-danger)' }}
                    />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-danger)' }}>
                    {env.progress}%
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>—</span>
              )}
            </div>
            <div className="eod-env-row-cell">{env.lastRun}</div>
            <div className="eod-env-row-cell">{env.nextRun}</div>
            <div className="eod-env-row-cell">
              <code>{env.duration}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const CONFIG_META = {
  uat: {
    dbUser: 'eod_uat_svc',
    port: '1521',
    scripts: ['eod_ar.sql', 'eod_ap.sql', 'eod_gl.sql'],
    dbValid: true,
  },
  sit: {
    dbUser: 'eod_sit_svc',
    port: '1521',
    scripts: ['eod_ar.sql', 'eod_ap.sql', 'eod_gl.sql', 'eod_rep.sql'],
    dbValid: true,
  },
  prod: {
    dbUser: 'eod_prod_svc',
    port: '1522',
    scripts: ['eod_ar.sql', 'eod_ap.sql', 'eod_gl.sql', 'eod_rep.sql', 'eod_arch.sql'],
    dbValid: true,
  },
  dev: {
    dbUser: 'eod_dev_svc',
    port: '1521',
    scripts: ['eod_ar.sql', 'eod_gl.sql'],
    dbValid: false,
  },
};
function ConfigSection({ environments, onToggle, onTest }) {
  const [testingIds, setTestingIds] = useState(/* @__PURE__ */ new Set());
  const handleTest = (id) => {
    setTestingIds((prev) => /* @__PURE__ */ new Set([...prev, id]));
    onTest(id);
    setTimeout(() => {
      setTestingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }, 2e3);
  };
  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <p className="eod-section-title">Environment Configuration</p>
        <button className="eod-add-btn">
          <Plus size={11} /> New Environment
        </button>
      </div>

      <div className="eod-config-grid">
        {environments.map((env) => {
          const meta = CONFIG_META[env.id] || {
            dbUser: 'svc',
            port: '1521',
            scripts: [],
            dbValid: true,
          };
          return (
            <div key={env.id} className="eod-config-card">
              <div className="eod-config-head">
                <div className="eod-config-head-left">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: env.color,
                      flexShrink: 0,
                    }}
                  />
                  <p className="eod-config-env-name">{env.name}</p>
                  <StatusBadge status={env.status} />
                </div>
                <div className="eod-config-head-right">
                  <span className="eod-toggle-text">{env.isActive ? 'Enabled' : 'Disabled'}</span>
                  <span className="eod-toggle">
                    <input
                      type="checkbox"
                      checked={env.isActive}
                      onChange={() => onToggle(env.id)}
                      aria-label={`${env.isActive ? 'Disable' : 'Enable'} ${env.name}`}
                    />
                    <span className="eod-toggle-track" />
                  </span>
                  <button className="eod-icon-btn" title="Edit">
                    <Edit2 size={11} />
                  </button>
                  <button className="eod-icon-btn danger" title="Delete">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div className="eod-config-body">
                {/* Connection */}
                <div className="eod-config-group">
                  <div className="eod-config-group-title">
                    <Database size={10} /> Connection
                  </div>
                  {[
                    ['Server', env.server],
                    ['Database', env.database],
                    ['User', meta.dbUser],
                    ['Port', meta.port],
                  ].map(([label, val]) => (
                    <div key={label} className="eod-config-row">
                      <span className="eod-config-row-label">{label}</span>
                      <span className="eod-config-row-val">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Credentials */}
                <div className="eod-config-group">
                  <div className="eod-config-group-title">
                    <Settings size={10} /> Credentials
                  </div>
                  <div className={`eod-cred-row ${meta.dbValid ? 'ok' : 'err'}`}>
                    {meta.dbValid ? <Wifi size={11} /> : <WifiOff size={11} />}
                    {meta.dbValid ? 'Connection validated' : 'Connection failed \u2014 timeout'}
                    <span className={`eod-val-badge ${meta.dbValid ? 'ok' : 'err'}`}>
                      {meta.dbValid ? 'Valid' : 'Error'}
                    </span>
                  </div>
                </div>

                {/* Scripts */}
                <div className="eod-config-group">
                  <div className="eod-config-group-title">
                    <Terminal size={10} /> EOD Scripts ({meta.scripts.length})
                  </div>
                  <div className="eod-script-rows">
                    {meta.scripts.map((s, i) => (
                      <div key={s} className="eod-script-row">
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--text-tertiary)',
                            minWidth: 16,
                            textAlign: 'right',
                          }}
                        >
                          {i + 1}
                        </span>
                        <code>{s}</code>
                        <button className="eod-icon-btn" style={{ width: 20, height: 20 }}>
                          <Edit2 size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="eod-config-foot">
                <button
                  className="eod-test-btn"
                  onClick={() => handleTest(env.id)}
                  disabled={testingIds.has(env.id)}
                >
                  {testingIds.has(env.id) ? (
                    <>
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />{' '}
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi size={12} /> Test Connection
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function SchedulesSection({ schedules, environments }) {
  const getEnv = (envId) => environments.find((e) => e.id === envId);
  const days = ['Today', 'Tomorrow', 'Thu 25 Jul'];
  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <p className="eod-section-title">Scheduled Runs</p>
        <button className="eod-add-btn">
          <Plus size={11} /> Add Schedule
        </button>
      </div>

      {days.map((day) => (
        <div key={day} className="eod-schedule-wrap">
          <div className="eod-schedule-date-bar">
            <Calendar size={12} color="var(--c-primary)" />
            {day}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              {schedules.length} scheduled
            </span>
          </div>
          <div className="eod-timeline">
            {schedules.map((sch) => {
              const env = getEnv(sch.envId);
              return (
                <div key={sch.id} className="eod-tl-item">
                  <span className="eod-tl-time">{sch.time}</span>
                  <span
                    className="eod-tl-dot"
                    style={{ background: env?.color || 'var(--c-primary)' }}
                  />
                  <div className="eod-tl-content">
                    <span className="eod-tl-env">{env?.name || sch.envId}</span>
                    <span className="eod-tl-owner">
                      <Settings size={10} />
                      {sch.owner}
                    </span>
                    <span className="eod-tl-recur">
                      <RefreshCw size={9} />
                      {sch.recurrence}
                    </span>
                  </div>
                  <div className="eod-tl-actions">
                    <button className="eod-icon-btn">
                      <Edit2 size={11} />
                    </button>
                    <button className="eod-icon-btn danger">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
function ControlSection({ environments, onStart, onPause, onStop }) {
  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <p className="eod-section-title">Control Panel</p>
        <button
          className="eod-add-btn"
          onClick={() =>
            environments.forEach((e) => {
              if (e.status === 'idle') onStart(e.id);
            })
          }
        >
          <Play size={11} /> Run All Idle
        </button>
      </div>
      <div className="eod-control-grid">
        {environments.map((env) => (
          <CtrlCard key={env.id} env={env} onStart={onStart} onPause={onPause} onStop={onStop} />
        ))}
      </div>
    </div>
  );
}
function CtrlCard({ env, onStart, onPause, onStop }) {
  const isRunning = env.status === 'running';
  const isCompleted = env.status === 'completed';
  const isFailed = env.status === 'failed';
  const isPaused = env.status === 'paused';
  const canStart = env.status === 'idle' || env.status === 'failed';
  const canPause = isRunning;
  const canStop = isRunning || isPaused;
  return (
    <div className={`eod-ctrl-card ${env.status}`}>
      <div className={`eod-ctrl-strip ${env.status}`} />

      <div className="eod-ctrl-head">
        <span className="eod-ctrl-env-name">{env.name}</span>
        <div className="eod-ctrl-status" style={{ color: env.color, background: `${env.color}18` }}>
          {isRunning && <span className="eod-pill-dot" style={{ background: env.color }} />}
          {env.status.toUpperCase()}
        </div>
      </div>

      {/* Action row */}
      <div className="eod-ctrl-actions">
        <button
          className="eod-ctrl-btn eod-ctrl-btn-start"
          disabled={!canStart}
          onClick={() => onStart(env.id)}
        >
          <Play size={12} /> Start
        </button>
        <button
          className="eod-ctrl-btn eod-ctrl-btn-pause"
          disabled={!canPause && !isPaused}
          onClick={() => onPause(env.id)}
        >
          {isPaused ? (
            <>
              <Play size={12} /> Resume
            </>
          ) : (
            <>
              <Pause size={12} /> Pause
            </>
          )}
        </button>
        <button
          className="eod-ctrl-btn eod-ctrl-btn-stop"
          disabled={!canStop}
          onClick={() => onStop(env.id)}
        >
          <Square size={12} /> Stop
        </button>
      </div>

      {/* Progress */}
      {(isRunning || isPaused || isCompleted || isFailed) && (
        <div className="eod-ctrl-exec">
          <div className="eod-ctrl-exec-top">
            <span className="eod-ctrl-exec-label">
              Step {env.stepsDone}/{env.stepsTotal}
            </span>
            <span
              className="eod-ctrl-exec-pct"
              style={{
                color: isFailed
                  ? 'var(--c-danger)'
                  : isCompleted
                    ? 'var(--c-success)'
                    : 'var(--c-primary)',
              }}
            >
              {env.progress}%
            </span>
          </div>
          <div className="eod-ctrl-exec-bar">
            <div
              className="eod-ctrl-exec-fill"
              style={{
                width: `${env.progress}%`,
                background: isFailed
                  ? 'var(--c-danger)'
                  : isCompleted
                    ? 'var(--c-success)'
                    : 'linear-gradient(90deg, var(--c-primary-light), var(--c-primary))',
                animation: isRunning ? 'eod-shimmer 2s ease-in-out infinite' : 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eod-ctrl-exec-step">{env.currentStep}</span>
            <span className="eod-ctrl-exec-time">{env.duration}</span>
          </div>
        </div>
      )}

      {/* Log preview */}
      <div className="eod-log">
        <div className="eod-log-bar">
          <Terminal size={10} />
          Log Output
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{env.logs.length} lines</span>
          <button className="eod-log-expand-btn">
            <Maximize2 size={10} />
          </button>
        </div>
        <div className="eod-log-lines">
          {env.logs.map((line, i) => (
            <div
              key={i}
              className={`eod-log-line${line.includes('\u2713') ? ' ok' : i === env.logs.length - 1 && isRunning ? ' blink' : ''}`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="eod-ctrl-foot">
        <span className="eod-ctrl-foot-item">
          <Server size={10} />
          {env.server}
        </span>
        <span className="eod-ctrl-foot-item">
          <Database size={10} />
          {env.database}
        </span>
        <span className="eod-ctrl-foot-item" style={{ marginLeft: 'auto' }}>
          <Clock size={10} />
          {env.lastRun}
        </span>
      </div>
    </div>
  );
}
function StatCard({ icon, iconClass, stripClass, value, label, live = false }) {
  return (
    <div className={`eod-stat-card ${stripClass}`}>
      <div className={`eod-stat-icon ${iconClass}`}>{icon}</div>
      <div className="eod-stat-body">
        <span className="eod-stat-value">{value}</span>
        <span className="eod-stat-label">{label}</span>
      </div>
      {live && (
        <div className="eod-live-badge">
          <span className="eod-pill-dot" />
          LIVE
        </div>
      )}
    </div>
  );
}
function StatusBadge({ status }) {
  const icons = {
    running: <Activity size={9} />,
    completed: <CheckCircle size={9} />,
    failed: <AlertCircle size={9} />,
    idle: <Clock size={9} />,
    paused: <Pause size={9} />,
  };
  return (
    <span className={`eod-badge ${status}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
export default EODManagementPage;
