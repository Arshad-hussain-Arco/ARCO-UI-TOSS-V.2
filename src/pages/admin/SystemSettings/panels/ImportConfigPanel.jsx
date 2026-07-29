import { memo, useRef, useState } from 'react';
import { Eye, EyeOff, Save, Upload } from 'lucide-react';
import { useToast } from '@hooks/useToast';

/**
 * TAB 2: ImportFileConfig
 * Grid form layout with file path inputs, inline Upload buttons, and credentials.
 */
function ImportConfigPanelComponent({ onSave, isSaving }) {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    woFilePath: '/upload/csvfiles/oss/WO_All_Columns_with_Last_Comment_Date_br...',
    crFilePath: '/upload/csvfiles/oss/CR_Status_2_modified_dates2.csv',
    runtimeTrendsFilePath: '/upload/csvfiles/oss/Murex-RuntimeTrends-2026-02-03.parquet',
    documentsFilePath: '/upload/Documents',
    crServerIp: '192.168.0.98',
    crPortNo: '22',
    crUserName: 'sourcesftp',
    crPassword: '••••••••••••',
  });

  const fileInputRefs = {
    woFilePath: useRef(null),
    crFilePath: useRef(null),
    runtimeTrendsFilePath: useRef(null),
  };

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleFileUpload = (field, event) => {
    const file = event.target.files?.[0];
    if (file) {
      const mockPath = `/upload/csvfiles/oss/${file.name}`;
      setFormData((prev) => ({ ...prev, [field]: mockPath }));
      toast.success(`File selected: ${file.name}`);
    }
  };

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">ImportFileConfig</h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (onSave) onSave();
        }}
        style={{ padding: '24px' }}
      >
        <div className="ss-grid-2col">
          {/* 1. WO FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-wo-filepath">
              WO FilePath
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="imp-wo-filepath"
                type="text"
                className="ss-input"
                value={formData.woFilePath}
                onChange={(e) => handleChange('woFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.woFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('woFilePath', e)}
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
              >
                <Upload size={14} />
                Upload
              </button>
            </div>
          </div>

          {/* 2. CR FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-filepath">
              CR FilePath
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="imp-cr-filepath"
                type="text"
                className="ss-input"
                value={formData.crFilePath}
                onChange={(e) => handleChange('crFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.crFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('crFilePath', e)}
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
              >
                <Upload size={14} />
                Upload
              </button>
            </div>
          </div>

          {/* 3. Runtime-Trends FilePath + inline Upload button */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-runtime-filepath">
              Runtime-Trends FilePath
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="imp-runtime-filepath"
                type="text"
                className="ss-input"
                value={formData.runtimeTrendsFilePath}
                onChange={(e) => handleChange('runtimeTrendsFilePath', e.target.value)}
              />
              <input
                type="file"
                ref={fileInputRefs.runtimeTrendsFilePath}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('runtimeTrendsFilePath', e)}
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
              >
                <Upload size={14} />
                Upload
              </button>
            </div>
          </div>

          {/* 4. Documents FilePath */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-docs-filepath">
              Documents FilePath
            </label>
            <input
              id="imp-docs-filepath"
              type="text"
              className="ss-input"
              value={formData.documentsFilePath}
              onChange={(e) => handleChange('documentsFilePath', e.target.value)}
            />
          </div>

          {/* 5. CR Server IP */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="imp-cr-server-ip">
              CR Server IP
            </label>
            <input
              id="imp-cr-server-ip"
              type="text"
              className="ss-input"
              value={formData.crServerIp}
              onChange={(e) => handleChange('crServerIp', e.target.value)}
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
              value={formData.crPortNo}
              onChange={(e) => handleChange('crPortNo', e.target.value)}
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
              value={formData.crUserName}
              onChange={(e) => handleChange('crUserName', e.target.value)}
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
                value={formData.crPassword}
                onChange={(e) => handleChange('crPassword', e.target.value)}
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

export const ImportConfigPanel = memo(ImportConfigPanelComponent);
export default ImportConfigPanel;
