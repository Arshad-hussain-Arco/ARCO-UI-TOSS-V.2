import { memo, useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';

/**
 * TAB 1: Environment Config
 * 2-column grid layout for high density admin form.
 */
function EnvironmentConfigPanelComponent({ values = {}, onChange, onSave, isSaving }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    clientDirectory: values.clientDirectory || '/upload/csvfiles/oss/',
    importantLinks: values.importantLinks || '/upload/CABCalendar',
    systemHealthHeartbeat: values.systemHealthHeartbeat || '20',
    eodHeartbeatInterval: values.eodHeartbeatInterval || '60',
    environmentServerIp: values.environmentServerIp || '192.168.0.98',
    environmentPortNo: values.environmentPortNo || '22',
    environmentUserName: values.environmentUserName || 'sourcesftp',
    environmentPassword: values.environmentPassword || '••••••••••••',
  });

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (onChange) onChange(field, val);
  };

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">Environment Config</h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (onSave) onSave();
        }}
        style={{ padding: '24px' }}
      >
        {/* 2-Column Grid Layout */}
        <div className="ss-grid-2col">
          {/* 1. Client Directory */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-client-directory">
              Client Directory
            </label>
            <input
              id="env-client-directory"
              type="text"
              className="ss-input"
              value={formData.clientDirectory}
              placeholder="/upload/csvfiles/oss/"
              onChange={(e) => handleChange('clientDirectory', e.target.value)}
            />
          </div>

          {/* 2. Important Links FilePath */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-important-links">
              Important Links FilePath
            </label>
            <input
              id="env-important-links"
              type="text"
              className="ss-input"
              value={formData.importantLinks}
              placeholder="/upload/CABCalendar"
              onChange={(e) => handleChange('importantLinks', e.target.value)}
            />
          </div>

          {/* 3. System Health Heartbeat */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-health-heartbeat">
              System Health Heartbeat (In Seconds)
            </label>
            <input
              id="env-health-heartbeat"
              type="number"
              className="ss-input"
              value={formData.systemHealthHeartbeat}
              placeholder="20"
              onChange={(e) => handleChange('systemHealthHeartbeat', e.target.value)}
            />
          </div>

          {/* 4. EOD Heartbeat Interval */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-eod-heartbeat">
              EOD Heartbeat Interval (In Seconds)
            </label>
            <input
              id="env-eod-heartbeat"
              type="number"
              className="ss-input"
              value={formData.eodHeartbeatInterval}
              placeholder="60"
              onChange={(e) => handleChange('eodHeartbeatInterval', e.target.value)}
            />
          </div>

          {/* 5. Environment Server IP */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-server-ip">
              Environment Server IP
            </label>
            <input
              id="env-server-ip"
              type="text"
              className="ss-input"
              value={formData.environmentServerIp}
              placeholder="192.168.0.98"
              onChange={(e) => handleChange('environmentServerIp', e.target.value)}
            />
          </div>

          {/* 6. Environment Port No */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-port-no">
              Environment Port No
            </label>
            <input
              id="env-port-no"
              type="number"
              className="ss-input"
              value={formData.environmentPortNo}
              placeholder="22"
              onChange={(e) => handleChange('environmentPortNo', e.target.value)}
            />
          </div>

          {/* 7. Environment User Name */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-user-name">
              Environment User Name
            </label>
            <input
              id="env-user-name"
              type="text"
              className="ss-input"
              value={formData.environmentUserName}
              placeholder="sourcesftp"
              onChange={(e) => handleChange('environmentUserName', e.target.value)}
            />
          </div>

          {/* 8. Environment Password with inline eye icon toggle */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="env-password">
              Environment Password
            </label>
            <div className="ss-input-wrapper">
              <input
                id="env-password"
                type={showPassword ? 'text' : 'password'}
                className="ss-input with-right-icon"
                value={formData.environmentPassword}
                onChange={(e) => handleChange('environmentPassword', e.target.value)}
              />
              <button
                type="button"
                className="input-icon input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="submit" className="ss-btn-update" disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const EnvironmentConfigPanel = memo(EnvironmentConfigPanelComponent);
export default EnvironmentConfigPanel;
