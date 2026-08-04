import { useCallback, useState } from 'react';
import { Download, RotateCcw, CheckCircle2, XCircle, Minus, Copy, X } from 'lucide-react';
import { DotsLoader } from '../../../components/ui/DotsLoader/DotsLoader';
import { useToast } from '@hooks/useToast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ page, pages, onPageChange }) {
  if (!pages || pages <= 1) return null;

  return (
    <div className="rrs-pagination" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '0 8px' }}>
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
            Columns from each file will be prefixed in the exported report to avoid naming conflicts.
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
            <Download size={14} />
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
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            {mappings.map((m) => <th key={`src_${m.src}`} className="rrs-th">{m.src}</th>)}
            {mappings.map((m) => <th key={`dst_${m.src}`} className="rrs-th">{m.dst}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr">
              <td className="rrs-td rrs-td-key">{renderValue(row._key)}</td>
              {cols.map((c) => <td key={c} className="rrs-td">{renderValue(row[`_src_${c}`])}</td>)}
              {cols.map((c) => <td key={c} className="rrs-td">{renderValue(row[`_dst_${c}`])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MismatchedTable({ rows, mappings, file1Name, file2Name }) {
  if (!rows.length) return <div className="rrs-empty">No mismatched records.</div>;
  const cols = mappings.map((m) => m.src);

  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            {cols.map((c) => <th key={`src_${c}`} className="rrs-th">{c}</th>)}
            {mappings.map((m) => <th key={`dst_${m.src}`} className="rrs-th">{m.dst}</th>)}
            <th className="rrs-th rrs-th-diff">Differences</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr rrs-tr--mismatch">
              <td className="rrs-td rrs-td-key">{renderValue(row._key)}</td>
              {cols.map((c) => <td key={c} className="rrs-td">{renderValue(row[`_src_${c}`])}</td>)}
              {cols.map((c) => <td key={c} className="rrs-td">{renderValue(row[`_dst_${c}`])}</td>)}
              <td className="rrs-td rrs-td-diff">
                {Array.isArray(row._differences)
                  ? row._differences.map((d) => `${d.column}: "${renderValue(d.file1Value)}" → "${renderValue(d.file2Value)}"`).join(' | ')
                  : renderValue(row._differences)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ rows }) {
  if (!rows.length) return <div className="rrs-empty">No records in this category.</div>;

  // Find the keys to show: we prefer the keys inside `row.row` if it exists, otherwise top-level keys excluding meta
  const sampleRow = rows[0] ?? {};
  const dataObj = sampleRow.row || sampleRow;
  const cols = Object.keys(dataObj).filter((k) => !k.startsWith('_') && k !== 'key');

  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            {cols.map((c) => <th key={c} className="rrs-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const data = r.row || r;
            return (
              <tr key={i} className="rrs-tr rrs-tr--missing">
                <td className="rrs-td rrs-td-key">{renderValue(r._key)}</td>
                {cols.map((c) => <td key={c} className="rrs-td">{renderValue(data[c])}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateTable({ rows }) {
  if (!rows.length) return <div className="rrs-empty">No duplicate records found.</div>;

  const sampleRow = rows[0] ?? {};
  const dataObj = sampleRow.row || sampleRow;
  const extraCols = Object.keys(dataObj).filter((k) => !k.startsWith('_') && k !== 'key' && k !== 'duplicateCount');

  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th rrs-th-key">Key</th>
            <th className="rrs-th">Count</th>
            {extraCols.map((c) => <th key={c} className="rrs-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const data = r.row || r;
            return (
              <tr key={i} className="rrs-tr rrs-tr--duplicate">
                <td className="rrs-td rrs-td-key">{renderValue(r._key)}</td>
                <td className="rrs-td">
                  <span className="rrs-dup-badge">{r.duplicateCount || r._count || data.duplicateCount || 1}</span>
                </td>
                {extraCols.map((c) => <td key={c} className="rrs-td">{renderValue(data[c])}</td>)}
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

export function StepResults({ results, file1Name, file2Name, onReset, onPageChange }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('Matched');
  const [missingSubTab, setMissingSubTab] = useState('src');
  const [dupSubTab, setDupSubTab] = useState('src');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;
    setIsPending(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsPending(false);
    }, 50);
  }, [activeTab]);

  const handleMissingSubTabChange = useCallback((tab) => {
    if (tab === missingSubTab) return;
    setIsPending(true);
    setTimeout(() => {
      setMissingSubTab(tab);
      setIsPending(false);
    }, 50);
  }, [missingSubTab]);

  const handleDupSubTabChange = useCallback((tab) => {
    if (tab === dupSubTab) return;
    setIsPending(true);
    setTimeout(() => {
      setDupSubTab(tab);
      setIsPending(false);
    }, 50);
  }, [dupSubTab]);

  const { stats, matched, mismatched, missingInDst, missingInSrc, dupSrc, dupDst, activeMappings } = results;

  const handleDownload = useCallback(
    async ({ srcPrefix, dstPrefix }) => {
      toast.info('Preparing export…');

      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const raw = results.rawResults;
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
          ['Match Rate', `${raw.matchRate ?? 0}%`],
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
            })
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
            'Matched_Records'
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
          const count = keyStr ? srcDupCountMap[keyStr] ?? '' : '';

          dupAoA.push([...srcCols.map((col) => (row[col] != null ? String(row[col]) : '')), count]);
        });

        dupAoA.push([]);
        dupAoA.push([]);

        dupAoA.push([`Duplicates in Destination (${file2Name || 'File2'})`]);
        dupAoA.push([...dstCols.map((c) => `${c}${dstSuffix}`), `DuplicateCount${dstSuffix}`]);

        (raw.duplicatesInFile2?.records || []).forEach((item) => {
          const row = item.row || {};
          const keyStr = item.key != null ? String(item.key) : '';
          const count = keyStr ? dstDupCountMap[keyStr] ?? '' : '';

          dupAoA.push([...dstCols.map((col) => (row[col] != null ? String(row[col]) : '')), count]);
        });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dupAoA), 'Duplicate_Records');

        XLSX.writeFile(
          wb,
          `reconciliation_report_${new Date().toISOString().split('T')[0]}.xlsx`
        );

        setShowExportModal(false);
        toast.success('Report exported successfully!');
      } catch (err) {
        console.error(err);
        toast.error('Failed to export report.');
      }
    },
    [results, file1Name, file2Name, toast]
  );

  return (
    <>
      <div className="rwiz-step-header">
        <div className="rwiz-step-header-left">
          <h2 className="rwiz-step-title">Step 4: View Results & Export</h2>
          <p className="rwiz-step-subtitle">Analyze matched, mismatched, missing, and duplicate records.</p>
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
            label="Match Rate"
            value={`${stats.matchRate}%`}
            subLabel="exact match rate"
            colorClass="purple"
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
          <button
            type="button"
            className="rwiz-btn rwiz-btn-outline rrs-export-btn"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={13} />
            Export Report
          </button>
        </div>

        {/* Tab content */}
        <div className="rrs-tab-content">
          {isPending ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: 'var(--text-secondary)' }}>
              <DotsLoader size={24} className="rwiz-btn-spinner" color="#8cc63f" />
              <span>Loading data...</span>
            </div>
          ) : activeTab === 'Matched' ? (
            <MatchedTable rows={matched?.records || []} mappings={activeMappings} file1Name={file1Name} file2Name={file2Name} />
          ) : activeTab === 'Mismatched' ? (
            <MismatchedTable rows={mismatched?.records || []} mappings={activeMappings} file1Name={file1Name} file2Name={file2Name} />
          ) : activeTab === 'Missing' ? (
            <>
              <div className="rrs-sub-tabs">
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'src' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleMissingSubTabChange('src')}
                >
                  Missing in {file1Name || 'Source'}
                  <span className="rrs-tab-badge">{missingInSrc.length}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleMissingSubTabChange('dst')}
                >
                  Missing in {file2Name || 'Destination'}
                  <span className="rrs-tab-badge">{missingInDst.length}</span>
                </button>
              </div>
              {missingSubTab === 'src'
                ? <MissingTable rows={missingInSrc?.records || []} />
                : <MissingTable rows={missingInDst?.records || []} />
              }
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
                  <span className="rrs-tab-badge">{dupSrc.length}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${dupSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => handleDupSubTabChange('dst')}
                >
                  Duplicates in {file2Name || 'Destination'}
                  <span className="rrs-tab-badge">{dupDst.length}</span>
                </button>
              </div>
              {dupSubTab === 'src'
                ? <DuplicateTable rows={dupSrc?.records || []} />
                : <DuplicateTable rows={dupDst?.records || []} />
              }
            </>
          ) : null}
          {/* Active Bucket Pagination */}
          {(() => {
            let activeBucket = matched;
            if (activeTab === 'Mismatched') activeBucket = mismatched;
            if (activeTab === 'Missing') activeBucket = missingSubTab === 'src' ? missingInSrc : missingInDst;
            if (activeTab === 'Duplicates') activeBucket = dupSubTab === 'src' ? dupSrc : dupDst;
            return <Pagination page={activeBucket?.page} pages={activeBucket?.pages} onPageChange={onPageChange} />;
          })()}
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onDownload={handleDownload}
          />
        )}
      </div>
    </>
  );
}

export default StepResults;
