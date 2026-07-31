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
  AlertTriangle,
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
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  X,
  FileText,
  FolderOpen,
  KeyRound,
  Network,
  Search,
  User,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
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
    if (data?.environments) {
      // Seed extra config fields from ENV defaults if missing
      setEnvironments(
        data.environments.map((e) => ({
          serverIp: '192.168.1.1',
          userName: 'sourcesftp',
          password: '••••••••',
          port: '22',
          logFilePath: '/upload/csvfiles/oss/logs/',
          scriptPath: `/upload/csvfiles/oss/scripts/${e.id}/`,
          startScript: 'start.sh',
          pauseScript: 'pause.sh',
          stopScript: 'stop.sh',
          statusFileName: 'myjobstorun.txt',
          jobsFileName: `${e.name}_JobsToRun_Original.txt`,
          ...e,
        }))
      );
    }
  }, [data]);

  const schedules = data?.schedules ?? [];
  const handleToggleActive = (id) =>
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e)));
  const handleSaveEnv = (updated) =>
    setEnvironments((prev) =>
      prev.some((e) => e.id === updated.id)
        ? prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
        : [...prev, { ...updated, id: updated.name.toLowerCase(), status: 'idle', progress: 0, color: '#6366f1', logs: [], stepsDone: 0, stepsTotal: 12, currentStep: '', duration: '—', lastRun: '—', nextRun: '—', isActive: true }]
    );
  const handleDeleteEnv = (id) =>
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
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
      {/* ── Tabs (matching Leave Management page) ── */}
      <div className="eod-tabs">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className="eod-tab"
            data-active={activeSection === key}
            onClick={() => setActiveSection(key)}
          >
            <Icon className="eod-tab-icon" />
            <span className="eod-tab-label">{label}</span>
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
            onSave={handleSaveEnv}
            onDelete={handleDeleteEnv}
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
          {/* Header row: title left, timer right */}
          <div className="eod-live-banner-header">
            <div className="eod-live-banner-title">
              <Activity size={12} className="eod-pulse-icon" style={{ color: 'var(--c-success)' }} />
              <span>Live Run — {runningEnv.name}</span>
            </div>
            <span className="eod-live-banner-timer">{runningEnv.duration}</span>
          </div>
          {/* Body row: step label | progress bar | percentage */}
          <div className="eod-live-banner-body">
            <span className="eod-live-banner-step">
              Step {runningEnv.stepsDone}/{runningEnv.stepsTotal} — {runningEnv.currentStep}
            </span>
            <div className="eod-live-banner-track">
              <div className="eod-inline-fill" style={{ width: `${runningEnv.progress}%` }} />
            </div>
            <span className="eod-live-banner-pct">{runningEnv.progress}%</span>
          </div>
        </div>
      )}

      {/* ── Environment Status Table ────────────────────────────── */}
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
                {/* Col 1 — Environment */}
                <td className="eod-env-td eod-td-env">
                  <div className="eod-env-row-left">
                    <div className="eod-env-color-bar" style={{ background: env.color }} />
                    <span className="eod-env-row-name">{env.name}</span>
                  </div>
                </td>
                {/* Col 2 — Status badge (fixed width, centred) */}
                <td className="eod-env-td eod-td-status">
                  <StatusBadge status={env.status} />
                </td>
                {/* Col 3 — Progress bar + pct */}
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
                {/* Col 4 — Last Run */}
                <td className="eod-env-td eod-td-date">{env.lastRun}</td>
                {/* Col 5 — Next Run */}
                <td className="eod-env-td eod-td-date">{env.nextRun}</td>
                {/* Col 6 — Duration */}
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
/* ─── Default blank form shape ────────────────────────────────── */
const BLANK_ENV = {
  id: '',
  name: '',
  isActive: true,
  serverIp: '',
  userName: '',
  password: '',
  port: '22',
  logFilePath: '',
  scriptPath: '',
  startScript: 'start.sh',
  pauseScript: 'pause.sh',
  stopScript: 'stop.sh',
  statusFileName: 'myjobstorun.txt',
  jobsFileName: '',
};

/* ─── ConfigSection ────────────────────────────────────────────── */
function ConfigSection({ environments, onToggle, onSave, onDelete }) {
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [modalMode, setModalMode] = useState(null);  // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const openAdd = () => { setEditTarget({ ...BLANK_ENV }); setModalMode('add'); };
  const openEdit = (env) => { setEditTarget({ ...env }); setModalMode('edit'); };
  const closeModal = () => { setModalMode(null); setEditTarget(null); };

  const handleSave = (formData) => {
    onSave(formData);
    closeModal();
  };
  const confirmDelete = () => {
    if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null); }
  };

  const filteredEnvironments = environments.filter((env) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      env.name.toLowerCase().includes(q) ||
      (env.serverIp && env.serverIp.toLowerCase().includes(q)) ||
      (env.userName && env.userName.toLowerCase().includes(q)) ||
      (env.startScript && env.startScript.toLowerCase().includes(q)) ||
      (env.scriptPath && env.scriptPath.toLowerCase().includes(q))
    );
  });

  return (
    <div className="eod-section">
      {/* ── Top Action Bar (Search + View Toggle + New Environment) ── */}
      <div className="eod-section-bar">
        <div className="eod-search-wrapper">
          <Search size={13} className="eod-search-icon" />
          <input
            type="text"
            className="eod-search-input"
            placeholder="Search environment, IP, user, script..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="eod-search-clear" onClick={() => setSearchQuery('')}>
              <X size={11} />
            </button>
          )}
        </div>
        <div className="eod-cfg-topbar-right">
          {/* View toggle */}
          <div className="eod-view-toggle">
            <button
              className={`eod-view-btn${viewMode === 'card' ? ' active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card View"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              className={`eod-view-btn${viewMode === 'table' ? ' active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={13} />
            </button>
          </div>
          <button className="eod-add-btn" onClick={openAdd}>
            <Plus size={11} /> New Environment
          </button>
        </div>
      </div>

      {/* ── Card View ───────────────────────────────────────────── */}
      {viewMode === 'card' && (
        <div className="eod-config-grid">
          {filteredEnvironments.map((env) => (
            <div key={env.id} className="eod-config-card">
              {/* Card Header */}
              <div className="eod-config-head">
                <div className="eod-config-head-left">
                  <div className="eod-cfg-dot" style={{ background: env.color }} />
                  <p className="eod-config-env-name">{env.name}</p>
                  <StatusBadge status={env.status} />
                </div>
                <div className="eod-config-head-right">
                  <label className="eod-toggle-wrap">
                    <span className="eod-toggle-text">{env.isActive ? 'Enabled' : 'Disabled'}</span>
                    <span className="eod-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(env.isActive)}
                        onChange={() => onToggle(env.id)}
                        aria-label={`${env.isActive ? 'Disable' : 'Enable'} ${env.name}`}
                      />
                      <span className="eod-toggle-track" />
                    </span>
                  </label>
                  <button className="eod-icon-btn" title="Edit" onClick={() => openEdit(env)}>
                    <Edit2 size={11} />
                  </button>
                  <button className="eod-icon-btn danger" title="Delete" onClick={() => setDeleteTarget(env)}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Card Body — compact key-value grid */}
              <div className="eod-config-body">
                <div className="eod-cfg-kv-grid">
                  <span className="eod-cfg-k">Server IP</span>
                  <span className="eod-cfg-v">{env.serverIp || '—'}</span>

                  <span className="eod-cfg-k">Port</span>
                  <span className="eod-cfg-v">{env.port || '—'}</span>

                  <span className="eod-cfg-k">User</span>
                  <span className="eod-cfg-v">{env.userName || '—'}</span>

                  <span className="eod-cfg-k">Start Script</span>
                  <code className="eod-cfg-code">{env.startScript || '—'}</code>

                  <span className="eod-cfg-k">Pause Script</span>
                  <code className="eod-cfg-code">{env.pauseScript || '—'}</code>

                  <span className="eod-cfg-k">Stop Script</span>
                  <code className="eod-cfg-code">{env.stopScript || '—'}</code>

                  <span className="eod-cfg-k">Script Path</span>
                  <code className="eod-cfg-code eod-cfg-code-full">{env.scriptPath || '—'}</code>

                  <span className="eod-cfg-k">Log Path</span>
                  <code className="eod-cfg-code eod-cfg-code-full">{env.logFilePath || '—'}</code>

                  <span className="eod-cfg-k">Status File</span>
                  <code className="eod-cfg-code">{env.statusFileName || '—'}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table View ──────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="eod-env-table-wrap">
          <table className="eod-env-table eod-cfg-table">
            <thead>
              <tr className="eod-env-thead">
                <th className="eod-env-th">Environment</th>
                <th className="eod-env-th">Active</th>
                <th className="eod-env-th">Start Script</th>
                <th className="eod-env-th">Pause Script</th>
                <th className="eod-env-th">Stop Script</th>
                <th className="eod-env-th">EOD Path</th>
                <th className="eod-env-th">Log Path</th>
                <th className="eod-env-th">Server IP</th>
                <th className="eod-env-th">Port</th>
                <th className="eod-env-th">Status File</th>
                <th className="eod-env-th" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnvironments.map((env) => (
                <tr key={env.id} className="eod-env-row">
                  <td className="eod-env-td">
                    <div className="eod-env-row-left">
                      <div className="eod-env-color-bar" style={{ background: env.color }} />
                      <span className="eod-env-row-name">{env.name}</span>
                    </div>
                  </td>
                  <td className="eod-env-td">
                    <span className={`eod-active-badge ${env.isActive ? 'yes' : 'no'}`}>
                      {env.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="eod-env-td"><code className="eod-dur-code">{env.startScript || '—'}</code></td>
                  <td className="eod-env-td"><code className="eod-dur-code">{env.pauseScript || '—'}</code></td>
                  <td className="eod-env-td"><code className="eod-dur-code">{env.stopScript || '—'}</code></td>
                  <td className="eod-env-td eod-td-path">{env.scriptPath || '—'}</td>
                  <td className="eod-env-td eod-td-path">{env.logFilePath || '—'}</td>
                  <td className="eod-env-td">{env.serverIp || '—'}</td>
                  <td className="eod-env-td">{env.port || '—'}</td>
                  <td className="eod-env-td"><code className="eod-dur-code">{env.statusFileName || '—'}</code></td>
                  <td className="eod-env-td" style={{ textAlign: 'right' }}>
                    <div className="eod-tl-actions">
                      <button className="eod-icon-btn" title="Edit" onClick={() => openEdit(env)}>
                        <Edit2 size={11} />
                      </button>
                      <button className="eod-icon-btn danger" title="Delete" onClick={() => setDeleteTarget(env)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Modal ────────────────────────────────────── */}
      {modalMode && editTarget && (
        <EnvModal
          mode={modalMode}
          initial={editTarget}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* ── Delete Confirm Dialog ───────────────────────────────── */}
      {deleteTarget && (
        <div className="eod-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="eod-modal eod-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eod-modal-header">
              <span className="eod-modal-title" style={{ color: 'var(--c-danger)' }}>
                <AlertCircle size={15} /> Delete Environment
              </span>
              <button className="eod-modal-close" onClick={() => setDeleteTarget(null)}><X size={14} /></button>
            </div>
            <div className="eod-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="eod-modal-footer">
              <button className="eod-modal-btn cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="eod-modal-btn danger" onClick={confirmDelete}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── EnvModal (Add / Edit) ────────────────────────────────────── */
function EnvModal({ mode, initial, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('env'); // 'env' | 'script'
  const [form, setForm] = useState({ ...initial });
  const [showPwd, setShowPwd] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setCheck = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.checked }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, id: form.id || form.name.toLowerCase().replace(/\s+/g, '_') });
  };

  const isAdd = mode === 'add';
  const title = isAdd ? 'Add EOD Environment' : 'Edit EOD Environment';

  return (
    <div className="eod-modal-overlay" onClick={onClose}>
      <div className="eod-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="eod-modal-header">
          <span className="eod-modal-title">{title}</span>
          <button className="eod-modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Sub-tabs */}
        <div className="eod-modal-tabs">
          <button
            className={`eod-modal-tab${activeTab === 'env' ? ' active' : ''}`}
            onClick={() => setActiveTab('env')}
          >
            <Network size={12} /> Environment
          </button>
          <button
            className={`eod-modal-tab${activeTab === 'script' ? ' active' : ''}`}
            onClick={() => setActiveTab('script')}
          >
            <Terminal size={12} /> Scripts
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="eod-modal-body">

            {/* ── Tab 1: Environment ─────────────────────────── */}
            {activeTab === 'env' && (
              <div className="eod-modal-fields">
                <div className="eod-modal-field">
                  <label className="eod-modal-label">Environment Name</label>
                  <input
                    className="eod-modal-input"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="e.g. PRODUCTION"
                    disabled={!isAdd}
                    required
                  />
                </div>

                <div className="eod-modal-field eod-modal-field-row">
                  <label className="eod-modal-label">Is Active</label>
                  <label className="eod-toggle-wrap">
                    <span className="eod-toggle">
                      <input type="checkbox" checked={form.isActive} onChange={setCheck('isActive')} />
                      <span className="eod-toggle-track" />
                    </span>
                    <span className="eod-toggle-text">{form.isActive ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className="eod-modal-row2">
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Server IP</label>
                    <input className="eod-modal-input" value={form.serverIp} onChange={set('serverIp')} placeholder="192.168.1.24" />
                  </div>
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Port No</label>
                    <input className="eod-modal-input" value={form.port} onChange={set('port')} placeholder="22" type="number" />
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">User Name</label>
                  <input className="eod-modal-input" value={form.userName} onChange={set('userName')} placeholder="sourcesftp" />
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Password</label>
                  <div className="eod-modal-pwd-wrap">
                    <input
                      className="eod-modal-input"
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="••••••••"
                    />
                    <button type="button" className="eod-modal-pwd-eye" onClick={() => setShowPwd((v) => !v)}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Log File Path</label>
                  <input className="eod-modal-input" value={form.logFilePath} onChange={set('logFilePath')} placeholder="/upload/csvfiles/oss/logs/" />
                </div>
              </div>
            )}

            {/* ── Tab 2: Scripts ─────────────────────────────── */}
            {activeTab === 'script' && (
              <div className="eod-modal-fields">
                <div className="eod-modal-field">
                  <label className="eod-modal-label">Script Path</label>
                  <input className="eod-modal-input" value={form.scriptPath} onChange={set('scriptPath')} placeholder="/upload/csvfiles/oss/scripts/env1/" />
                </div>

                <div className="eod-modal-row2">
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Start Script</label>
                    <input className="eod-modal-input" value={form.startScript} onChange={set('startScript')} placeholder="start.sh" />
                  </div>
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Pause Script</label>
                    <input className="eod-modal-input" value={form.pauseScript} onChange={set('pauseScript')} placeholder="pause.sh" />
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Stop Script</label>
                  <input className="eod-modal-input" value={form.stopScript} onChange={set('stopScript')} placeholder="stop.sh" />
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Jobs To Run Status File Name</label>
                  <input className="eod-modal-input" value={form.statusFileName} onChange={set('statusFileName')} placeholder="myjobstorun.txt" />
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Jobs To Run Original File Name</label>
                  <input className="eod-modal-input" value={form.jobsFileName} onChange={set('jobsFileName')} placeholder="Dev_JobsToRun_Original.txt" />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="eod-modal-footer">
            <button type="button" className="eod-modal-btn cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="eod-modal-btn primary">
              {isAdd ? <><Plus size={12} /> Add</> : <><CheckCircle size={12} /> Update</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function formatDateGroup(dateVal) {
  if (!dateVal) return 'Today';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return String(dateVal);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) {
    return 'Today';
  }

  if (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  ) {
    return 'Tomorrow';
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

const DEFAULT_SCHEDULES = [
  {
    id: 's1',
    envId: 'prod',
    dateGroup: 'Today',
    time: '00:00',
    recurrence: 'Daily',
    isActive: true,
  },
  {
    id: 's2',
    envId: 'sit',
    dateGroup: 'Today',
    time: '22:00',
    recurrence: 'Daily',
    isActive: true,
  },
  {
    id: 's3',
    envId: 'uat',
    dateGroup: 'Tomorrow',
    time: '23:00',
    recurrence: 'Weekdays',
    isActive: true,
  },
  {
    id: 's4',
    envId: 'dev',
    dateGroup: 'Thu 25 Jul',
    time: '18:30',
    recurrence: 'Custom / One-time',
    isActive: true,
  },
];

function SchedulesSection({ schedules: initialSchedules, environments }) {
  const [scheduleList, setScheduleList] = useState(() => {
    if (initialSchedules && initialSchedules.length > 0) {
      return initialSchedules.map((s, idx) => ({
        id: s.id || `s-${idx}`,
        envId: s.envId || 'sit',
        dateGroup: s.dateGroup || (idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : 'Thu 25 Jul'),
        time: s.time || '22:00',
        recurrence: s.recurrence || 'Daily',
        isActive: s.isActive !== false,
      }));
    }
    return DEFAULT_SCHEDULES;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState(null);

  const getEnv = (envId) =>
    environments.find((e) => e.id === envId || e.name?.toLowerCase() === envId?.toLowerCase());

  const handleOpenAdd = (dateGroupPreset = 'Today') => {
    setEditingSchedule({
      id: '',
      envId: environments[0]?.id || 'sit',
      selectedDate: new Date(),
      time: '22:00',
      recurrence: 'Daily',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (sch, e) => {
    e?.stopPropagation();
    setEditingSchedule({
      ...sch,
      selectedDate: new Date(),
    });
    setModalOpen(true);
  };

  const handleSaveSchedule = (schData) => {
    const formattedDate = formatDateGroup(schData.selectedDate);
    const itemToSave = {
      id: schData.id || `sch-${Date.now()}`,
      envId: schData.envId,
      dateGroup: formattedDate,
      time: schData.time,
      recurrence: schData.recurrence,
      isActive: true,
    };

    if (schData.id) {
      setScheduleList((prev) => prev.map((s) => (s.id === schData.id ? itemToSave : s)));
    } else {
      setScheduleList((prev) => [...prev, itemToSave]);
    }
    setModalOpen(false);
  };

  const handleDeleteSchedule = (id) => {
    setScheduleList((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmSchedule(null);
  };

  const days = Array.from(
    new Set(['Today', 'Tomorrow', 'Thu 25 Jul', ...scheduleList.map((s) => s.dateGroup)])
  );

  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <div>
          <p className="eod-section-title">Scheduled Runs</p>
          <span className="eod-section-subtitle">Manage automated End-of-Day batch execution schedules</span>
        </div>
        <button type="button" className="eod-add-btn primary-green" onClick={() => handleOpenAdd('Today')}>
          <Plus size={13} /> Add Schedule
        </button>
      </div>

      <div className="eod-schedules-container">
        {days.map((day) => {
          const daySchedules = scheduleList.filter((s) => s.dateGroup === day);
          return (
            <div key={day} className="eod-schedule-card">
              <div className="eod-schedule-header">
                <div className="eod-schedule-header-title">
                  <Calendar size={14} className="eod-cal-icon" />
                  <span>{day}</span>
                </div>
                <span className="eod-schedule-count-pill">
                  {daySchedules.length} scheduled
                </span>
              </div>

              {daySchedules.length === 0 ? (
                <div className="eod-schedule-empty">
                  <Clock size={18} className="eod-empty-clock" />
                  <span>No scheduled runs for {day}.</span>
                  <button type="button" className="eod-empty-add-btn" onClick={() => handleOpenAdd(day)}>
                    <Plus size={11} /> Add Schedule
                  </button>
                </div>
              ) : (
                <div className="eod-timeline-list">
                  {daySchedules.map((sch) => {
                    const env = getEnv(sch.envId);
                    const envName = env?.name || sch.envId?.toUpperCase() || 'ENVIRONMENT';
                    const envColor = env?.color || '#005A36';

                    return (
                      <div key={sch.id} className="eod-sch-row-item">
                        {/* Time Column */}
                        <div className="eod-sch-time-col">
                          <span className="eod-sch-time-tag">{sch.time}</span>
                        </div>

                        {/* Dot Timeline Connector */}
                        <div className="eod-sch-dot-wrap">
                          <span className="eod-sch-dot" style={{ background: envColor, color: envColor }} />
                        </div>

                        {/* Details Group */}
                        <div className="eod-sch-details-col">
                          <div className="eod-sch-env-badge">
                            <span className="eod-sch-env-dot" style={{ background: envColor }} />
                            <span className="eod-sch-env-name">{envName}</span>
                          </div>

                          <div className="eod-sch-recur-pill">
                            <RefreshCw size={10} />
                            <span>{sch.recurrence}</span>
                          </div>
                        </div>

                        {/* Actions Column */}
                        <div className="eod-sch-actions-col">
                          <button
                            type="button"
                            className="eod-icon-btn"
                            onClick={(e) => handleOpenEdit(sch, e)}
                            title="Edit Schedule"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className="eod-icon-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmSchedule(sch);
                            }}
                            title="Delete Schedule"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Schedule Modal Overlay */}
      {modalOpen && editingSchedule && (
        <ScheduleModal
          isOpen={modalOpen}
          schedule={editingSchedule}
          environments={environments}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveSchedule}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSchedule && (
        <AdminModal
          isOpen={Boolean(deleteConfirmSchedule)}
          onClose={() => setDeleteConfirmSchedule(null)}
          title="Delete Schedule"
          size="sm"
        >
          <div className="eod-delete-modal-body">
            <AlertTriangle size={24} className="eod-danger-icon" />
            <p>
              Are you sure you want to delete the schedule for{' '}
              <strong>{getEnv(deleteConfirmSchedule.envId)?.name || deleteConfirmSchedule.envId}</strong> at{' '}
              <strong>{deleteConfirmSchedule.time}</strong>?
            </p>
          </div>
          <div className="eod-modal-footer">
            <button type="button" className="eod-modal-btn cancel" onClick={() => setDeleteConfirmSchedule(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="eod-modal-btn danger"
              onClick={() => handleDeleteSchedule(deleteConfirmSchedule.id)}
            >
              Delete Schedule
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function ScheduleModal({ isOpen, schedule, environments, onClose, onSave }) {
  const [form, setForm] = useState({
    id: schedule.id || '',
    envId: schedule.envId || (environments[0]?.id || 'sit'),
    selectedDate: schedule.selectedDate || new Date(),
    time: schedule.time || '22:00',
    recurrence: schedule.recurrence || 'Daily',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(form.id);

  const validate = () => {
    const errs = {};
    if (!form.envId) errs.envId = 'Environment is required';
    if (!form.selectedDate) errs.selectedDate = 'Schedule Date is required';
    if (!form.time) errs.time = 'Schedule Time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setTimeout(() => {
      onSave(form);
      setIsSaving(false);
    }, 250);
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="eod-schedule-modal-form">
        <div className="eod-modal-field-group">
          {/* Environment Selection */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              Environment <span className="req">*</span>
            </label>
            <select
              className={`eod-modal-input ${errors.envId ? 'error' : ''}`}
              value={form.envId}
              onChange={(e) => {
                setForm({ ...form, envId: e.target.value });
                if (errors.envId) setErrors({ ...errors, envId: null });
              }}
            >
              <option value="" disabled>Select environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.status.toUpperCase()})
                </option>
              ))}
            </select>
            {errors.envId && <span className="eod-field-error">{errors.envId}</span>}
          </div>

          {/* Recurrence */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              Recurrence <span className="req">*</span>
            </label>
            <select
              className="eod-modal-input"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
            >
              <option value="Daily">Daily</option>
              <option value="Weekdays">Weekdays</option>
              <option value="Weekly">Weekly</option>
              <option value="Custom / One-time">Custom / One-time</option>
            </select>
          </div>

          {/* Date & Time Row */}
          <div className="eod-modal-row2">
            <div className="eod-modal-field">
              <label className="eod-modal-label">
                Schedule Date <span className="req">*</span>
              </label>
              <DatePicker
                value={form.selectedDate}
                onChange={(d) => {
                  setForm({ ...form, selectedDate: d });
                  if (errors.selectedDate) setErrors({ ...errors, selectedDate: null });
                }}
                placeholder="Select schedule date"
                width="100%"
              />
              {errors.selectedDate && <span className="eod-field-error">{errors.selectedDate}</span>}
            </div>

            <div className="eod-modal-field">
              <label className="eod-modal-label">
                Schedule Time <span className="req">*</span>
              </label>
              <input
                type="time"
                className={`eod-modal-input ${errors.time ? 'error' : ''}`}
                value={form.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  if (errors.time) setErrors({ ...errors, time: null });
                }}
              />
              {errors.time && <span className="eod-field-error">{errors.time}</span>}
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="eod-modal-footer">
          <button type="button" className="eod-modal-btn cancel" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="eod-modal-btn primary-green" disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw size={12} className="eod-pulse-icon" /> Saving...
              </>
            ) : isEdit ? (
              <>
                <CheckCircle size={12} /> Update Schedule
              </>
            ) : (
              <>
                <Plus size={12} /> Add Schedule
              </>
            )}
          </button>
        </div>
      </form>
    </AdminModal>
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
