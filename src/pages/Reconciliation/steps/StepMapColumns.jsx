import { useCallback, useMemo } from 'react';
import { RefreshCw, Wand2 } from 'lucide-react';

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

export function StepMapColumns({ files, colMappings, onColMappingsChange, onBack, onRun }) {
  const toast = useToast();

  const srcCols = useMemo(() => files[0]?.columns ?? [], [files]);
  const dstCols = useMemo(() => files[1]?.columns ?? [], [files]);
  const srcName = files[0]?.name ?? 'File 1';
  const dstName = files[1]?.name ?? 'File 2';

  const autoMap = useCallback(() => {
    const updated = colMappings.map((m) => {
      const match = dstCols.find((d) => d.toLowerCase() === m.src.toLowerCase());
      return { ...m, dst: match ?? m.dst };
    });
    onColMappingsChange(updated);
  }, [colMappings, dstCols, onColMappingsChange]);

  const resetAll = useCallback(() => {
    const reset = colMappings.map((m) => ({
      ...m,
      dst: '__skip__',
      dataType: 'Categorical',
      tolerance: '0.00',
      roundOff: 'None',
      exclude: false,
    }));
    onColMappingsChange(reset);
  }, [colMappings, onColMappingsChange]);

  const updateRow = useCallback((index, patch) => {
    const updated = colMappings.map((m, i) => i === index ? { ...m, ...patch } : m);
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

  return (
    <>
      <div className="rwiz-step-header">
        <div className="rwiz-step-header-left">
          <h2 className="rwiz-step-title">Step 3: Map Columns</h2>
          <p className="rwiz-step-subtitle">Map columns from source file to corresponding columns in destination file.</p>
        </div>
        <div className="rwiz-step-header-actions">
          <button type="button" className="rwiz-btn rwiz-btn-outline" onClick={resetAll}>
            <RefreshCw size={13} />
            Reset All Settings
          </button>
          <button type="button" className="rwiz-btn rwiz-btn-primary" onClick={autoMap}>
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

        <div className="rwiz-step-footer">
          <button type="button" className="rwiz-btn rwiz-btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <button
            type="button"
            className="rwiz-btn rwiz-btn-primary"
            onClick={handleRun}
          >
            Run Reconciliation →
          </button>
        </div>
      </div>
    </>
  );
}

export default StepMapColumns;
