import { memo, useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { settingsService } from '@services/settingsService';
import { useToast } from '@hooks/useToast';

/**
 * TAB 1: Environment Config
 * 2-column grid layout for high density admin form.
 */
function EnvironmentConfigPanelComponent() {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(1);
  const [configModule, setConfigModule] = useState('app');
  const [formData, setFormData] = useState({
    clientDirectory: '',
    ImpLinksPath: '',
    systemHealthHeartbeat: '',
    eodHeartbeatInterval: '',
    envConfigServerIp: '',
    envConfigPort: '',
    envConfigUsername: '',
    envConfigPassword: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getEnvironmentConfig();
      if (res) {
        setConfigId(res.id || 1);
        setConfigModule(res.module || 'app');
        setFormData({
          clientDirectory: res.clientDirectory || '',
          ImpLinksPath: res.ImpLinksPath || '',
          systemHealthHeartbeat: res.systemHealthHeartbeat || '',
          eodHeartbeatInterval: res.eodHeartbeatInterval || '',
          envConfigServerIp: res.envConfigServerIp || '',
          envConfigPort: res.envConfigPort || '',
          envConfigUsername: res.envConfigUsername || '',
          envConfigPassword: res.envConfigPassword || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch environment config:', error);
      toast.error('Failed to load environment configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // Need to fetch full config to merge as update requires full replace
      // In this case, we just send what we have, but according to API, we might need all configs
      const allConfigs = await settingsService.getEnvironmentConfig(); // Get base config
      const importConfigs = await settingsService.getImportFileConfig(); // It might return other fields

      const mergedConfig = {
        ...allConfigs,
        ...importConfigs,
        ...formData
      };

      // Remove id and module from configuration object
      delete mergedConfig.id;
      delete mergedConfig.module;

      const payload = {
        id: configId,
        module: configModule,
        configuration: mergedConfig
      };

      await settingsService.updateConfig(payload);
      toast.success('Environment configuration updated successfully');
    } catch (error) {
      console.error('Failed to update environment config:', error);
      toast.error('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };
  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  if (loading) {
    return (
      <div className="ss-form-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">Environment Config</h2>
      </div>

      <form
        onSubmit={handleSave}
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
              value={formData.ImpLinksPath}
              placeholder="/upload/CABCalendar"
              onChange={(e) => handleChange('ImpLinksPath', e.target.value)}
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
              value={formData.envConfigServerIp}
              placeholder="192.168.0.98"
              onChange={(e) => handleChange('envConfigServerIp', e.target.value)}
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
              value={formData.envConfigPort}
              placeholder="22"
              onChange={(e) => handleChange('envConfigPort', e.target.value)}
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
              value={formData.envConfigUsername}
              placeholder="sourcesftp"
              onChange={(e) => handleChange('envConfigUsername', e.target.value)}
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
                value={formData.envConfigPassword}
                onChange={(e) => handleChange('envConfigPassword', e.target.value)}
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
          <button type="submit" className="ss-btn-update" disabled={saving}>
            {saving ? <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const EnvironmentConfigPanel = memo(EnvironmentConfigPanelComponent);
export default EnvironmentConfigPanel;
