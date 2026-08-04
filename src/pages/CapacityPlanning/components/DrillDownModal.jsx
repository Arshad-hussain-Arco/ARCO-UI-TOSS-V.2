import { AlertTriangle, CheckSquare, Info, PlusCircle, Star, X } from 'lucide-react';

import { ExpandableText } from './ExpandableText';

function getDerivedRole(alloc) {
  const statusLower = (alloc.status || '').toLowerCase().trim();
  if (statusLower === 'fat testing') {
    return {
      label: 'Tester',
      icon: <CheckSquare size={14} className="role-icon tester-dev" />,
      class: 'dev-badge dev-tester',
      tooltip: 'FAT Testing Role',
    };
  }
  if (alloc.isAssignedProgrammer) {
    return {
      label: 'Primary Developer',
      icon: <Star size={14} className="role-icon primary-dev" />,
      class: 'dev-badge dev-primary',
      tooltip: 'Primary Assigned Developer',
    };
  }
  return {
    label: 'Additional Developer',
    icon: <PlusCircle size={14} className="role-icon add-dev" />,
    class: 'dev-badge dev-additional',
    tooltip: 'Supporting Additional Developer',
  };
}

function formatDateDMY(dateStr, parseDate) {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr || 'N/A';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function DrillDownModal({
  consultant,
  timeframe,
  allocations,
  totalWindowMDs,
  hasUnmatchedDeveloper,
  parseDate,
  onClose,
}) {
  if (!consultant || !timeframe) return null;

  return (
    <div className="cp-modal-backdrop">
      <div className={`cp-modal-card accent-${timeframe}`} role="dialog" aria-modal="true">
        <div className="cp-modal-header">
          <div>
            <h2 className="cp-modal-title">
              {consultant.name}'s MDs in Next {timeframe} Days
            </h2>
          </div>
          <button type="button" className="cp-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="cp-modal-body">
          {hasUnmatchedDeveloper && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#b45309',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <AlertTriangle size={16} />
              <span>Some records could not be matched to a team member and may affect totals.</span>
            </div>
          )}

          {allocations.length === 0 ? (
            <div className="cp-modal-empty">
              <Info size={24} />
              <p>No assignments found for the next {timeframe} days.</p>
            </div>
          ) : (
            <div className="cp-modal-table-wrapper">
              <table className="cp-modal-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Summary</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Start Date / End Date</th>
                    <th>Effort (MDs)</th>
                    <th>Total MDs in this window</th>
                    {hasUnmatchedDeveloper && <th>Data flag</th>}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc, idx) => {
                    const devRole = getDerivedRole(alloc);
                    return (
                      <tr key={alloc.id}>
                        <td className="bold-cell" style={{ maxWidth: '250px' }}>
                          <ExpandableText text={alloc.project} hasRefPrefix />
                        </td>
                        <td style={{ maxWidth: '250px' }}>
                          <ExpandableText text={alloc.summary} />
                        </td>
                        <td>
                          <span className={`status-badge ${alloc.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {alloc.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div className={devRole.class} title={devRole.tooltip} style={{ cursor: 'help' }}>
                              {devRole.icon}
                              <span>{devRole.label}</span>
                            </div>
                            {devRole.label === 'Additional Developer' && alloc.assignedDeveloper && (
                              <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                Supporting: {alloc.assignedDeveloper}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {formatDateDMY(alloc.startDate, parseDate)} - {formatDateDMY(alloc.endDate, parseDate)}
                            {alloc.isInvalidRange && (
                              <AlertTriangle
                                size={14}
                                style={{ color: '#d97706', cursor: 'help' }}
                                title="Invalid date range in source data"
                              />
                            )}
                          </span>
                        </td>
                        <td>{Number(alloc.effort).toFixed(1)} MDs</td>
                        {idx === 0 && (
                          <td rowSpan={allocations.length} className="total-window-cell">
                            {totalWindowMDs.toFixed(1)} MDs
                          </td>
                        )}
                        {hasUnmatchedDeveloper && (
                          <td>
                            {alloc.isUnmatchedDeveloper ? (
                              <span
                                className="dev-badge dev-tester"
                                style={{ display: 'inline-flex', gap: '4px', cursor: 'help' }}
                                title="This developer's name could not be matched to a known employee record, so these numbers may be unreliable."
                              >
                                <AlertTriangle size={12} style={{ color: '#d97706' }} />
                                Unmatched developer
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {allocations.length > 0 && (
            <p className="cp-modal-footnote" style={{ fontSize: '11px', color: '#64748b', marginTop: '12px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
              * Note: "Total MDs in this window" reflects the pro-rated upcoming effort allocated strictly within the {timeframe}-day window for all active assignments, which may not equal the simple sum of total raw effort values.
            </p>
          )}
        </div>

        <div className="cp-modal-footer">
          <button type="button" className="cp-modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default DrillDownModal;
