import { memo, useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { settingsService } from '@services/settingsService';
import { PanelSkeleton } from './PanelSkeleton';
import { useToast } from '@hooks/useToast';
import Skeleton from '@/components/feedback/Skeleton/Skeleton';

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
    documentfilePath: '',
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
          documentfilePath: res.documentfilePath || '',
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

      // update-config is a full replace of config_json, and
      // getEnvironmentConfig()/getImportFileConfig() only return their own
      // ~8-key whitelist each — merging just those two silently drops any
      // key neither tab knows about (e.g. homeMediaFilePath). Spread the
      // full raw config in first (lowest precedence) so those survive.
      const rawConfig = await settingsService.getAllConfigurations();
      const allConfigs = await settingsService.getEnvironmentConfig(); // Get base config
      const importConfigs = await settingsService.getImportFileConfig(); // It might return other fields

      const mergedConfig = {
        ...rawConfig,
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

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">Environment Config</h2>
      </div>

      {loading ? (
        <div style={{ padding: '24px' }}>
          <div className="ss-grid-2col" style={{ marginBottom: '24px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ss-modal-form-group">
                <Skeleton height={14} width={120} style={{ marginBottom: '8px' }} />
                <Skeleton height={38} width="100%" style={{ borderRadius: '6px' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Skeleton height={36} width={100} style={{ borderRadius: '6px' }} />
          </div>
        </div>
      ) : (
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
                placeholder="/path/to/client-directory"
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
                placeholder="/path/to/important-links"
                onChange={(e) => handleChange('ImpLinksPath', e.target.value)}
              />
            </div>

            {/* 2.5 Documents FilePath */}
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="env-docs-filepath">
                Documents FilePath
              </label>
              <input
                id="env-docs-filepath"
                type="text"
                className="ss-input"
                value={formData.documentfilePath}
                placeholder="/path/to/documents"
                onChange={(e) => handleChange('documentfilePath', e.target.value)}
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
                placeholder="Enter Health Heartbeat"
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
                placeholder="Enter Heartbeat Interval"
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
                placeholder="Enter Server IP"
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
                placeholder="Enter Port No."
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
                placeholder="Enter Username"
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
                  placeholder="Enter Password"
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
      )}
    </div>
  );
}

export const EnvironmentConfigPanel = memo(EnvironmentConfigPanelComponent);
export default EnvironmentConfigPanel;
