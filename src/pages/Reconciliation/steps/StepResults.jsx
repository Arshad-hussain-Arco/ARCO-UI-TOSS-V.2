import { useCallback, useState } from 'react';
import { Download, RotateCcw, CheckCircle2, XCircle, Minus, Copy, X } from 'lucide-react';

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
    <div className="rrs-modal-overlay" role="dialog" aria-modal="true" aria-label="Customize export prefixes">
      <div className="rrs-modal">
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

function MatchedTable({ rows, mappings }) {
  if (!rows.length) return <div className="rrs-empty">No matched records.</div>;
  const cols = mappings.map((m) => m.src);
  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th">Key</th>
            {cols.map((c) => <th key={c} className="rrs-th">{c} (Src)</th>)}
            {cols.map((c) => <th key={c} className="rrs-th">{c} (Dst)</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr">
              <td className="rrs-td rrs-td-key">{row._key}</td>
              {cols.map((c) => <td key={c} className="rrs-td">{row[`_src_${c}`] ?? '—'}</td>)}
              {cols.map((c) => <td key={c} className="rrs-td">{row[`_dst_${c}`] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MismatchedTable({ rows }) {
  if (!rows.length) return <div className="rrs-empty">No mismatched records.</div>;
  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th">Key</th>
            <th className="rrs-th">Source Values</th>
            <th className="rrs-th">Target Values</th>
            <th className="rrs-th rrs-th-diff">Differences</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr rrs-tr--mismatch">
              <td className="rrs-td rrs-td-key">{row._key}</td>
              <td className="rrs-td">{Object.entries(row).filter(([k]) => k.startsWith('_src_')).map(([k, v]) => `${k.replace('_src_', '')}: ${v}`).join(' | ')}</td>
              <td className="rrs-td">{Object.entries(row).filter(([k]) => k.startsWith('_dst_')).map(([k, v]) => `${k.replace('_dst_', '')}: ${v}`).join(' | ')}</td>
              <td className="rrs-td rrs-td-diff">{row._differences}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ rows }) {
  if (!rows.length) return <div className="rrs-empty">No records in this category.</div>;
  const cols = Object.keys(rows[0] ?? {}).filter((k) => !k.startsWith('_'));
  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th">Key</th>
            {cols.slice(0, 5).map((c) => <th key={c} className="rrs-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr rrs-tr--missing">
              <td className="rrs-td rrs-td-key">{row._key}</td>
              {cols.slice(0, 5).map((c) => <td key={c} className="rrs-td">{row[c] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateTable({ rows }) {
  if (!rows.length) return <div className="rrs-empty">No duplicate records found.</div>;
  const extraCols = Object.keys(rows[0] ?? {}).filter((k) => !k.startsWith('_'));
  return (
    <div className="rrs-table-scroll">
      <table className="rrs-table">
        <thead>
          <tr>
            <th className="rrs-th">Key</th>
            <th className="rrs-th">Count</th>
            {extraCols.map((c) => <th key={c} className="rrs-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="rrs-tr rrs-tr--duplicate">
              <td className="rrs-td rrs-td-key">{row._key}</td>
              <td className="rrs-td"><span className="rrs-dup-badge">×{row._count}</span></td>
              {extraCols.map((c) => <td key={c} className="rrs-td">{row[c] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAIN_TABS = ['Matched', 'Mismatched', 'Missing', 'Duplicates'];

export function StepResults({ results, onReset }) {
  const [activeTab, setActiveTab] = useState('Matched');
  const [missingSubTab, setMissingSubTab] = useState('dst');
  const [dupSubTab, setDupSubTab] = useState('src');
  const [showExportModal, setShowExportModal] = useState(false);

  const { stats, matched, mismatched, missingInDst, missingInSrc, dupSrc, dupDst, activeMappings } = results;

  const handleDownload = useCallback(({ srcPrefix, dstPrefix }) => {
    const blob = new Blob(
      [`Reconciliation Report\nSource Prefix: ${srcPrefix}\nTarget Prefix: ${dstPrefix}\n\nMatched: ${stats.matched}\nMismatched: ${stats.mismatched}\nMissing: ${stats.missing}\nDuplicates: ${stats.duplicates}`],
      { type: 'application/octet-stream' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reconciliation_report.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }, [stats]);

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

        {/* Action Bar (Export) */}
        <div className="rrs-top-bar" style={{ marginTop: '4px' }}>
          <div className="rrs-tabs">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rrs-tab${activeTab === tab ? ' rrs-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
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
          </div>
          <button
            type="button"
            className="rwiz-btn rwiz-btn-outline"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={13} />
            Export Report
          </button>
        </div>

        {/* Tab content */}
        <div className="rrs-tab-content">
          {activeTab === 'Matched' && (
            <MatchedTable rows={matched} mappings={activeMappings} />
          )}

          {activeTab === 'Mismatched' && (
            <MismatchedTable rows={mismatched} />
          )}

          {activeTab === 'Missing' && (
            <>
              <div className="rrs-sub-tabs">
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => setMissingSubTab('dst')}
                >
                  Missing in Destination
                  <span className="rrs-tab-badge">{missingInDst.length}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${missingSubTab === 'src' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => setMissingSubTab('src')}
                >
                  Missing in Source
                  <span className="rrs-tab-badge">{missingInSrc.length}</span>
                </button>
              </div>
              {missingSubTab === 'dst'
                ? <MissingTable rows={missingInDst} />
                : <MissingTable rows={missingInSrc} />
              }
            </>
          )}

          {activeTab === 'Duplicates' && (
            <>
              <div className="rrs-sub-tabs">
                <button
                  type="button"
                  className={`rrs-sub-tab${dupSubTab === 'src' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => setDupSubTab('src')}
                >
                  Duplicates in Source
                  <span className="rrs-tab-badge">{dupSrc.length}</span>
                </button>
                <button
                  type="button"
                  className={`rrs-sub-tab${dupSubTab === 'dst' ? ' rrs-sub-tab--active' : ''}`}
                  onClick={() => setDupSubTab('dst')}
                >
                  Duplicates in Destination
                  <span className="rrs-tab-badge">{dupDst.length}</span>
                </button>
              </div>
              {dupSubTab === 'src'
                ? <DuplicateTable rows={dupSrc} />
                : <DuplicateTable rows={dupDst} />
              }
            </>
          )}
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
