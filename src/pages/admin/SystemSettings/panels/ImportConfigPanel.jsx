import { memo, useRef, useState, useEffect } from 'react';
import { Save, Upload } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';
import { Button, Input, Loader, NumberInput, PasswordInput } from '@components/common';

/**
 * TAB 2: ImportFileConfig
 * Grid form layout with file path inputs, inline Upload buttons, and credentials.
 */
function ImportConfigPanelComponent() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(1);
  const [configModule, setConfigModule] = useState('app');

  const [formData, setFormData] = useState({
    workOrderStatusFilePath: '',
    changeRequestFilePath: '',
    runTimeFilePath: '',
    ImpLinksPath: '',
    changeRequestServerIp: '',
    changeRequestPort: '',
    changeRequestUsername: '',
    changeRequestPassword: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getImportFileConfig();
      if (res) {
        setConfigId(res.id || 1);
        setConfigModule(res.module || 'app');
        setFormData({
          workOrderStatusFilePath: res.workOrderStatusFilePath || '',
          changeRequestFilePath: res.changeRequestFilePath || '',
          runTimeFilePath: res.runTimeFilePath || '',
          ImpLinksPath: res.ImpLinksPath || '',
          changeRequestServerIp: res.changeRequestServerIp || '',
          changeRequestPort: res.changeRequestPort || '',
          changeRequestUsername: res.changeRequestUsername || '',
          changeRequestPassword: res.changeRequestPassword || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch import config:', error);
      toast.error('Failed to load import configuration');
    } finally {
      setLoading(false);
    }
  };

  const fileInputRefs = {
    woFilePath: useRef(null),
    crFilePath: useRef(null),
    runtimeTrendsFilePath: useRef(null),
  };

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleFileUpload = async (field, fileKey, event) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const payload = new FormData();
        payload.append('file', file);
        payload.append('fileKey', fileKey);
        
        await settingsService.uploadFile(payload);
        
        toast.success(`File uploaded successfully: ${file.name}`);
        // Refresh the path after successful upload
        await fetchData();
      } catch (error) {
        console.error('File upload failed:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      const allConfigs = await settingsService.getEnvironmentConfig(); 
      const importConfigs = await settingsService.getImportFileConfig(); 

      const mergedConfig = {
        ...allConfigs,
        ...importConfigs,
        ...formData
      };

      delete mergedConfig.id;
      delete mergedConfig.module;

      const payload = {
        id: configId,
        module: configModule,
        configuration: mergedConfig
      };

      await settingsService.updateConfig(payload);
      toast.success('Import configuration updated successfully');
    } catch (error) {
      console.error('Failed to update import config:', error);
      toast.error('Failed to update configuration');
    } finally {
      setSaving(false);
    }
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
        <h2 className="ss-panel-title">ImportFileConfig</h2>
      </div>

      <form onSubmit={handleSave} className="ss-panel-form">
        <div className="ss-grid-2col">
          {/* 1. WO FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-wo-filepath">
              WO FilePath
            </label>
            <div className="ss-inline-input-row">
              <Input
                id="imp-wo-filepath"
                value={formData.workOrderStatusFilePath}
                onChange={(e) => handleChange('workOrderStatusFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.woFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('workOrderStatusFilePath', 'wofilePath', e)}
              />
              <Button
                type="button"
                variant="outline"
                leadingIcon={Upload}
                onClick={() => fileInputRefs.woFilePath.current?.click()}
              >
                Upload
              </Button>
            </div>
          </div>

          {/* 2. CR FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-filepath">
              CR FilePath
            </label>
            <div className="ss-inline-input-row">
              <Input
                id="imp-cr-filepath"
                value={formData.changeRequestFilePath}
                onChange={(e) => handleChange('changeRequestFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.crFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('changeRequestFilePath', 'crfilePath', e)}
              />
              <Button
                type="button"
                variant="outline"
                leadingIcon={Upload}
                onClick={() => fileInputRefs.crFilePath.current?.click()}
              >
                Upload
              </Button>
            </div>
          </div>

          {/* 3. Runtime-Trends FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-runtime-filepath">
              Runtime-Trends FilePath
            </label>
            <div className="ss-inline-input-row">
              <Input
                id="imp-runtime-filepath"
                value={formData.runTimeFilePath}
                onChange={(e) => handleChange('runTimeFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.runtimeTrendsFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('runTimeFilePath', 'runTimeFilePath', e)}
              />
              <Button
                type="button"
                variant="outline"
                leadingIcon={Upload}
                onClick={() => fileInputRefs.runtimeTrendsFilePath.current?.click()}
              >
                Upload
              </Button>
            </div>
          </div>

          {/* 4. Documents FilePath */}
          <div className="ss-modal-form-group">
            <Input
              id="imp-docs-filepath"
              label="Documents FilePath"
              value={formData.ImpLinksPath}
              onChange={(e) => handleChange('ImpLinksPath', e.target.value)}
            />
          </div>

          {/* 5. CR Server IP */}
          <div className="ss-modal-form-group">
            <Input
              id="imp-cr-server-ip"
              label="CR Server IP"
              value={formData.changeRequestServerIp}
              onChange={(e) => handleChange('changeRequestServerIp', e.target.value)}
            />
          </div>

          {/* 6. CR Port No */}
          <div className="ss-modal-form-group">
            <NumberInput
              id="imp-cr-port-no"
              label="CR Port No"
              value={formData.changeRequestPort}
              onChange={(e) => handleChange('changeRequestPort', e.target.value)}
            />
          </div>

          {/* 7. CR User Name */}
          <div className="ss-modal-form-group">
            <Input
              id="imp-cr-user-name"
              label="CR User Name"
              value={formData.changeRequestUsername}
              onChange={(e) => handleChange('changeRequestUsername', e.target.value)}
            />
          </div>

          {/* 8. CR Password with inline Show/Hide toggle icon */}
          <div className="ss-modal-form-group">
            <PasswordInput
              id="imp-cr-password"
              label="CR Password"
              value={formData.changeRequestPassword}
              onChange={(e) => handleChange('changeRequestPassword', e.target.value)}
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

export const ImportConfigPanel = memo(ImportConfigPanelComponent);
export default ImportConfigPanel;
