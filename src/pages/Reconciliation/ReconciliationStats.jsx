import { memo } from 'react';
import { AlertCircle, CheckCircle, FileCheck, Info } from 'lucide-react';

/**
 * The four summary tiles above the reconciliation table.
 *
 * @param {Object} props
 * @param {{ total: number, matched: number, exceptions: number, matchRate: number,
 *          totalDifference: number }} props.stats
 */
function ReconciliationStatsComponent({ stats }) {
  return (
    <div className="recon-stats-grid">
      <div className="recon-stat-tile">
        <div className="recon-stat-header">
          <span className="recon-stat-label">Total Transactions</span>
          <FileCheck size={16} className="recon-stat-icon" aria-hidden="true" />
        </div>
        <div className="recon-stat-value">{stats.total}</div>
        <div className="recon-stat-footer">
          <span className="text-secondary">Across all systems</span>
        </div>
      </div>

      <div className="recon-stat-tile">
        <div className="recon-stat-header">
          <span className="recon-stat-label">Matched Items</span>
          <CheckCircle size={16} className="recon-stat-icon matched" aria-hidden="true" />
        </div>
        <div className="recon-stat-value matched">{stats.matched}</div>
        <div className="recon-stat-footer">
          <span className="recon-trend positive">{stats.matchRate.toFixed(1)}% match rate</span>
        </div>
      </div>

      <div className="recon-stat-tile">
        <div className="recon-stat-header">
          <span className="recon-stat-label">Total Exceptions</span>
          <AlertCircle size={16} className="recon-stat-icon unmatched" aria-hidden="true" />
        </div>
        <div className="recon-stat-value unmatched">{stats.exceptions}</div>
        <div className="recon-stat-footer">
          <span className="recon-trend negative">Requires manual review</span>
        </div>
      </div>

      <div className="recon-stat-tile">
        <div className="recon-stat-header">
          <span className="recon-stat-label">Total Difference</span>
          <Info size={16} className="recon-stat-icon" aria-hidden="true" />
        </div>
        <div className="recon-stat-value">
          {stats.totalDifference.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </div>
        <div className="recon-stat-footer">
          <span className="text-secondary">Unresolved net amount</span>
        </div>
      </div>
    </div>
  );
}

export const ReconciliationStats = memo(ReconciliationStatsComponent);
export default ReconciliationStats;
