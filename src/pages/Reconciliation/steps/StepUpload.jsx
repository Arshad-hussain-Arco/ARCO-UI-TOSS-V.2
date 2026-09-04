import { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@constants/routes';
import { Spinner } from '@components/feedback/Spinner/Spinner';

import { useToast } from '@hooks/useToast';
import { reconciliationService } from '@services/reconciliationService';

const ACCEPTED_FORMATS = new Set(['csv', 'xlsx', 'xls', 'xml', 'json']);
const FORMAT_LABELS = 'CSV, Excel (.xlsx, .xls), XML, JSON';

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function DropZone({ index, fileInfo, onFile, onRemove, isProcessing, onProcessingChange }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const toast = useToast();

  const label =
    index === 0 ? 'File 1 — Source / Primary Reference' : 'File 2 — Target / Destination';

  const processFile = useCallback(
    async (file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ACCEPTED_FORMATS.has(ext)) {
        toast.warning(`Unsupported format ".${ext}". Use: ${FORMAT_LABELS}.`);
        return;
      }

      onProcessingChange(index, true);

      try {
        const parsed = await reconciliationService.preprocessFile(file);
        onFile(parsed);
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Unable to preprocess the selected file.';
        toast.error(message);
      } finally {
        onProcessingChange(index, false);
      }
    },
    [index, onFile, onProcessingChange, toast],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && !isProcessing) processFile(file);
    },
    [isProcessing, processFile],
  );

  const handleChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (file && !isProcessing) processFile(file);
      e.target.value = '';
    },
    [isProcessing, processFile],
  );

  return (
    <div className="rfz-panel">
      <div className="rfz-label">{label}</div>

      {fileInfo ? (
        <div className="rfz-file-card">
          <CheckCircle size={16} className="rfz-file-check" />
          <div className="rfz-file-card-info">
            <span className="rfz-file-name">{fileInfo.name}</span>
            <span className="rfz-file-meta">
              Records: <strong>{fileInfo.records.toLocaleString()}</strong>
              {' · '}
              Size: <strong>{formatSize(fileInfo.size)}</strong>
              {' · '}
              {fileInfo.columns.length} columns
            </span>
          </div>
          <div className="rfz-file-card-actions">
            <button
              type="button"
              className="rfz-replace-btn"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing…' : 'Replace File'}
            </button>
            <button
              type="button"
              className="rfz-remove-btn"
              onClick={onRemove}
              aria-label="Remove file"
              disabled={isProcessing}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`rfz-dropzone${isDragging ? ' rfz-dropzone--active' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!isProcessing) setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isProcessing) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!isProcessing) inputRef.current?.click();
          }}
          aria-label={`Upload ${label}`}
          onKeyDown={(e) => {
            if (!isProcessing && e.key === 'Enter') inputRef.current?.click();
          }}
        >
          {isProcessing ? (
            <Spinner size="sm" className="rfz-dropzone-icon rwiz-btn-spinner" />
          ) : (
            <Upload size={20} className="rfz-dropzone-icon" />
          )}
          <p className="rfz-dropzone-text">
            {isProcessing ? 'Processing upload…' : 'Choose a file or drag & drop it here'}
          </p>
          <p className="rfz-dropzone-hint">{FORMAT_LABELS}</p>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xml,.json"
        className="rfz-hidden-input"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

export function StepUpload({ files, processingFiles, onProcessingChange, onFilesChange, onNext }) {
  const toast = useToast();

  const setFile = useCallback(
    (index, fileInfo) => {
      onFilesChange((prev) => {
        const updated = [...prev];
        updated[index] = fileInfo;
        return updated;
      });
    },
    [onFilesChange],
  );

  const removeFile = useCallback(
    (index) => {
      onFilesChange((prev) => {
        const updated = [...prev];
        updated[index] = null;
        return updated;
      });
    },
    [onFilesChange],
  );



  const bothLoaded = (files[0] !== null || processingFiles[0]) && (files[1] !== null || processingFiles[1]);


  const handleNext = useCallback(() => {
    if (!bothLoaded) {
      toast.warning(' Please upload both Source and Destination files before proceeding.');
      return;
    }
    onNext();
  }, [bothLoaded, files, onNext, toast]);

  return (
    <>
      <div className="rwiz-step-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="rwiz-step-header-left">
            <h2 className="rwiz-step-title">Step 1: Upload Files</h2>
            <p className="rwiz-step-subtitle">Upload, preprocess, and reconcile two data files.</p>
          </div>
          <Link to={ROUTES.RECONCILIATION_USER_GUIDE} target="_blank" rel="noopener noreferrer" className="rwiz-page-guide-btn">
            <FileText size={14} />
            <span>User Guide</span>
            <ExternalLink size={14} />
          </Link>
        </div>
        <div className="rwiz-step-header-actions">
        </div>
      </div>

      <div className="rwiz-step-body">
        {/* Format notice */}
        <div className="rwiz-step-intro">
          <AlertCircle size={13} className="rwiz-intro-icon" />
          <span>
            Supported formats: <strong>{FORMAT_LABELS}</strong>.
          </span>
        </div>

        {/* Dropzones */}
        <div className="rfz-zones-row">
          <DropZone
            index={0}
            fileInfo={files[0]}
            onFile={(info) => setFile(0, info)}
            onRemove={() => removeFile(0)}
            isProcessing={processingFiles[0]}
            onProcessingChange={onProcessingChange}
          />
          <div className="rfz-zones-divider">
            <span>VS</span>
          </div>
          <DropZone
            index={1}
            fileInfo={files[1]}
            onFile={(info) => setFile(1, info)}
            onRemove={() => removeFile(1)}
            isProcessing={processingFiles[1]}
            onProcessingChange={onProcessingChange}
          />
        </div>

        <div className="rwiz-step-footer">
          <div />
          <button type="button" className="rwiz-btn rwiz-btn-primary" onClick={handleNext}>
            Next →
          </button>
        </div>
      </div>
    </>
  );
}

export default StepUpload;
