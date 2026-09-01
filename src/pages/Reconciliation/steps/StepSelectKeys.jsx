import { useCallback, useMemo } from 'react';
import { Spinner } from '@components/feedback/Spinner/Spinner';
import { useToast } from '@hooks/useToast';
import { FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@constants/routes';

function ColumnList({ title, columns, selected, onToggle }) {
  return (
    <div className="rsk-column-panel">
      <div className="rsk-column-panel-header">
        <span className="rsk-column-panel-title">{title}</span>
        <span className="rsk-column-panel-count">Selected: {selected.length}</span>
      </div>
      <div className="rsk-column-list">
        {columns.map((col) => {
          const checkedIndex = selected.indexOf(col);
          const checked = checkedIndex > -1;
          return (
            <label key={col} className={`rsk-column-item${checked ? ' rsk-column-item--checked' : ''}`}>
              {checked && (
                <span className="rsk-column-badge">{checkedIndex + 1}</span>
              )}
              <input
                type="checkbox"
                className="rsk-column-checkbox"
                checked={checked}
                onChange={() => onToggle(col)}
                style={{ display: checked ? 'none' : 'block' }}
              />
              <span className="rsk-column-name">{col}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PreviewTable({ columns, rows, title }) {
  if (!columns.length) return null;
  return (
    <div className="rsk-preview">
      <div className="rsk-preview-scroll">
        <table className="rsk-preview-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="rsk-preview-th">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="rsk-preview-row">
                {columns.map((col) => (
                  <td key={col} className="rsk-preview-td">{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StepSelectKeys({ files, processingFiles, keyColumns, onKeyColumnsChange, onBack, onNext }) {
  const toast = useToast();

  const file1Cols = useMemo(() => files[0]?.columns ?? [], [files]);
  const file2Cols = useMemo(() => files[1]?.columns ?? [], [files]);

  const preview1Rows = useMemo(() => files[0]?.rows ?? [], [files]);

  const toggleKey = useCallback((fileIndex, col) => {
    const key = fileIndex === 0 ? 'file1' : 'file2';
    const current = keyColumns[key];
    const updated = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    onKeyColumnsChange({ ...keyColumns, [key]: updated });
  }, [keyColumns, onKeyColumnsChange]);

  const sel1 = keyColumns.file1;
  const sel2 = keyColumns.file2;
  const countsMatch = sel1.length > 0 && sel1.length === sel2.length;

  const handleNext = useCallback(() => {
    if (processingFiles?.[0] || processingFiles?.[1]) {
      toast.warning('⚠️ Please wait for files to finish processing before proceeding.');
      return;
    }
    if (sel1.length === 0 && sel2.length === 0) {
      toast.warning('⚠️ Please select an equal number of key columns in both Source and Destination files before proceeding.');
      return;
    }
    if (!countsMatch) {
      toast.warning('⚠️ Please select an equal number of key columns in both Source and Destination files before proceeding.');
      return;
    }
    onNext();
  }, [sel1.length, sel2.length, countsMatch, processingFiles, onNext, toast]);

  // Live count-mismatch inline hint (shown while selecting, not blocking)
  const showCountHint = sel1.length > 0 && sel2.length > 0 && sel1.length !== sel2.length;

  return (
    <>
      <div className="rwiz-step-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="rwiz-step-header-left">
            <h2 className="rwiz-step-title">Step 2: Select Keys</h2>
            <p className="rwiz-step-subtitle">Select unique identifier key columns from both files to match records.</p>
          </div>
          <Link to={ROUTES.RECONCILIATION_USER_GUIDE} target="_blank" rel="noopener noreferrer" className="rwiz-page-guide-btn">
            <FileText size={14} />
            <span>User Guide</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div className="rwiz-step-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {(processingFiles?.[0] || processingFiles?.[1]) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '300px', color: 'var(--text-secondary)' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '16px', fontSize: '13px' }}>Processing file... detecting columns.</p>
            <p style={{ marginTop: '4px', fontSize: '12px' }}>This may take a few moments for large files.</p>
          </div>
        ) : (
          <>
            {/* Live count mismatch hint */}
        {showCountHint && (
          <div className="rwiz-warning-banner">
            File 1 has <strong>{sel1.length}</strong> key(s) selected, File 2 has <strong>{sel2.length}</strong>. Counts must match.
          </div>
        )}

        <div className="rsk-columns-row">
          <ColumnList
            title={`Source — ${files[0]?.name ?? 'File 1'}`}
            columns={file1Cols}
            selected={sel1}
            onToggle={(col) => toggleKey(0, col)}
          />
          <div className="rsk-columns-divider" />
          <ColumnList
            title={`Target — ${files[1]?.name ?? 'File 2'}`}
            columns={file2Cols}
            selected={sel2}
            onToggle={(col) => toggleKey(1, col)}
          />
        </div>

        <PreviewTable
          title={`Source — ${files[0]?.name ?? 'File 1'}`}
          columns={file1Cols}
          rows={preview1Rows}
        />
        </>)}

        <div className="rwiz-step-footer">
          <button type="button" className="rwiz-btn rwiz-btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <button
            type="button"
            className="rwiz-btn rwiz-btn-primary"
            onClick={handleNext}
          >
            Next →
          </button>
        </div>
      </div>
    </>
  );
}

export default StepSelectKeys;
