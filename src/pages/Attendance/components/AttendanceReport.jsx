import { TrendingUp } from 'lucide-react';

import { MONTH_NAMES } from '../constants';
import { formatDateKey } from '../utils';
import { StatusBadge } from './StatusBadge';
import { InlineLegend } from './InlineLegend';

function ReportTable({
  filterDateRange, filterMonth, filterYear, handleClearDateRange,
  filteredReportRows, reportDates, isWeekend, codesUsed,
}) {
  return (
    <div className="att-report-outer">
      <div className="att-report-meta">
        <span className="att-report-range-label">
          {filterDateRange.from && filterDateRange.to
            ? `${filterDateRange.from.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} – ${filterDateRange.to.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`
            : `${MONTH_NAMES[Number(filterMonth)]} ${filterYear}`}
        </span>
        {filterDateRange.from && (
          <button className="att-clear-range-btn" onClick={handleClearDateRange}>
            Clear range
          </button>
        )}
        <span className="att-report-count">{filteredReportRows.length} consultants</span>
      </div>

      <div className="att-report-scroll">
        <table className="att-report-table">
          <thead className="att-report-thead">
            <tr>
              <th className="att-th att-th-consultant">Consultant</th>
              {reportDates.map((date, idx) => {
                const we = isWeekend(date);
                return (
                  <th key={idx} className={`att-th att-th-date${we ? ' att-th-weekend' : ''}`}>
                    <div className="att-date-header">
                      <span className="att-date-num">{date.getDate()}</span>
                      <span className="att-date-dow">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0,2)}</span>
                    </div>
                  </th>
                );
              })}
              <th className="att-th att-th-summary">Summary</th>
            </tr>
          </thead>
          <tbody>
            {filteredReportRows.map(({ consultant, record, stats }) => (
              <tr key={consultant.id} className="att-report-row">
                <td className="att-td att-td-consultant">
                  <div className="att-consultant-cell">
                    <div className="attendance-consultant-avatar att-avatar-sm">{consultant.avatar}</div>
                    <div>
                      <div className="att-consultant-name">{consultant.name}</div>
                      <div className="att-consultant-team">{consultant.team}</div>
                    </div>
                  </div>
                </td>
                {reportDates.map((date, idx) => {
                  const key = formatDateKey(date);
                  const code = record.dates[key] || '';
                  const we = isWeekend(date);
                  return (
                    <td key={idx} className={`att-td att-td-cell${we ? ' att-td-weekend' : ''}`}>
                      {code && <StatusBadge code={code} />}
                    </td>
                  );
                })}
                <td className="att-td att-td-summary">
                  <div className="att-summary-block">
                    <div className="att-summary-row att-summary-present">
                      <span className="att-summary-label">P</span>
                      <span className="att-summary-val">{stats.presentDays}</span>
                    </div>
                    <div className="att-summary-row att-summary-absent">
                      <span className="att-summary-label">A</span>
                      <span className="att-summary-val">{stats.absentDays}</span>
                    </div>
                    <div className="att-summary-row att-summary-total">
                      <span className="att-summary-label">T</span>
                      <span className="att-summary-val">{stats.totalWorkingDays}</span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReportRows.length === 0 && (
              <tr>
                <td colSpan={reportDates.length + 2} className="att-empty-cell">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={reportDates.length + 2} className="att-legend-tfoot">
                <InlineLegend codesUsed={codesUsed} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ReportCards({ filteredReportRows, filterMonth, filterYear }) {
  return (
    <div className="attendance-card-grid">
      {filteredReportRows.map(({ consultant, stats }) => {
        const percentage = Math.round((stats.presentDays / Math.max(stats.totalWorkingDays, 1)) * 100);
        return (
          <div key={consultant.id} className="attendance-card">
            <div className="attendance-card-header">
              <div className="attendance-consultant-avatar">{consultant.avatar}</div>
              <div className="attendance-card-info">
                <div className="attendance-consultant-name">{consultant.name}</div>
                <div className="attendance-consultant-team">{consultant.team}</div>
              </div>
            </div>
            <div className="attendance-card-ring">
              <svg className="attendance-ring-svg" viewBox="0 0 120 120">
                <circle className="attendance-ring-bg" cx="60" cy="60" r="50" fill="none" stroke="var(--surface-tertiary)" strokeWidth="8" />
                <circle
                  className="attendance-ring-progress"
                  cx="60" cy="60" r="50" fill="none"
                  stroke="var(--brand-primary)" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="attendance-ring-text">
                <div className="attendance-ring-percentage">{percentage}%</div>
                <div className="attendance-ring-label">Present</div>
              </div>
            </div>
            <div className="attendance-card-stats">
              <div className="attendance-card-stat">
                <div className="attendance-card-stat-value">{stats.presentDays}</div>
                <div className="attendance-card-stat-label">Present</div>
              </div>
              <div className="attendance-card-stat">
                <div className="attendance-card-stat-value">{stats.absentDays}</div>
                <div className="attendance-card-stat-label">Absent</div>
              </div>
              <div className="attendance-card-stat">
                <div className="attendance-card-stat-value">{stats.totalWorkingDays}</div>
                <div className="attendance-card-stat-label">Total</div>
              </div>
            </div>
            <div className="attendance-card-sparkline">
              <TrendingUp size={12} className="attendance-sparkline-icon" />
              <span className="attendance-sparkline-text">
                {MONTH_NAMES[Number(filterMonth)]} {filterYear}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AttendanceReport({ viewMode, ...rest }) {
  if (viewMode === 'card') {
    return <ReportCards filteredReportRows={rest.filteredReportRows} filterMonth={rest.filterMonth} filterYear={rest.filterYear} />;
  }
  return <ReportTable {...rest} />;
}

export default AttendanceReport;
