import React, { useState, useMemo } from 'react';
import { Download, Eye, X, ChevronDown, FileSpreadsheet, FileText, ArrowUpDown } from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { TruncatedText, SortIcon } from './LeaveManagementPage';
import { getRelativePendingTime } from './TeamRequestsTab';
import { ExportButton } from '@components/ui/ExportButton';

const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

const YEARS = [
  { value: 'all', label: 'All Years' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
];

export function MyLeavesSummaryTab({
  leaves = [],
  setViewModalLeave,
  selectedYear,
  onYearChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onCancelModRequest,
  cancellingModId,
}) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  // Normalize leave status for filtering
  const normalizedLeaves = useMemo(() => {
    return leaves.map(leave => {
      const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
      return { ...leave, statusStr };
    });
  }, [leaves]);

  // Year and date-range are already applied server-side (leaves prop is
  // fetched with ?year=/&from=/&to= from the parent) — only month is
  // filtered here, client-side, since the backend has no month param.
  const dateFilteredLeaves = useMemo(() => {
    if (selectedMonth === 'all') return normalizedLeaves;
    return normalizedLeaves.filter(leave => {
      const rawStart = leave.start_date || leave.date;
      if (!rawStart) return true;

      const leaveStart = new Date(rawStart);
      if (isNaN(leaveStart.getTime())) return true;

      return leaveStart.getMonth() === parseInt(selectedMonth);
    });
  }, [normalizedLeaves, selectedMonth]);

  const filteredLeaves = useMemo(() => {
    return dateFilteredLeaves.filter(leave => {
      if (filterStatus === 'all') return true;
      return leave.statusStr === filterStatus;
    }).sort((a, b) => {
      if (!sortField) return 0;
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'comments') {
        aVal = a.comments || a.approval_reason || a.rejected_reason || '';
        bVal = b.comments || b.approval_reason || b.rejected_reason || '';
      }
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const result = aVal > bVal ? 1 : -1;
      return sortOrder === 'asc' ? result : -result;
    });
  }, [dateFilteredLeaves, filterStatus, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const pendingDateRangeText = useMemo(() => {
    const pendingLeaves = normalizedLeaves.filter(l => l.statusStr === 'pending');
    if (pendingLeaves.length === 0) return null;
    
    let minDate = new Date(8640000000000000);
    let maxDate = new Date(-8640000000000000);
    let hasValidDates = false;
    
    pendingLeaves.forEach(leave => {
      const start = new Date(leave.start_date || leave.date);
      const end = new Date(leave.end_date || leave.date || leave.start_date);
      
      if (!isNaN(start.getTime())) {
        if (start < minDate) minDate = start;
        hasValidDates = true;
      }
      if (!isNaN(end.getTime())) {
        if (end > maxDate) maxDate = end;
        hasValidDates = true;
      }
    });
    
    if (!hasValidDates) return null;
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    
    const minStr = formatDate(minDate);
    const maxStr = formatDate(maxDate);
    
    return minStr === maxStr ? minStr : `${minStr} to ${maxStr}`;
  }, [normalizedLeaves]);

  const leaveTypeMap = { 'AL': 'Annual Leave', 'WFH': 'Work From Home', 'SL': 'Sick Leave', 'OW': 'Offshore Work', 'CompOff': 'Comp Off' };

  return (
    <div className="my-leaves-summary-tab" style={{ marginTop: '20px' }}>
      
      {/* Filters Toolbar */}
      <div className="leave-filters-section" style={{ marginBottom: '16px', background: 'var(--surface-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
        
        {/* Top row: Status Tabs & Export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="leave-filters-container" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
            <button className="leave-filter-chip" data-active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>
              <span className="leave-filter-label">All</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.length}</span>
            </button>
            <button className="leave-filter-chip" data-active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')}>
              <span className="leave-filter-label">Pending</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.filter(l => l.statusStr === 'pending').length}</span>
            </button>
            <button className="leave-filter-chip" data-active={filterStatus === 'approved'} onClick={() => setFilterStatus('approved')}>
              <span className="leave-filter-label">Approved</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.filter(l => l.statusStr === 'approved').length}</span>
            </button>

            <button className="leave-filter-chip" data-active={filterStatus === 'rejected'} onClick={() => setFilterStatus('rejected')}>
              <span className="leave-filter-label">Rejected</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.filter(l => l.statusStr === 'rejected').length}</span>
            </button>
            <button className="leave-filter-chip" data-active={filterStatus === 'self-rejected'} onClick={() => setFilterStatus('self-rejected')}>
              <span className="leave-filter-label">Self Rejected</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.filter(l => l.statusStr === 'self-rejected').length}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ExportButton
              excel
              pdf
              onExcelExport={() => {}}
              onPdfExport={() => {}}
            />
          </div>
        </div>

        {/* Bottom row: Date Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '150px' }}>
            <Select 
              value={selectedMonth} 
              onChange={setSelectedMonth} 
              options={MONTHS} 
              placeholder="Select Month"
              width="150px"
            />
          </div>
          <div style={{ width: '130px' }}>
            <Select
              value={selectedYear}
              onChange={onYearChange}
              options={YEARS}
              placeholder="Select Year"
              width="130px"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>From:</span>
            <DatePicker
              value={fromDate ? new Date(fromDate) : null}
              onChange={(d) => onFromDateChange(d ? d.toISOString().slice(0, 10) : null)}
              placeholder="Start Date"
              width="130px"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>To:</span>
            <DatePicker
              value={toDate ? new Date(toDate) : null}
              onChange={(d) => onToDateChange(d ? d.toISOString().slice(0, 10) : null)}
              placeholder="End Date"
              width="130px"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="lc-card-panel">
        <div className="leave-table-container">
          <table className="leave-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: filterStatus === 'pending' ? '15%' : '25%' }} />
              {filterStatus === 'pending' && <col style={{ width: '10%' }} />}
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="leave-table-thead">
              <tr className="leave-table-header-row">
                <th className="leave-table-header" onClick={() => handleSort('leave_type')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>LEAVE TYPE <SortIcon field="leave_type" sortField={sortField} sortOrder={sortOrder} /></div>
                </th>
                <th className="leave-table-header" onClick={() => handleSort('start_date')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>DATES <SortIcon field="start_date" sortField={sortField} sortOrder={sortOrder} /></div>
                </th>
                <th className="leave-table-header" onClick={() => handleSort('business_days')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>WORK DAYS <SortIcon field="business_days" sortField={sortField} sortOrder={sortOrder} /></div>
                </th>
                <th className="leave-table-header" onClick={() => handleSort('leave_reason')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>LEAVE REASON <SortIcon field="leave_reason" sortField={sortField} sortOrder={sortOrder} /></div>
                </th>
                {filterStatus === 'pending' && (
                  <th className="leave-table-header" onClick={() => handleSort('requested_date')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>PENDING SINCE <SortIcon field="requested_date" sortField={sortField} sortOrder={sortOrder} /></div>
                  </th>
                )}
                <th className="leave-table-header" onClick={() => handleSort('status_code')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>STATUS <SortIcon field="status_code" sortField={sortField} sortOrder={sortOrder} /></div>
                </th>
                <th className="leave-table-header">ACTION</th>
              </tr>
            </thead>
            <tbody className="leave-table-tbody">
              {filteredLeaves.map((leave, idx) => {
                const startDate = new Date(leave.start_date || leave.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                const endDate = new Date(leave.end_date || leave.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                const dateDisplay = (leave.start_date === leave.end_date || !leave.end_date) ? startDate : `${startDate} - ${endDate}`;
                
                const displayType = leaveTypeMap[leave.leave_type] || leave.leave_type || leave.type || 'Leave';
                const days = leave.in_days || leave.business_days || 0;

                return (
                  <tr key={leave.id || idx} className="leave-table-row">
                    <td className="leave-table-cell">{displayType}</td>
                    <td className="leave-table-cell">
                      <div className="leave-table-dates">
                        <span className="leave-table-date-text text-[14px]">{dateDisplay}</span>
                        <span className="leave-table-date-duration">({days} day{days !== 1 ? 's' : ''})</span>
                      </div>
                    </td>
                    <td className="leave-table-cell">{leave.business_days || days}</td>
                    <td className="leave-table-cell">
                      <TruncatedText text={leave.leave_reason || leave.reason} maxLength={25} title="Leave Reason" />
                    </td>
                    {filterStatus === 'pending' && (
                      <td className="leave-table-cell" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {getRelativePendingTime(leave.requested_date || leave.created_at)}
                      </td>
                    )}
                    <td className="leave-table-cell">
                      <span className="leave-table-status" data-status={leave.statusStr}>{leave.statusStr}</span>
                    </td>
                    <td className="leave-table-cell">
                      <div className="leave-table-actions">
                        <button className="leave-table-action-button action-view" title="View Details" onClick={() => setViewModalLeave(leave)}>
                          <Eye className="leave-table-action-icon" />
                        </button>
                        {leave.is_mod_request && onCancelModRequest && (
                          <button
                            className="leave-table-action-button action-cancel"
                            title="Withdraw Modification Request"
                            disabled={cancellingModId === leave.mod_request_id}
                            onClick={() => onCancelModRequest(leave.mod_request_id)}
                          >
                            <X className="leave-table-action-icon" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLeaves.length === 0 && (
                <tr className="leave-table-row">
                  <td colSpan="6" className="leave-table-cell text-center py-4">No leaves match your filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
