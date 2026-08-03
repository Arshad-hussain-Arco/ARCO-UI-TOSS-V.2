import React, { useState } from 'react';
import { X, Network, Terminal, Eye, EyeOff, Plus, CheckCircle } from 'lucide-react';

export function EnvModal({ mode, initial, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('env'); // 'env' | 'script'
  const [form, setForm] = useState({ ...initial });
  const [showPwd, setShowPwd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setCheck = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        ...form,
        id: form.id || form.name.toLowerCase().replace(/\s+/g, '_'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdd = mode === 'add';
  const title = isAdd ? 'Add EOD Environment' : 'Edit EOD Environment';

  return (
    <div className="eod-modal-overlay" onClick={onClose}>
      <div className="eod-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="eod-modal-header">
          <span className="eod-modal-title">{title}</span>
          <button className="eod-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="eod-modal-tabs">
          <button
            type="button"
            className={`eod-modal-tab${activeTab === 'env' ? ' active' : ''}`}
            onClick={() => setActiveTab('env')}
          >
            <Network size={12} /> Environment
          </button>
          <button
            type="button"
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
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={setCheck('isActive')}
                      />
                      <span className="eod-toggle-track" />
                    </span>
                    <span className="eod-toggle-text">
                      {form.isActive ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="eod-modal-row2">
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Server IP</label>
                    <input
                      className="eod-modal-input"
                      value={form.serverIp}
                      onChange={set('serverIp')}
                      placeholder="192.168.1.24"
                    />
                  </div>
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Port No</label>
                    <input
                      className="eod-modal-input"
                      value={form.port}
                      onChange={set('port')}
                      placeholder="22"
                      type="number"
                    />
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">User Name</label>
                  <input
                    className="eod-modal-input"
                    value={form.userName}
                    onChange={set('userName')}
                    placeholder="sourcesftp"
                  />
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
                    <button
                      type="button"
                      className="eod-modal-pwd-eye"
                      onClick={() => setShowPwd((v) => !v)}
                    >
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Log File Path</label>
                  <input
                    className="eod-modal-input"
                    value={form.logFilePath}
                    onChange={set('logFilePath')}
                    placeholder="/upload/csvfiles/oss/logs/"
                  />
                </div>
              </div>
            )}

            {/* ── Tab 2: Scripts ─────────────────────────────── */}
            {activeTab === 'script' && (
              <div className="eod-modal-fields">
                <div className="eod-modal-field">
                  <label className="eod-modal-label">Script Path</label>
                  <input
                    className="eod-modal-input"
                    value={form.scriptPath}
                    onChange={set('scriptPath')}
                    placeholder="/upload/csvfiles/oss/scripts/env1/"
                  />
                </div>

                <div className="eod-modal-row2">
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Start Script</label>
                    <input
                      className="eod-modal-input"
                      value={form.startScript}
                      onChange={set('startScript')}
                      placeholder="start.sh"
                    />
                  </div>
                  <div className="eod-modal-field">
                    <label className="eod-modal-label">Pause Script</label>
                    <input
                      className="eod-modal-input"
                      value={form.pauseScript}
                      onChange={set('pauseScript')}
                      placeholder="pause.sh"
                    />
                  </div>
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Stop Script</label>
                  <input
                    className="eod-modal-input"
                    value={form.stopScript}
                    onChange={set('stopScript')}
                    placeholder="stop.sh"
                  />
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Jobs To Run Status File Name</label>
                  <input
                    className="eod-modal-input"
                    value={form.statusFileName}
                    onChange={set('statusFileName')}
                    placeholder="myjobstorun.txt"
                  />
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">Jobs To Run Original File Name</label>
                  <input
                    className="eod-modal-input"
                    value={form.jobsFileName}
                    onChange={set('jobsFileName')}
                    placeholder="Dev_JobsToRun_Original.txt"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="eod-modal-footer">
            <button type="button" className="eod-modal-btn cancel" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="eod-modal-btn primary" disabled={isSaving}>
              {isAdd ? (
                <>
                  <Plus size={12} /> Add
                </>
              ) : (
                <>
                  <CheckCircle size={12} /> Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnvModal;
