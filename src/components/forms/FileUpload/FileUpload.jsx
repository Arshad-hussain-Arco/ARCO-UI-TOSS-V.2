import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';

import './FileUpload.css';

/**
 * Reusable File Upload component supporting drag & drop and file list preview.
 *
 * @param {Object} props
 * @param {File[]} props.files - Currently selected files.
 * @param {(files: File[]) => void} props.onChange - Handler when files are added or removed.
 * @param {string} [props.accept] - Accepted file types (e.g. ".csv,.xml,.json").
 * @param {boolean} [props.multiple] - Allow multiple files.
 * @param {string} [props.hint] - Helper text shown below the upload prompt.
 * @param {string} [props.error] - Error message.
 */
export function FileUpload({
  files = [],
  onChange,
  accept,
  multiple = false,
  hint = 'Supports CSV, XML, JSON up to 50MB',
  error,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      if (!multiple && files.length > 0) {
        onChange([dropped[0]]);
      } else {
        onChange([...files, ...dropped]);
      }
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      if (!multiple && files.length > 0) {
        onChange([selected[0]]);
      } else {
        onChange([...files, ...selected]);
      }
      e.target.value = '';
    }
  };

  const removeFile = (idx) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="ui-file-upload-wrapper">
      <div
        className="ui-file-upload-zone"
        role="button"
        tabIndex={0}
        data-drag={isDragging}
        data-error={!!error}
        aria-label="Upload file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload size={18} className="ui-file-upload-icon" aria-hidden="true" />
        <div className="ui-file-upload-text-wrap">
          <p className="ui-file-upload-text">
            <strong>Click to upload</strong> or drag &amp; drop
          </p>
          {hint && <p className="ui-file-upload-hint">{hint}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {files.length > 0 && (
        <div className="ui-file-list">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="ui-file-row">
              <FileText size={16} className="ui-file-row-icon" aria-hidden="true" />
              <div className="ui-file-info">
                <span className="ui-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="ui-file-meta">
                  {(file.size / 1024).toFixed(0)} KB
                  <span className="ui-file-status">Ready</span>
                </span>
              </div>
              <button
                type="button"
                className="ui-file-action"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(i)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
