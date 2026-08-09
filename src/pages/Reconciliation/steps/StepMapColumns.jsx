import { useCallback, useMemo, useState } from 'react';
import { RefreshCw, Wand2, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@components/feedback/Spinner/Spinner';

import { useToast } from '@hooks/useToast';

const DATA_TYPES = ['Numerical', 'Categorical', 'Date', 'Time', 'Timestamp'];
const ROUND_OFF_OPTIONS = ['None', '0', '1', '2', '3', '4'];

function getBadges(srcCols, dstCols, mappings) {
  const mappedSrc = mappings.filter((m) => m.dst && m.dst !== '__skip__').map((m) => m.src);
  const mappedDst = mappings.filter((m) => m.dst && m.dst !== '__skip__').map((m) => m.dst);
  return {
    unmappedSrc: srcCols.filter((c) => !mappedSrc.includes(c)),
    unmappedDst: dstCols.filter((c) => !mappedDst.includes(c)),
  };
}

function MappingRow({ mapping, dstOptions, onUpdate }) {
  const isNumerical = mapping.dataType === 'Numerical';

  return (
    <tr className="rmp-table-row">
      <td className="rmp-td rmp-td-src">
        <span className="rmp-col-pill">{mapping.src}</span>
      </td>
      <td className="rmp-td">
        <select
          className="rmp-select"
          value={mapping.dst}
          onChange={(e) => onUpdate({ dst: e.target.value })}
          aria-label={`Map destination for ${mapping.src}`}
        >
          <option value="__skip__">— Skip —</option>
          {dstOptions.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </td>
      <td className="rmp-td">
        <select
          className="rmp-select"
          value={mapping.dataType}
          onChange={(e) => onUpdate({ dataType: e.target.value })}
          aria-label={`Data type for ${mapping.src}`}
        >
          {DATA_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>
      <td className="rmp-td rmp-td-comparison">
        {isNumerical ? (
          <div className="rmp-comparison-fields">
            <label className="rmp-comparison-label">
              Tolerance
              <input
                type="number"
                min="0"
                step="0.01"
                className="rmp-number-input"
                value={mapping.tolerance}
                onChange={(e) => onUpdate({ tolerance: e.target.value })}
                aria-label={`Tolerance for ${mapping.src}`}
              />
            </label>
            <label className="rmp-comparison-label">
              Round Off
              <select
                className="rmp-select rmp-select-sm"
                value={mapping.roundOff}
                onChange={(e) => onUpdate({ roundOff: e.target.value })}
                aria-label={`Round off for ${mapping.src}`}
              >
                {ROUND_OFF_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <span className="rmp-na-text">—</span>
        )}
      </td>
      <td className="rmp-td rmp-td-center">
        <input
          type="checkbox"
          checked={mapping.exclude}
          onChange={(e) => onUpdate({ exclude: e.target.checked })}
          className="rmp-checkbox"
          aria-label={`Exclude ${mapping.src} from comparison`}
        />
      </td>
    </tr>
  );
}

export function StepMapColumns({ files, colMappings, onColMappingsChange, onBack, onRun, isReconciling, reconcileError, onClearError }) {
  const toast = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const srcCols = useMemo(() => files[0]?.columns ?? [], [files]);
  const dstCols = useMemo(() => files[1]?.columns ?? [], [files]);
  const srcName = files[0]?.name ?? 'File 1';
  const dstName = files[1]?.name ?? 'File 2';

  const autoMap = useCallback(() => {
    const updated = colMappings.map((m) => {
      const match = dstCols.find((d) => d.toLowerCase() === m.src.toLowerCase());
      if (match) {
        return { ...m, dst: match, exclude: false };
      }
      return { ...m, dst: match ?? m.dst };
    });
    onColMappingsChange(updated);
  }, [colMappings, dstCols, onColMappingsChange]);

  const resetAll = useCallback(() => {
  const reset = colMappings.map((m) => ({
    ...m,
    dst: '__skip__',
    dataType: files[0]?.columnMeta?.[m.src]?.dataType || 'Categorical',
    tolerance: '0.00',
    roundOff: 'None',
    exclude: false,
  }));
  onColMappingsChange(reset);
   setShowResetConfirm(false);
}, [colMappings, files, onColMappingsChange]);



  const updateRow = useCallback((index, patch) => {
    const updated = colMappings.map((m, i) => {
      if (i === index) {
        if (patch.exclude === true) {
          return {
            ...m,
            ...patch,
            _prevDst: m.dst,
            _prevDataType: m.dataType,
            _prevTolerance: m.tolerance,
            _prevRoundOff: m.roundOff,
            dst: '__skip__',
            dataType: 'Categorical',
            tolerance: '0.00',
            roundOff: 'None',
          };
        } else if (patch.exclude === false) {
          return {
            ...m,
            ...patch,
            dst: m._prevDst ?? m.dst,
            dataType: m._prevDataType ?? m.dataType,
            tolerance: m._prevTolerance ?? m.tolerance,
            roundOff: m._prevRoundOff ?? m.roundOff,
          };
        }
        return { ...m, ...patch };
      }
      return m;
    });
    onColMappingsChange(updated);
  }, [colMappings, onColMappingsChange]);

  const { unmappedSrc, unmappedDst } = useMemo(
    () => getBadges(srcCols, dstCols, colMappings),
    [srcCols, dstCols, colMappings],
  );

  const hasAnyMapping = colMappings.some((m) => m.dst && m.dst !== '__skip__' && !m.exclude);

  const handleRun = useCallback(() => {
    if (!hasAnyMapping) {
      toast.warning('⚠️ Please map at least one valid set of columns before running reconciliation.');
      return;
    }
    onRun();
  }, [hasAnyMapping, onRun, toast]);

  const handleAutoMapClick = useCallback(() => {
    autoMap();
  }, [autoMap]);

  return (
    <>
      <div className="rwiz-step-header">
        <div className="rwiz-step-header-left">
          <h2 className="rwiz-step-title">Step 3: Map Columns</h2>
          <p className="rwiz-step-subtitle">Map columns from source file to corresponding columns in destination file.</p>
        </div>
        <div className="rwiz-step-header-actions">
          <button type="button" className="rwiz-btn rwiz-btn-outline" onClick={() => setShowResetConfirm(true)}>
            <RefreshCw size={13} />
            Reset All Settings
          </button>
          <button type="button" className="rwiz-btn rwiz-btn-primary" onClick={handleAutoMapClick}>
            <Wand2 size={13} />
            Auto-Map Matching Columns
          </button>
        </div>
      </div>

      <div className="rwiz-step-body">
        {/* Unmapped Columns Dual Box Layout */}
        <div className="rmp-unmapped-grid">
          <div className="rmp-unmapped-box rmp-unmapped-box--src">
            <div className="rmp-unmapped-header">Columns only in {srcName} (Source)</div>
            <div className="rmp-unmapped-body">
              {unmappedSrc.length === 0 ? (
                <span className="rmp-na-text">All columns mapped</span>
              ) : (
                unmappedSrc.map((c) => (
                  <span key={c} className="rmp-badge rmp-badge-src">{c}</span>
                ))
              )}
            </div>
          </div>
          <div className="rmp-unmapped-box rmp-unmapped-box--dst">
            <div className="rmp-unmapped-header">Columns only in {dstName} (Destination)</div>
            <div className="rmp-unmapped-body">
              {unmappedDst.length === 0 ? (
                <span className="rmp-na-text">All columns mapped</span>
              ) : (
                unmappedDst.map((c) => (
                  <span key={c} className="rmp-badge rmp-badge-dst">{c}</span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mapping table */}
        <div className="rmp-table-wrapper">
          <table className="rmp-table">
            <thead>
              <tr className="rmp-thead-row">
                <th className="rmp-th">Columns in Source</th>
                <th className="rmp-th">Columns in Destination</th>
                <th className="rmp-th">Data Type</th>
                <th className="rmp-th">Comparison Settings</th>
                <th className="rmp-th rmp-th-center">Exclude</th>
              </tr>
            </thead>
            <tbody>
              {colMappings.map((mapping, i) => (
                <MappingRow
                  key={mapping.src}
                  mapping={mapping}
                  dstOptions={dstCols}
                  onUpdate={(patch) => updateRow(i, patch)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline reconcile error banner */}
        {reconcileError && (
          <div className="rwiz-reconcile-error-banner">
            <AlertTriangle size={14} className="rwiz-reconcile-error-icon" />
            <span className="rwiz-reconcile-error-msg">{reconcileError}</span>
            <button
              type="button"
              className="rwiz-reconcile-error-close"
              onClick={onClearError}
              aria-label="Dismiss error"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="rwiz-step-footer">
          <button type="button" className="rwiz-btn rwiz-btn-ghost" onClick={onBack} disabled={isReconciling}>
            ← Back
          </button>
          <button
            type="button"
            className="rwiz-btn rwiz-btn-primary"
            onClick={handleRun}
            disabled={isReconciling}
            style={{ minWidth: 180 }}
          >
            {isReconciling ? (
              <>
                <Spinner size="sm" className="rwiz-btn-spinner" />
                Running…
              </>
            ) : (
              'Run Reconciliation →'
            )}
          </button>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div
            className="rrs-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Reset All Settings"
            onClick={() => setShowResetConfirm(false)}
          >
            <div className="rrs-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="rrs-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h3 className="rrs-modal-title" style={{ fontSize: '18px', color: 'var(--bg-secondary)' }}>Reset All Settings?</h3>
              </div>
              <div className="rrs-modal-body" style={{ padding: '16px 20px' }}>
                <p className="rrs-modal-desc" style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5' }}>
                  This will reset all column mappings, data types, tolerance values, rounding settings, and exclusions to their default values. This action cannot be undone.
                </p>
              </div>
              <div className="rrs-modal-footer" style={{ borderTop: 'none', paddingTop: 0, justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="rwiz-btn rwiz-btn-outline"
                  onClick={() => setShowResetConfirm(false)}
                  style={{ width: '120px', justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rwiz-btn rwiz-btn-primary"
                  onClick={resetAll}
                  style={{ width: '140px', justifyContent: 'center', backgroundColor: 'var(--c-danger)', borderColor: 'var(--c-danger)', color: 'var(--surface-primary)' }}
                >
                  Reset Everything
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default StepMapColumns;
