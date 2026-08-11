import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  LayoutGrid,
  List,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { useDebounce } from '@hooks/useDebounce';
import { eodService } from '@services/eodService';
import { StatusBadge } from './StatusBadge';
import { EnvModal } from './EnvModal';

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

export function ConfigSection() {
  const [environments, setEnvironments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [modalMode, setModalMode] = useState(null); // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  /** Fetch environment records directly when user visits Configuration page */
  const fetchEnvironments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const records = await eodService.getEodRecords();
      setEnvironments(records);
    } catch (err) {
      console.error('Failed to fetch EOD environment records:', err);
      setError(err?.message || 'Failed to load environment configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const openAdd = () => {
    setEditTarget({ ...BLANK_ENV });
    setModalMode('add');
  };
  const openEdit = (env) => {
    setEditTarget({ ...env });
    setModalMode('edit');
  };
  const closeModal = () => {
    setModalMode(null);
    setEditTarget(null);
  };

  /** Toggle Active status via API */
  const handleToggleActive = async (id) => {
    const targetEnv = environments.find((e) => e.id === id);
    if (!targetEnv) return;

    const newActiveState = !targetEnv.isActive;
    // Optimistic UI update
    setEnvironments((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isActive: newActiveState } : e))
    );

    try {
      await eodService.updateEodRecord(id, { ...targetEnv, isActive: newActiveState });
    } catch (err) {
      console.error(`Failed to update active state for environment ${id}:`, err);
      fetchEnvironments(); // Refresh on error
    }
  };

  /** Save (Create or Update) Environment via API */
  const handleSave = async (formData) => {
    try {
      const isExisting = formData.id && environments.some((e) => e.id === formData.id);
      if (isExisting) {
        await eodService.updateEodRecord(formData.id, formData);
      } else {
        await eodService.createEodRecord(formData);
      }
      closeModal();
      await fetchEnvironments();
    } catch (err) {
      console.error('Failed to save EOD environment record:', err);
      alert(err.response?.data?.message || err.message || 'Failed to save environment configuration');
    }
  };

  /** Delete Environment via API */
  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        await eodService.deleteEodRecord(deleteTarget.id);
        setDeleteTarget(null);
        await fetchEnvironments();
      } catch (err) {
        console.error('Failed to delete EOD environment record:', err);
        alert(err.response?.data?.message || err.message || 'Failed to delete environment configuration');
      }
    }
  };

  const filteredEnvironments = environments.filter((env) => {
    if (!debouncedSearchQuery.trim()) return true;
    const q = debouncedSearchQuery.toLowerCase();
    return (
      (env.name && env.name.toLowerCase().includes(q)) ||
      (env.serverIp && env.serverIp.toLowerCase().includes(q)) ||
      (env.userName && env.userName.toLowerCase().includes(q)) ||
      (env.startScript && env.startScript.toLowerCase().includes(q)) ||
      (env.scriptPath && env.scriptPath.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return <Loader message="Loading environment configurations…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Configurations could not be loaded"
        description={error}
        onRetry={fetchEnvironments}
      />
    );
  }

  return (
    <div className="eod-section">
      {/* ── Top Action Bar (Search + Refresh + View Toggle + New Environment) ── */}
      <div className="eod-section-bar">
        <div className="eod-search-wrapper">
          <Search size={13} className="eod-search-icon" />
          <input
            type="text"
            className="eod-search-input"
            placeholder="Search environment, IP, user, script..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
           style={{ paddingRight: '32px' }} />
      {searchQuery && (
        <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
          <X size={14} />
        </button>
      )}
          {searchQuery && (
            <button className="eod-search-clear" onClick={() => setSearchQuery('')}>
              <X size={11} />
            </button>
          )}
        </div>
        <div className="eod-cfg-topbar-right">
          <button
            type="button"
            className="eod-add-btn"
            onClick={fetchEnvironments}
            style={{
              background: 'transparent',
              color: 'var(--c-primary)',
              border: '1px solid var(--c-primary)',
            }}
            title="Refresh configurations"
          >
            <RefreshCw size={11} /> Refresh
          </button>
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

      {/* ── Content View / Empty State ───────────────────────────── */}
      {filteredEnvironments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No records found"
          description={
            searchQuery
              ? `No environment configurations matching "${searchQuery}"`
              : 'No environment configuration records available.'
          }
          action={
            <button className="eod-add-btn" onClick={openAdd}>
              <Plus size={11} /> New Environment
            </button>
          }
        />
      ) : (
        <>
          {/* ── Card View ───────────────────────────────────────────── */}
          {viewMode === 'card' && (
            <div className="eod-config-grid">
              {filteredEnvironments.map((env) => (
                <div key={env.id} className="eod-config-card">
                  {/* Card Header */}
                  <div className="eod-config-head">
                    <div className="eod-config-head-left">
                      <div className="eod-cfg-dot" style={{ background: env.color || '#6366f1' }} />
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
                            onChange={() => handleToggleActive(env.id)}
                            aria-label={`${env.isActive ? 'Disable' : 'Enable'} ${env.name}`}
                          />
                          <span className="eod-toggle-track" />
                        </span>
                      </label>
                      <button className="eod-icon-btn" title="Edit" onClick={() => openEdit(env)}>
                        <Edit2 size={11} />
                      </button>
                      <button
                        className="eod-icon-btn danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(env)}
                      >
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
                    <th className="eod-env-th" style={{ textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnvironments.map((env) => (
                    <tr key={env.id} className="eod-env-row">
                      <td className="eod-env-td">
                        <div className="eod-env-row-left">
                          <div
                            className="eod-env-color-bar"
                            style={{ background: env.color || '#6366f1' }}
                          />
                          <span className="eod-env-row-name">{env.name}</span>
                        </div>
                      </td>
                      <td className="eod-env-td">
                        <span className={`eod-active-badge ${env.isActive ? 'yes' : 'no'}`}>
                          {env.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="eod-env-td">
                        <code className="eod-dur-code">{env.startScript || '—'}</code>
                      </td>
                      <td className="eod-env-td">
                        <code className="eod-dur-code">{env.pauseScript || '—'}</code>
                      </td>
                      <td className="eod-env-td">
                        <code className="eod-dur-code">{env.stopScript || '—'}</code>
                      </td>
                      <td className="eod-env-td eod-td-path">{env.scriptPath || '—'}</td>
                      <td className="eod-env-td eod-td-path">{env.logFilePath || '—'}</td>
                      <td className="eod-env-td">{env.serverIp || '—'}</td>
                      <td className="eod-env-td">{env.port || '—'}</td>
                      <td className="eod-env-td">
                        <code className="eod-dur-code">{env.statusFileName || '—'}</code>
                      </td>
                      <td className="eod-env-td" style={{ textAlign: 'right' }}>
                        <div className="eod-tl-actions">
                          <button className="eod-icon-btn" title="Edit" onClick={() => openEdit(env)}>
                            <Edit2 size={11} />
                          </button>
                          <button
                            className="eod-icon-btn danger"
                            title="Delete"
                            onClick={() => setDeleteTarget(env)}
                          >
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
        </>
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
              <button className="eod-modal-close" onClick={() => setDeleteTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="eod-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action
                cannot be undone.
              </p>
            </div>
            <div className="eod-modal-footer">
              <button className="eod-modal-btn cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
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

export default ConfigSection;
