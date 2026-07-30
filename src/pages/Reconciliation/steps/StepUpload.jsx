import { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';

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
          <Upload size={20} className="rfz-dropzone-icon" />
          <p className="rfz-dropzone-text">
            {isProcessing ? 'Processing upload…' : 'Choose a file or drag &amp; drop it here'}
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

export function StepUpload({ files, onFilesChange, onNext }) {
  const toast = useToast();
  const [processingFiles, setProcessingFiles] = useState([false, false]);

  const setFile = useCallback(
    (index, fileInfo) => {
      const updated = [...files];
      updated[index] = fileInfo;
      onFilesChange(updated);
    },
    [files, onFilesChange],
  );

  const removeFile = useCallback(
    (index) => {
      const updated = [...files];
      updated[index] = null;
      onFilesChange(updated);
    },
    [files, onFilesChange],
  );

  const updateProcessing = useCallback((index, value) => {
    setProcessingFiles((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }, []);

  const bothLoaded = files[0] !== null && files[1] !== null;
  const formatMismatch = bothLoaded && files[0].ext !== files[1].ext;

  const handleNext = useCallback(() => {
    if (!bothLoaded) {
      toast.warning('⚠️ Please upload both Source and Destination files before proceeding.');
      return;
    }
    if (formatMismatch) {
      toast.warning(
        `⚠️ Both files must be the same format. File 1 is .${files[0].ext}, File 2 is .${files[1].ext}.`,
      );
      return;
    }
    onNext();
  }, [bothLoaded, formatMismatch, files, onNext, toast]);

  return (
    <>
      <div className="rwiz-step-header">
        <div className="rwiz-step-header-left">
          <h2 className="rwiz-step-title">Step 1: Upload Files</h2>
          <p className="rwiz-step-subtitle">Upload, preprocess, and reconcile two data files.</p>
        </div>
      </div>

      <div className="rwiz-step-body">
        {/* Format notice */}
        <div className="rwiz-step-intro">
          <AlertCircle size={13} className="rwiz-intro-icon" />
          <span>
            Supported formats: <strong>{FORMAT_LABELS}</strong>. Both uploaded files must be of the
            same format.
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
            onProcessingChange={updateProcessing}
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
            onProcessingChange={updateProcessing}
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
