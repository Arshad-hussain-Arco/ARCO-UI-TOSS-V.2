import React, { useCallback, useState } from 'react';
import { Download, RotateCcw, CheckCircle2, XCircle, Minus, Copy, X, Database, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@constants/routes';
import { Spinner } from '@components/feedback/Spinner/Spinner';
import { useToast } from '@hooks/useToast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ page, pages, onPageChange }) {
  if (!pages || pages <= 1) return null;

  return (
    <div
      className="rrs-pagination"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        padding: '0 8px',
      }}
    >
      <button
        className="rwiz-btn rwiz-btn-outline"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        style={{ padding: '4px 8px' }}
      >
        <ChevronLeft size={14} />
      </button>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Page {page} of {pages}
      </span>
      <button
        className="rwiz-btn rwiz-btn-outline"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        style={{ padding: '4px 8px' }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────

function StatCard({ label, value, subLabel, colorClass }) {
  return (
    <div className={`rrs-stat-card rrs-stat-card--${colorClass}`}>
      <div className="rrs-stat-label">{label}</div>
      <div className={`rrs-stat-value rrs-stat-value--${colorClass}`}>{value}</div>
      {subLabel && <div className="rrs-stat-sub">{subLabel}</div>}
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose, onDownload }) {
  const [srcPrefix, setSrcPrefix] = useState('_SRC');
  const [dstPrefix, setDstPrefix] = useState('_DST');

  return (
    <div
      className="rrs-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Customize export prefixes"
      onClick={onClose}
    >
      <div className="rrs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rrs-modal-header">
          <h3 className="rrs-modal-title">Customize Column Prefixes</h3>
          <button type="button" className="rrs-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="rrs-modal-body">
          <p className="rrs-modal-desc">
            Columns from each file will be prefixed in the exported report to avoid naming
            conflicts.
          </p>
          <div className="rrs-modal-fields">
            <label className="rrs-modal-field">
              <span className="rrs-modal-field-label">Source Prefix</span>
              <input
                type="text"
                className="rrs-modal-input"
                value={srcPrefix}
                onChange={(e) => setSrcPrefix(e.target.value)}
                maxLength={10}
              />
            </label>
            <label className="rrs-modal-field">
              <span className="rrs-modal-field-label">Target Prefix</span>
              <input
                type="text"
                className="rrs-modal-input"
                value={dstPrefix}
                onChange={(e) => setDstPrefix(e.target.value)}
                maxLength={10}
              />
            </label>
          </div>
          <div className="rrs-modal-preview">
            <span className="rrs-modal-preview-label">Preview:</span>
            <span className="rrs-modal-preview-pill rrs-modal-preview-pill--src">
              TradeID{srcPrefix}
            </span>
            <span className="rrs-modal-preview-pill rrs-modal-preview-pill--dst">
              TradeID{dstPrefix}
            </span>
          </div>
        </div>
        <div className="rrs-modal-footer">
          <button type="button" className="rwiz-btn rwiz-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rwiz-btn rwiz-btn-primary"
            onClick={() => onDownload({ srcPrefix, dstPrefix })}
          >
            <svg className="common-export-icon-download" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"></path><path fill="currentColor" fillRule="evenodd" d="M15 2h5.75c.69 0 1.25.56 1.25 1.25V9h-1.5V4.56l-9.22 9.22l-1.06-1.06l9.22-9.22H15zm2.25 17.5c.69 0 1.25-.56 1.25-1.25V12H20v6.25A2.755 2.755 0 0 1 17.25 21H5.75A2.755 2.755 0 0 1 3 18.25V6.75A2.755 2.755 0 0 1 5.75 4H12v1.5H5.75c-.69 0-1.25.56-1.25 1.25v11.5c0 .69.56 1.25 1.25 1.25z" clipRule="evenodd"></path></svg>
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Results Tables ───────────────────────────────────────────────────────────

const renderValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

function MatchedTable({ rows, mappings, file1Name, file2Name }) {
  if (!rows.length) return <div className="rrs-empty">No matched records.</div>;
  const cols = mappings.map((m) => m.src);
  return (
    <div className="rrs-table-scroll" style={rows.length === 1 ? { height: 'auto', minHeight: 0 } : undefined}>
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            {mappings.map((m) => (
              <th key={`src_${m.src}`} className="rrs-th">
                {m.src}
              </th>
            ))}
            {mappings.map((m) => (
              <th key={`dst_${m.src}`} className="rrs-th">
                {m.dst}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr">
              <td className="rrs-td rrs-td-key">{renderValue(row._key)}</td>
              {cols.map((c) => (
                <td key={c} className="rrs-td">
                  {renderValue(row[`_src_${c}`])}
                </td>
              ))}
              {cols.map((c) => (
                <td key={c} className="rrs-td">
                  {renderValue(row[`_dst_${c}`])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MismatchedTable({ rows, mappings, file1Name, file2Name }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const leftScrollRef = React.useRef(null);
  const rightScrollRef = React.useRef(null);

  if (!rows.length) return <div className="rrs-empty">No mismatched records.</div>;
  const cols = mappings.map((m) => m.src);

  const hasDiff = (row, col) => {
    if (Array.isArray(row._differences)) {
      return row._differences.some((d) => d.column === col);
    }
    return false;
  };

  const handleLeftScroll = (e) => {
    if (rightScrollRef.current) {
      if (rightScrollRef.current.scrollTop !== e.target.scrollTop) {
        rightScrollRef.current.scrollTop = e.target.scrollTop;
      }
      if (rightScrollRef.current.scrollLeft !== e.target.scrollLeft) {
        rightScrollRef.current.scrollLeft = e.target.scrollLeft;
      }
    }
  };

  const handleRightScroll = (e) => {
    if (leftScrollRef.current) {
      if (leftScrollRef.current.scrollTop !== e.target.scrollTop) {
        leftScrollRef.current.scrollTop = e.target.scrollTop;
      }
      if (leftScrollRef.current.scrollLeft !== e.target.scrollLeft) {
        leftScrollRef.current.scrollLeft = e.target.scrollLeft;
      }
    }
  };

  return (
    <div className="rrs-mismatch-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>
      {/* Two Tables Side-by-Side */}
      <div className="rrs-mismatch-tables-wrapper" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Table: Source */}
        <div className="rrs-mismatch-table-pane" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* FIXED TOP HEADER (Immune to horizontal scroll) */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-primary)',
            }}
          >
            <div
              style={{
                width: '130px',
                minWidth: '130px',
                position: 'relative',
                borderRight: '1px solid var(--border-primary)',
                background: 'var(--surface-primary)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: 'calc(100% + 30px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-primary)',
                  borderRight: '1px solid var(--border-primary)',
                  borderBottom: '1px solid var(--border-primary)',
                  zIndex: 10,
                }}
              >
                KEY
              </div>
            </div>
            <div
              style={{
                flex: 1,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-tertiary)',
              }}
            >
              <Database size={12} style={{ color: 'var(--text-secondary)' }} />
              {file1Name || 'SOURCE'}
            </div>
          </div>

          <div
            className="rrs-table-scroll"
            ref={leftScrollRef}
            onScroll={handleLeftScroll}
            style={{
              border: 'none',
              borderRadius: 0,
              flex: rows.length === 1 ? 'none' : 1,
              height: rows.length === 1 ? 'auto' : 'auto',
              minHeight: rows.length === 1 ? 0 : '150px',
              overflowX: 'auto',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <table className="rrs-table">
              <thead>
                <tr>
                  <th
                    className="rrs-th rrs-th-key"
                    style={{
                      top: 0,
                      minWidth: '130px',
                      width: '130px',
                      maxWidth: '130px',
                      zIndex: 4,
                      background: 'var(--surface-primary)',
                    }}
                  ></th>
                  {cols.map((c) => (
                    <th key={`src_${c}`} className="rrs-th rrs-th-grouped" style={{ top: 0 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`rrs-tr rrs-tr--mismatch ${hoveredRow === i ? 'rrs-tr--hovered' : ''}`}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="rrs-td rrs-td-key rrs-td-key--green">{renderValue(row._key)}</td>
                    {cols.map((c) => (
                      <td key={`src_${c}`} className="rrs-td">
                        {hasDiff(row, c) ? (
                          <span
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--c-danger)',
                              fontWeight: 600,
                              borderRadius: '4px',
                              padding: '2px 6px',
                            }}
                          >
                            {renderValue(row[`_src_${c}`])}
                          </span>
                        ) : (
                          renderValue(row[`_src_${c}`])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Table: Destination */}
        <div className="rrs-mismatch-table-pane rrs-mismatch-table-pane--right" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* FIXED TOP HEADER (Immune to horizontal scroll) */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-primary)',
              borderBottom: '1px solid var(--border-tertiary)',
            }}
          >
            <div
              style={{
                flex: 1,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <Database size={12} style={{ color: 'var(--text-secondary)' }} />
              {file2Name || 'DESTINATION'}
            </div>
            {/* <div
              style={{
                width: '300px',
                minWidth: '300px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                borderLeft: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              DIFFERENCES
            </div> */}
          </div>

          <div
            className="rrs-table-scroll"
            ref={rightScrollRef}
            onScroll={handleRightScroll}
            style={{
              border: 'none',
              borderRadius: 0,
              flex: rows.length === 1 ? 'none' : 1,
              height: rows.length === 1 ? 'auto' : 'auto',
              minHeight: rows.length === 1 ? 0 : '150px',
              overflowX: 'auto',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <table className="rrs-table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={`dst_${c}`} className="rrs-th rrs-th-grouped" style={{ top: 0 }}>
                      {c}
                    </th>
                  ))}
                  {/* <th
                    className="rrs-th rrs-th-diff-sticky"
                    style={{
                      top: 0,
                      zIndex: 4,
                      background: 'var(--surface-primary)',
                      width: '300px',
                      minWidth: '300px',
                      maxWidth: '300px',
                    }}
                  ></th> */}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`rrs-tr rrs-tr--mismatch ${hoveredRow === i ? 'rrs-tr--hovered' : ''}`}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {cols.map((c) => (
                      <td key={`dst_${c}`} className="rrs-td">
                        {hasDiff(row, c) ? (
                          <span
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--c-danger)',
                              fontWeight: 600,
                              borderRadius: '4px',
                              padding: '2px 6px',
                            }}
                          >
                            {renderValue(row[`_dst_${c}`])}
                          </span>
                        ) : (
                          renderValue(row[`_dst_${c}`])
                        )}
                      </td>
                    ))}
                    {/* <td className="rrs-td rrs-td-diff rrs-td-diff-sticky">
                      {Array.isArray(row._differences)
                        ? row._differences.map((d) => (
                            <div key={d.column} style={{ marginBottom: '4px' }}>
                              {d.column}: "{renderValue(d.file1Value)}" &rarr; "
                              {renderValue(d.file2Value)}"
                            </div>
                          ))
                        : renderValue(row._differences)}
                    </td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissingTable({ rows, mappings, isSource }) {
  if (!rows.length) return <div className="rrs-empty">No records in this category.</div>;

  const sampleRow = rows[0] ?? {};
  const dataObj = sampleRow.row || sampleRow;

  const cols = mappings
    ? mappings.map((m) => (isSource ? m.src : m.dst)).filter(Boolean)
    : Object.keys(dataObj).filter((k) => !k.startsWith('_') && k !== 'key');

  return (
    <div className="rrs-table-scroll" style={rows.length === 1 ? { height: 'auto', minHeight: 0 } : undefined}>
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            {cols.map((c) => (
              <th key={c} className="rrs-th">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const data = r.row || r;
            return (
              <tr key={i} className="rrs-tr rrs-tr--missing">
                <td className="rrs-td rrs-td-key">{renderValue(r._key)}</td>
                {cols.map((c) => (
                  <td key={c} className="rrs-td">
                    {renderValue(data[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateTable({ rows, mappings, isSource }) {
  if (!rows.length) return <div className="rrs-empty">No duplicate records found.</div>;

  const sampleRow = rows[0] ?? {};
  const dataObj = sampleRow.row || sampleRow;

  const extraCols = mappings
    ? mappings.map((m) => (isSource ? m.src : m.dst)).filter(Boolean)
    : Object.keys(dataObj).filter(
      (k) => !k.startsWith('_') && k !== 'key' && k !== 'duplicateCount',
    );

  return (
    <div className="rrs-table-scroll" style={rows.length === 1 ? { height: 'auto', minHeight: 0 } : undefined}>
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            <th className="rrs-th">Count</th>
            {extraCols.map((c) => (
              <th key={c} className="rrs-th">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const data = r.row || r;
            return (
              <tr key={i} className="rrs-tr rrs-tr--duplicate">
                <td className="rrs-td rrs-td-key">{renderValue(r._key)}</td>
                <td className="rrs-td">
                  <span className="rrs-dup-badge">
                    {r.duplicateCount || r._count || data.duplicateCount || 1}
                  </span>
                </td>
                {extraCols.map((c) => (
                  <td key={c} className="rrs-td">
                    {renderValue(data[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAIN_TABS = ['Matched', 'Mismatched', 'Missing', 'Duplicates'];

// Export folds into RECONCILIATION_VIEW — no separate permission tier,
// so this is always on unless a future caller explicitly overrides it.
export function StepResults({ results, file1Name, file2Name, onReset, onPageChange, fetchFullResults, canExport = true }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('Matched');
  const [missingSubTab, setMissingSubTab] = useState('src');
  const [dupSubTab, setDupSubTab] = useState('src');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) return;
      setIsPending(true);
      setTimeout(() => {
        setActiveTab(tab);
        setIsPending(false);
      }, 50);
    },
    [activeTab],
  );

  const handleMissingSubTabChange = useCallback(
    (tab) => {
      if (tab === missingSubTab) return;
      setIsPending(true);
      setTimeout(() => {
        setMissingSubTab(tab);
        setIsPending(false);
      }, 50);
    },
    [missingSubTab],
  );

  const handleDupSubTabChange = useCallback(
    (tab) => {
      if (tab === dupSubTab) return;
      setIsPending(true);
      setTimeout(() => {
        setDupSubTab(tab);
        setIsPending(false);
      }, 50);
    },
    [dupSubTab],
  );

  const { stats, matched, mismatched, missingInDst, missingInSrc, dupSrc, dupDst, activeMappings } =
    results;

  const handleDownload = useCallback(
    async ({ srcPrefix, dstPrefix }) => {
      toast.info('Preparing export…');

      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        let raw = results.rawResults;
        if (fetchFullResults) {
          const fullResults = await fetchFullResults();
          raw = fullResults?.rawResults;
        }
        if (!raw) {
          toast.error('No raw results available for export.');
          return;
        }

        // --------- Determine Suffixes ----------
        const formatPrefix = (p) => {
          const trimmed = p.trim().toUpperCase();
          if (!trimmed) return '';
          return trimmed.startsWith('_') ? trimmed : `_${trimmed}`;
        };

        const srcSuffix = formatPrefix(srcPrefix) || '_SRC';
        const dstSuffix = formatPrefix(dstPrefix) || '_DST';
        const separatorHeader = '||';

        const getSourceCols = () => {
          if (activeMappings && activeMappings.length > 0) {
            return activeMappings.map((m) => m.src).filter(Boolean);
          }
          if (raw.matched?.records?.length && raw.matched.records[0].row1) {
            return Object.keys(raw.matched.records[0].row1);
          }
          if (raw.onlyInFile1?.records?.length && raw.onlyInFile1.records[0].row) {
            return Object.keys(raw.onlyInFile1.records[0].row);
          }
          if (raw.duplicatesInFile1?.records?.length && raw.duplicatesInFile1.records[0].row) {
            return Object.keys(raw.duplicatesInFile1.records[0].row);
          }
          return [];
        };

        const getDestinationCols = () => {
          if (activeMappings && activeMappings.length > 0) {
            return activeMappings.map((m) => m.dst).filter((d) => d && d !== '__skip__');
          }
          if (raw.matched?.records?.length && raw.matched.records[0].row2) {
            return Object.keys(raw.matched.records[0].row2);
          }
          if (raw.onlyInFile2?.records?.length && raw.onlyInFile2.records[0].row) {
            return Object.keys(raw.onlyInFile2.records[0].row);
          }
          if (raw.duplicatesInFile2?.records?.length && raw.duplicatesInFile2.records[0].row) {
            return Object.keys(raw.duplicatesInFile2.records[0].row);
          }
          return [];
        };

        const srcCols = getSourceCols();
        const dstCols = getDestinationCols();

        const duplicatesInFile1Count = raw.duplicatesInFile1?.total ?? 0;
        const duplicatesInFile2Count = raw.duplicatesInFile2?.total ?? 0;
        const totalDuplicateRecords = duplicatesInFile1Count + duplicatesInFile2Count;

        // SUMMARY SHEET
        const summaryData = [
          ['File Reconciliation Report', ''],
          ['', ''],
          ['File 1', file1Name || ''],
          ['File 2', file2Name || ''],
          ['Total Records in File 1', raw.totalFile1 ?? 0],
          ['Total Records in File 2', raw.totalFile2 ?? 0],
          ['', ''],
          ['Matched Records', raw.matched?.total ?? 0],
          ['Mismatched Records', raw.mismatched?.total ?? 0],
          ['Only in source', raw.onlyInFile1?.total ?? 0],
          ['Only in destination', raw.onlyInFile2?.total ?? 0],
          ['Duplicate Records (in File 1)', duplicatesInFile1Count],
          ['Duplicate Records (in File 2)', duplicatesInFile2Count],
          ['Total Duplicate Records', totalDuplicateRecords],
          ['', ''],
          ['Key Coverage Rate', `${raw.keyCoverageRate ?? 0}%`],
          ['Exact Match Rate', `${raw.exactMatchRate ?? 0}%`],
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

        const buildCombinedHeaders = () => {
          const headers = [];
          srcCols.forEach((c) => headers.push(`${c}${srcSuffix}`));
          headers.push(separatorHeader);
          dstCols.forEach((c) => headers.push(`${c}${dstSuffix}`));
          return headers;
        };

        const combinedHeaders = buildCombinedHeaders();

        const buildCombinedRow = ({ srcRow, dstRow, includeSource, includeTarget }) => {
          const row = {};

          srcCols.forEach((c) => {
            const header = `${c}${srcSuffix}`;
            row[header] =
              includeSource && srcRow
                ? srcRow[c] !== null && srcRow[c] !== undefined
                  ? String(srcRow[c])
                  : ''
                : '';
          });

          row[separatorHeader] = '';

          dstCols.forEach((c) => {
            const header = `${c}${dstSuffix}`;
            row[header] =
              includeTarget && dstRow
                ? dstRow[c] !== null && dstRow[c] !== undefined
                  ? String(dstRow[c])
                  : ''
                : '';
          });

          return row;
        };

        // MATCHED RECORDS
        if (raw.matched?.records && raw.matched.records.length > 0) {
          const matchedRows = raw.matched.records.map((m) =>
            buildCombinedRow({
              srcRow: m.row1,
              dstRow: m.row2,
              includeSource: true,
              includeTarget: true,
            }),
          );

          const matchedSheet = XLSX.utils.json_to_sheet(matchedRows, {
            header: combinedHeaders,
            skipHeader: false,
          });
          XLSX.utils.book_append_sheet(wb, matchedSheet, 'Matched_Records');
        } else {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet([combinedHeaders]),
            'Matched_Records',
          );
        }

        // MISMATCHED RECORDS
        const mismatchedHeaders = [...combinedHeaders, 'Differences'];

        const mismatchedRows = (raw.mismatched?.records || []).map((m) => {
          const baseRow = buildCombinedRow({
            srcRow: m.row1,
            dstRow: m.row2,
            includeSource: true,
            includeTarget: true,
          });

          const diffSummary = (m.differences || [])
            .map((d) => `${d.column}: "${d.file1Value}" → "${d.file2Value}"`)
            .join(' | ');

          return { ...baseRow, Differences: diffSummary };
        });

        const mismatchedSheet =
          mismatchedRows.length > 0
            ? XLSX.utils.json_to_sheet(mismatchedRows, {
              header: mismatchedHeaders,
              skipHeader: false,
            })
            : XLSX.utils.aoa_to_sheet([mismatchedHeaders]);

        XLSX.utils.book_append_sheet(wb, mismatchedSheet, 'Mismatched_Records');

        // MISSING RECORDS
        const missingAoA = [];

        missingAoA.push(['Missing in Destination (Records only in Source)']);
        missingAoA.push(srcCols.map((c) => `${c}${srcSuffix}`));

        (raw.onlyInFile1?.records || []).forEach((item) => {
          const row = item.row || {};
          missingAoA.push(srcCols.map((col) => (row[col] != null ? String(row[col]) : '')));
        });

        missingAoA.push([]);
        missingAoA.push([]);

        missingAoA.push(['Missing in Source (Records only in Destination)']);
        missingAoA.push(dstCols.map((c) => `${c}${dstSuffix}`));

        (raw.onlyInFile2?.records || []).forEach((item) => {
          const row = item.row || {};
          missingAoA.push(dstCols.map((col) => (row[col] != null ? String(row[col]) : '')));
        });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(missingAoA), 'Missing_Records');

        // DUPLICATE RECORDS
        const srcDupCountMap = {};
        (raw.duplicatesInFile1?.records || []).forEach((d) => {
          const k = d.key != null ? String(d.key) : '';
          if (!k) return;
          srcDupCountMap[k] = (srcDupCountMap[k] || 0) + 1;
        });

        const dstDupCountMap = {};
        (raw.duplicatesInFile2?.records || []).forEach((d) => {
          const k = d.key != null ? String(d.key) : '';
          if (!k) return;
          dstDupCountMap[k] = (dstDupCountMap[k] || 0) + 1;
        });

        const dupAoA = [];

        dupAoA.push([`Duplicates in Source (${file1Name || 'File1'})`]);
        dupAoA.push([...srcCols.map((c) => `${c}${srcSuffix}`), `DuplicateCount${srcSuffix}`]);

        (raw.duplicatesInFile1?.records || []).forEach((item) => {
          const row = item.row || {};
          const keyStr = item.key != null ? String(item.key) : '';
          const count = keyStr ? (srcDupCountMap[keyStr] ?? '') : '';

          dupAoA.push([...srcCols.map((col) => (row[col] != null ? String(row[col]) : '')), count]);
        });

        dupAoA.push([]);
        dupAoA.push([]);

        dupAoA.push([`Duplicates in Destination (${file2Name || 'File2'})`]);
        dupAoA.push([...dstCols.map((c) => `${c}${dstSuffix}`), `DuplicateCount${dstSuffix}`]);

        (raw.duplicatesInFile2?.records || []).forEach((item) => {
          const row = item.row || {};
          const keyStr = item.key != null ? String(item.key) : '';
          const count = keyStr ? (dstDupCountMap[keyStr] ?? '') : '';

          dupAoA.push([...dstCols.map((col) => (row[col] != null ? String(row[col]) : '')), count]);
        });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dupAoA), 'Duplicate_Records');

        XLSX.writeFile(wb, `reconciliation_report_${new Date().toISOString().split('T')[0]}.xlsx`);

        setShowExportModal(false);
        toast.success('Report exported successfully!');
      } catch (err) {
        console.error(err);
        toast.error('Failed to export report.');
      }
    },
    [results, file1Name, file2Name, toast],
  );

  return (
    <>
      <div className="rwiz-step-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="rwiz-step-header-left">
            <h2 className="rwiz-step-title">Step 4: View Results & Export</h2>
            <p className="rwiz-step-subtitle">
              Analyze matched, mismatched, missing, and duplicate records.
            </p>
          </div>
          <Link to={ROUTES.RECONCILIATION_USER_GUIDE} target="_blank" rel="noopener noreferrer" className="rwiz-page-guide-btn">
            <FileText size={14} />
            <span>User Guide</span>
            <ExternalLink size={14} />
          </Link>
        </div>
        <div className="rwiz-step-header-actions">

          <button type="button" className="rwiz-btn rwiz-btn-primary" onClick={onReset}>
            <RotateCcw size={13} />
            Start New Reconciliation
          </button>
        </div>
      </div>

      <div className="rwiz-step-body">
        {/* KPI Cards */}
        <div className="rrs-stats-grid">
          <StatCard
            label="Total Records"
            value={`${(results?.rawResults?.totalFile1 || 0).toLocaleString()} / ${(results?.rawResults?.totalFile2 || 0).toLocaleString()}`}
            subLabel="Source / Destination"
            colorClass="purple"
          />
          <StatCard
            label="Matched"
            value={stats.matched.toLocaleString()}
            subLabel={`of ${stats.total.toLocaleString()} total`}
            colorClass="green"
          />
          <StatCard
            label="Mismatched"
            value={stats.mismatched.toLocaleString()}
            subLabel="value discrepancies"
            colorClass="red"
          />
          <StatCard
            label="Missing"
            value={stats.missing.toLocaleString()}
            subLabel="across both files"
            colorClass="amber"
          />
          <StatCard
            label="Duplicates"
            value={stats.duplicates.toLocaleString()}
            subLabel="keys appear multiple times"
            colorClass="blue"
          />
          <StatCard
            label="Key Coverage"
            value={`${results?.rawResults?.keyCoverageRate ?? 0}%`}
            subLabel="records found in both files"
            colorClass="purple"
          />
          <StatCard
            label="Exact Match"
            value={`${results?.rawResults?.exactMatchRate ?? 0}%`}
            subLabel="identical in both the files"
            colorClass="green"
          />
        </div>

        {/* Tabs + Export Button (right-aligned inside tabs row) */}
        <div className="rrs-tabs" style={{ marginTop: '4px' }}>
          {MAIN_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rrs-tab${activeTab === tab ? ' rrs-tab--active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab === 'Matched' && <CheckCircle2 size={13} />}
              {tab === 'Mismatched' && <XCircle size={13} />}
              {tab === 'Missing' && <Minus size={13} />}
              {tab === 'Duplicates' && <Copy size={13} />}
              {tab}
              <span className="rrs-tab-badge">
                {tab === 'Matched' && stats.matched}
                {tab === 'Mismatched' && stats.mismatched}
                {tab === 'Missing' && stats.missing}
                {tab === 'Duplicates' && stats.duplicates}
              </span>
            </button>
          ))}
          {/* Spacer pushes Export button to the right */}
          <span style={{ flex: 1 }} />
          {canExport && (
            <button
              type="button"
              className="rwiz-btn rwiz-btn-outline rrs-export-btn"
              onClick={() => setShowExportModal(true)}
            >
              <svg className="common-export-icon-download" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"></path><path fill="currentColor" fillRule="evenodd" d="M15 2h5.75c.69 0 1.25.56 1.25 1.25V9h-1.5V4.56l-9.22 9.22l-1.06-1.06l9.22-9.22H15zm2.25 17.5c.69 0 1.25-.56 1.25-1.25V12H20v6.25A2.755 2.755 0 0 1 17.25 21H5.75A2.755 2.755 0 0 1 3 18.25V6.75A2.755 2.755 0 0 1 5.75 4H12v1.5H5.75c-.69 0-1.25.56-1.25 1.25v11.5c0 .69.56 1.25 1.25 1.25z" clipRule="evenodd"></path></svg>
              Export Report
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="rrs-tab-content">
          {isPending ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                gap: '10px',
                color: 'var(--text-secondary)',
              }}
            >
              <Spinner size="md" className="rwiz-btn-spinner" />
              <span>Loading reconciliation results...</span>
            </div>
          ) : activeTab === 'Matched' ? (
            <MatchedTable
              rows={matched?.records || []}
              mappings={activeMappings}
              file1Name={file1Name}
              file2Name={file2Name}
            />
          ) : activeTab === 'Mismatched' ? (
            <MismatchedTable
              rows={mismatched?.records || []}
              mappings={activeMappings}
              file1Name={file1Name}
              file2Name={file2Name}
            />
          ) : activeTab === 'Missing' ? (
            <>
              <div className="rrs-sub-tabs">
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'src' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleMissingSubTabChange('src')}
                >
                  Missing in {file1Name || 'Source'}
                  <span className="rrs-tab-badge">{missingInSrc?.total ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleMissingSubTabChange('dst')}
                >
                  Missing in {file2Name || 'Destination'}
                  <span className="rrs-tab-badge">{missingInDst?.total ?? 0}</span>
                </button>
              </div>
              {missingSubTab === 'src' ? (
                <MissingTable
                  rows={missingInSrc?.records || []}
                  mappings={activeMappings}
                  isSource={true}
                />
              ) : (
                <MissingTable
                  rows={missingInDst?.records || []}
                  mappings={activeMappings}
                  isSource={false}
                />
              )}
            </>
          ) : activeTab === 'Duplicates' ? (
            <>
              <div className="rrs-sub-tabs">
                <button
                  type="button"
                  className={`rrs-sub-tab${dupSubTab === 'src' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleDupSubTabChange('src')}
                >
                  Duplicates in {file1Name || 'Source'}
                  <span className="rrs-tab-badge">{dupSrc?.total ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${dupSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleDupSubTabChange('dst')}
                >
                  Duplicates in {file2Name || 'Destination'}
                  <span className="rrs-tab-badge">{dupDst?.total ?? 0}</span>
                </button>
              </div>
              {dupSubTab === 'src' ? (
                <DuplicateTable
                  rows={dupSrc?.records || []}
                  mappings={activeMappings}
                  isSource={true}
                />
              ) : (
                <DuplicateTable
                  rows={dupDst?.records || []}
                  mappings={activeMappings}
                  isSource={false}
                />
              )}
            </>
          ) : null}
          {/* Active Bucket Pagination */}
          {(() => {
            let activeBucket = matched;
            if (activeTab === 'Mismatched') activeBucket = mismatched;
            if (activeTab === 'Missing')
              activeBucket = missingSubTab === 'src' ? missingInSrc : missingInDst;
            if (activeTab === 'Duplicates') activeBucket = dupSubTab === 'src' ? dupSrc : dupDst;
            return (
              <Pagination
                page={activeBucket?.page}
                pages={activeBucket?.pages}
                onPageChange={onPageChange}
              />
            );
          })()}
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <ExportModal onClose={() => setShowExportModal(false)} onDownload={handleDownload} />
        )}
      </div>
    </>
  );
}

export default StepResults;
