import { memo, useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { settingsService } from '@services/settingsService';
import { useToast } from '@hooks/useToast';
import { Button, Input, Loader, NumberInput, PasswordInput } from '@components/common';

/**
 * TAB 1: Environment Config
 * 2-column grid layout for high density admin form.
 */
function EnvironmentConfigPanelComponent() {
  const toast = useToast();
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
      <div className="ss-form-card ss-panel-loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">Environment Config</h2>
      </div>

      <form onSubmit={handleSave} className="ss-panel-form">
        {/* 2-Column Grid Layout */}
        <div className="ss-grid-2col">
          {/* 1. Client Directory */}
          <div className="ss-modal-form-group">
            <Input
              id="env-client-directory"
              label="Client Directory"
              value={formData.clientDirectory}
              placeholder="/upload/csvfiles/oss/"
              onChange={(e) => handleChange('clientDirectory', e.target.value)}
            />
          </div>

          {/* 2. Important Links FilePath */}
          <div className="ss-modal-form-group">
            <Input
              id="env-important-links"
              label="Important Links FilePath"
              value={formData.ImpLinksPath}
              placeholder="/upload/CABCalendar"
              onChange={(e) => handleChange('ImpLinksPath', e.target.value)}
            />
          </div>

          {/* 3. System Health Heartbeat */}
          <div className="ss-modal-form-group">
            <NumberInput
              id="env-health-heartbeat"
              label="System Health Heartbeat (In Seconds)"
              value={formData.systemHealthHeartbeat}
              placeholder="20"
              onChange={(e) => handleChange('systemHealthHeartbeat', e.target.value)}
            />
          </div>

          {/* 4. EOD Heartbeat Interval */}
          <div className="ss-modal-form-group">
            <NumberInput
              id="env-eod-heartbeat"
              label="EOD Heartbeat Interval (In Seconds)"
              value={formData.eodHeartbeatInterval}
              placeholder="60"
              onChange={(e) => handleChange('eodHeartbeatInterval', e.target.value)}
            />
          </div>

          {/* 5. Environment Server IP */}
          <div className="ss-modal-form-group">
            <Input
              id="env-server-ip"
              label="Environment Server IP"
              value={formData.envConfigServerIp}
              placeholder="192.168.0.98"
              onChange={(e) => handleChange('envConfigServerIp', e.target.value)}
            />
          </div>

          {/* 6. Environment Port No */}
          <div className="ss-modal-form-group">
            <NumberInput
              id="env-port-no"
              label="Environment Port No"
              value={formData.envConfigPort}
              placeholder="22"
              onChange={(e) => handleChange('envConfigPort', e.target.value)}
            />
          </div>

          {/* 7. Environment User Name */}
          <div className="ss-modal-form-group">
            <Input
              id="env-user-name"
              label="Environment User Name"
              value={formData.envConfigUsername}
              placeholder="sourcesftp"
              onChange={(e) => handleChange('envConfigUsername', e.target.value)}
            />
          </div>

          {/* 8. Environment Password with inline eye icon toggle */}
          <div className="ss-modal-form-group">
            <PasswordInput
              id="env-password"
              label="Environment Password"
              value={formData.envConfigPassword}
              onChange={(e) => handleChange('envConfigPassword', e.target.value)}
            />
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="ss-panel-submit-row">
          <Button type="submit" variant="primary" isLoading={saving} leadingIcon={saving ? undefined : Save}>
            {saving ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export const EnvironmentConfigPanel = memo(EnvironmentConfigPanelComponent);
export default EnvironmentConfigPanel;
