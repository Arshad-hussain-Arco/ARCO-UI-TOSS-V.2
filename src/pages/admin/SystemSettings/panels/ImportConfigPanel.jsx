import { memo, useRef, useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Upload, Loader2, FileSpreadsheet, CircleCheck } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';
import { useUploads } from '@context/UploadContext';

/**
 * TAB 2: ImportFileConfig
 * Grid form layout with file path inputs, inline Upload buttons, and credentials.
 */
function ImportConfigPanelComponent() {
  const toast = useToast();
  const { uploadFile, uploads } = useUploads();
  const isMounted = useRef(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(1);
  const [configModule, setConfigModule] = useState('app');

  const [formData, setFormData] = useState({
    workOrderStatusFilePath: '',
    changeRequestFilePath: '',
    runTimeFilePath: '',
    ImpLinksPath: '',
    documentfilePath: '',
    changeRequestServerIp: '',
    changeRequestPort: '',
    changeRequestUsername: '',
    changeRequestPassword: '',
  });

  const [uploadedAt, setUploadedAt] = useState({
    workOrderStatusFilePath_uploadedAt: '',
    changeRequestFilePath_uploadedAt: '',
    runTimeFilePath_uploadedAt: '',
    ImpLinksPath_uploadedAt: '',
  });

  const [uploadingFields, setUploadingFields] = useState({});

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await settingsService.getImportFileConfig();
      if (res) {
        setConfigId(res.id || 1);
        setConfigModule(res.module || 'app');
        setFormData({
          workOrderStatusFilePath: res.workOrderStatusFilePath || '',
          changeRequestFilePath: res.changeRequestFilePath || '',
          runTimeFilePath: res.runTimeFilePath || '',
          ImpLinksPath: res.ImpLinksPath || '',
          documentfilePath: res.documentfilePath || '',
          changeRequestServerIp: res.changeRequestServerIp || '',
          changeRequestPort: res.changeRequestPort || '',
          changeRequestUsername: res.changeRequestUsername || '',
          changeRequestPassword: res.changeRequestPassword || '',
        });
        setUploadedAt({
          workOrderStatusFilePath_uploadedAt: res.workOrderStatusFilePath_uploadedAt || '',
          changeRequestFilePath_uploadedAt: res.changeRequestFilePath_uploadedAt || '',
          runTimeFilePath_uploadedAt: res.runTimeFilePath_uploadedAt || '',
          ImpLinksPath_uploadedAt: res.ImpLinksPath_uploadedAt || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch import config:', error);
      toast.error('Failed to load import configuration');
    } finally {
      if (!silent) setLoading(false);
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

  const isFieldUploading = (field) => {
    return Object.values(uploads).some(u => u.field === field && u.status === 'uploading');
  };

  const handleFileUpload = (field, fileKey, event) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(field, fileKey, file, 
        (res) => {
          if (isMounted.current) {
            if (res?.filePath) {
              handleChange(field, res.filePath);
            }
            if (res?.uploadedAt) {
              setUploadedAt((prev) => ({ ...prev, [`${field}_uploadedAt`]: res.uploadedAt }));
            }
          }
        },
        (error) => {
          // Handled globally
        }
      );
      // Allow re-selecting the same file again later.
      event.target.value = '';
    }
  };

  const formatUploadedAt = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;
    
    const pad = (n) => n.toString().padStart(2, '0');
    const DD = pad(date.getDate());
    const MM = pad(date.getMonth() + 1);
    const YYYY = date.getFullYear();
    
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    
    return `${DD}-${MM}-${YYYY}, ${hours}:${mm}:${ss} ${ampm}`;
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
      const allConfigs = await settingsService.getEnvironmentConfig();
      const importConfigs = await settingsService.getImportFileConfig();

      const mergedConfig = {
        ...rawConfig,
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
      <div className="ss-form-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">ImportFileConfig</h2>
      </div>

      <form
        onSubmit={handleSave}
        style={{ padding: '24px' }}
      >
        <div className="ss-grid-2col">
          {/* 1. WO FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <label className="ss-modal-label" htmlFor="imp-wo-filepath" style={{ marginBottom: 0 }}>
                    WO FilePath
                  </label>
                  {formatUploadedAt(uploadedAt.workOrderStatusFilePath_uploadedAt) && (
                    <div
                      title={`Data for Last uploaded on was last updated on ${formatUploadedAt(uploadedAt.workOrderStatusFilePath_uploadedAt)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 2px'
                      }}
                    >
                      <FileSpreadsheet size={12} color="#22c55e" style={{ flexShrink: 0 }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Last uploaded on:</span>
                        <span style={{ fontWeight: 700 }}>{formatUploadedAt(uploadedAt.workOrderStatusFilePath_uploadedAt)}</span>
                      </span>
                      <CircleCheck size={12} color="#22c55e" style={{ marginLeft: '2px', opacity: 0.8 }} />
                    </div>
                  )}
                </div>
                <input
                  id="imp-wo-filepath"
                  type="text"
                  className="ss-input"
                  style={{ width: '100%' }}
                  value={formData.workOrderStatusFilePath}
                  onChange={(e) => handleChange('workOrderStatusFilePath', e.target.value)}
                />
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRefs.woFilePath}
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('workOrderStatusFilePath', 'wofilePath', e)}
                />
                <button
                  type="button"
                  className="ss-btn-update"
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    background: 'var(--surface-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                  onClick={() => fileInputRefs.woFilePath.current?.click()}
                  disabled={isFieldUploading('workOrderStatusFilePath')}
                >
                  {isFieldUploading('workOrderStatusFilePath') ? (
                    <Loader2 size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Upload size={14} />
                      {formData.workOrderStatusFilePath ? 'Replace' : 'Upload'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 2. CR FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <label className="ss-modal-label" htmlFor="imp-cr-filepath" style={{ marginBottom: 0 }}>
                    CR FilePath
                  </label>
                  {formatUploadedAt(uploadedAt.changeRequestFilePath_uploadedAt) && (
                    <div
                      title={`Data for Last uploaded on was last updated on ${formatUploadedAt(uploadedAt.changeRequestFilePath_uploadedAt)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 2px'
                      }}
                    >
                      <FileSpreadsheet size={12} color="#22c55e" style={{ flexShrink: 0 }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Last uploaded on:</span>
                        <span style={{ fontWeight: 700 }}>{formatUploadedAt(uploadedAt.changeRequestFilePath_uploadedAt)}</span>
                      </span>
                      <CircleCheck size={12} color="#22c55e" style={{ marginLeft: '2px', opacity: 0.8 }} />
                    </div>
                  )}
                </div>
                <input
                  id="imp-cr-filepath"
                  type="text"
                  className="ss-input"
                  style={{ width: '100%' }}
                  value={formData.changeRequestFilePath}
                  onChange={(e) => handleChange('changeRequestFilePath', e.target.value)}
                />
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRefs.crFilePath}
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('changeRequestFilePath', 'crfilePath', e)}
                />
                <button
                  type="button"
                  className="ss-btn-update"
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    background: 'var(--surface-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                  onClick={() => fileInputRefs.crFilePath.current?.click()}
                  disabled={isFieldUploading('changeRequestFilePath')}
                >
                  {isFieldUploading('changeRequestFilePath') ? (
                    <Loader2 size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Upload size={14} />
                      {formData.changeRequestFilePath ? 'Replace' : 'Upload'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Runtime-Trends FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <label className="ss-modal-label" htmlFor="imp-runtime-filepath" style={{ marginBottom: 0 }}>
                    Runtime-Trends FilePath
                  </label>
                  {formatUploadedAt(uploadedAt.runTimeFilePath_uploadedAt) && (
                    <div
                      title={`Data for Last uploaded on was last updated on ${formatUploadedAt(uploadedAt.runTimeFilePath_uploadedAt)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 2px'
                      }}
                    >
                      <FileSpreadsheet size={12} color="#22c55e" style={{ flexShrink: 0 }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Last uploaded on:</span>
                        <span style={{ fontWeight: 700 }}>{formatUploadedAt(uploadedAt.runTimeFilePath_uploadedAt)}</span>
                      </span>
                      <CircleCheck size={12} color="#22c55e" style={{ marginLeft: '2px', opacity: 0.8 }} />
                    </div>
                  )}
                </div>
                <input
                  id="imp-runtime-filepath"
                  type="text"
                  className="ss-input"
                  style={{ width: '100%' }}
                  value={formData.runTimeFilePath}
                  onChange={(e) => handleChange('runTimeFilePath', e.target.value)}
                />
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRefs.runtimeTrendsFilePath}
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('runTimeFilePath', 'runTimeFilePath', e)}
                />
                <button
                  type="button"
                  className="ss-btn-update"
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    background: 'var(--surface-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                  onClick={() => fileInputRefs.runtimeTrendsFilePath.current?.click()}
                  disabled={isFieldUploading('runTimeFilePath')}
                >
                  {isFieldUploading('runTimeFilePath') ? (
                    <Loader2 size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Upload size={14} />
                      {formData.runTimeFilePath ? 'Replace' : 'Upload'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 4. Important Links FilePath */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-links-filepath">
              Important Links FilePath
            </label>
            <input
              id="imp-links-filepath"
              type="text"
              className="ss-input"
              value={formData.ImpLinksPath}
              onChange={(e) => handleChange('ImpLinksPath', e.target.value)}
            />
          </div>

          {/* 5. Documents FilePath */}
          {/* <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-real-docs-filepath">
              Documents FilePath
            </label>
            <input
              id="imp-real-docs-filepath"
              type="text"
              className="ss-input"
              value={formData.documentfilePath}
              onChange={(e) => handleChange('documentfilePath', e.target.value)}
            />
          </div> */}

          {/* 5. CR Server IP */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-server-ip">
              CR Server IP
            </label>
            <input
              id="imp-cr-server-ip"
              type="text"
              className="ss-input"
              value={formData.changeRequestServerIp}
              onChange={(e) => handleChange('changeRequestServerIp', e.target.value)}
            />
          </div>

          {/* 6. CR Port No */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-port-no">
              CR Port No
            </label>
            <input
              id="imp-cr-port-no"
              type="number"
              className="ss-input"
              value={formData.changeRequestPort}
              onChange={(e) => handleChange('changeRequestPort', e.target.value)}
            />
          </div>

          {/* 7. CR User Name */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-user-name">
              CR User Name
            </label>
            <input
              id="imp-cr-user-name"
              type="text"
              className="ss-input"
              value={formData.changeRequestUsername}
              onChange={(e) => handleChange('changeRequestUsername', e.target.value)}
            />
          </div>

          {/* 8. CR Password with inline Show/Hide toggle icon */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-password">
              CR Password
            </label>
            <div className="ss-input-wrapper">
              <input
                id="imp-cr-password"
                type={showPassword ? 'text' : 'password'}
                className="ss-input with-right-icon"
                value={formData.changeRequestPassword}
                onChange={(e) => handleChange('changeRequestPassword', e.target.value)}
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

export const ImportConfigPanel = memo(ImportConfigPanelComponent);
export default ImportConfigPanel;
