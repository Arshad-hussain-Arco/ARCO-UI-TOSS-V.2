import React, { useState, useMemo } from 'react';
import { Download, Eye, X, ChevronDown, FileSpreadsheet, FileText, ArrowUpDown, Search } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { TruncatedText, SortIcon } from './LeaveManagementPage';
import { getRelativePendingTime, STATUS_TOOLTIPS } from './TeamRequestsTab';
import { ExportButton } from '@components/ui/ExportButton';
import { Loader } from '@components/feedback/Loader/Loader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  leaveTypeMap = {},
  isLoading = false,
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
  const formatDurationStr = (duration) => {
    if (!duration) return '';
    const map = {
      'FULL_DAY': 'Full Day',
      'FIRST_HALF': 'First Half',
      'SECOND_HALF': 'Second Half'
    };
    return map[duration] || duration;
  };

  const getDurationDisplay = (leave) => {
    if (leave.from_date_duration || leave.to_date_duration) {
      const fromStr = formatDurationStr(leave.from_date_duration);
      const toStr = formatDurationStr(leave.to_date_duration);
      if (fromStr && toStr) {
        return `${fromStr} to ${toStr}`;
      } else if (fromStr) {
        return fromStr;
      } else if (toStr) {
        return toStr;
      }
    }
    return formatDurationStr(leave.leave_duration);
  };

  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [leaveTypeSearch, setLeaveTypeSearch] = useState('');

  // Normalize leave status for filtering
  const normalizedLeaves = useMemo(() => {
    return leaves.map(leave => {
      const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
      const displayType = leave.leave_name || leaveTypeMap[leave.leave_type] || leave.leave_type || leave.type || 'Leave';
      return { ...leave, statusStr, displayType };
    });
  }, [leaves, leaveTypeMap]);

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

  // Search applies before the status chips, so the chip badge counts
  // (All/Pending/Approved/...) reflect the search too — typing narrows
  // both the table and what each chip counts.
  const searchFilteredLeaves = useMemo(() => {
    const q = leaveTypeSearch.trim().toLowerCase();
    if (!q) return dateFilteredLeaves;
    return dateFilteredLeaves.filter(leave => leave.displayType?.toLowerCase().includes(q));
  }, [dateFilteredLeaves, leaveTypeSearch]);

  const filteredLeaves = useMemo(() => {
    return searchFilteredLeaves.filter(leave => {
      if (filterStatus !== 'all' && leave.statusStr !== filterStatus) return false;
      return true;
    }).sort((a, b) => {
      if (!sortField) return 0;
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'comments') {
        aVal = a.comments || (a.status_code === 'REJECTED' ? a.rejected_reason : a.approval_reason) || a.rejected_reason || a.approval_reason || '';
        bVal = b.comments || (b.status_code === 'REJECTED' ? b.rejected_reason : b.approval_reason) || b.rejected_reason || b.approval_reason || '';
      }
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const result = aVal > bVal ? 1 : -1;
      return sortOrder === 'asc' ? result : -result;
    });
  }, [searchFilteredLeaves, filterStatus, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'];
    const rows = filteredLeaves.map(leave => [
      leave.displayType || '',
      leave.start_date || leave.date || '',
      leave.end_date || leave.date || leave.start_date || '',
      leave.business_days || leave.in_days || 0,
      leave.leave_reason || '',
      leave.statusStr || ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Leaves');
    XLSX.writeFile(workbook, 'my_leaves_summary.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const headers = ['Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'];
    const body = filteredLeaves.map(leave => [
      leave.displayType || '',
      leave.start_date || leave.date || '',
      leave.end_date || leave.date || leave.start_date || '',
      leave.business_days || leave.in_days || 0,
      leave.leave_reason || '',
      leave.statusStr || ''
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 78, 216] }
    });

    doc.save('my_leaves_summary.pdf');
  };


  return (
    <div className="my-leaves-summary-tab" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Filter Card: Search, Dates, and Export */}
      <div className="leave-filters-section" style={{ background: 'var(--surface-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
          {/* Leave Type Search */}
          <div className="tr-search-wrap" style={{ maxWidth: 200 }}>
            <Search className="tr-search-icon" />
            <input
              className="tr-search"
              placeholder="Search leave type…"
              value={leaveTypeSearch}
              onChange={(e) => setLeaveTypeSearch(e.target.value)}
            />
          </div>

          {/* Date Filters */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: '130px' }}>
              <Select 
                value={selectedMonth} 
                onChange={setSelectedMonth} 
                options={MONTHS} 
                placeholder="Select Month"
                width="130px"
              />
            </div>
            <div style={{ width: '100px' }}>
              <Select
                value={selectedYear}
                onChange={onYearChange}
                options={YEARS}
                placeholder="Select Year"
                width="100px"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>From:</span>
              <DatePicker
                value={fromDate ? new Date(fromDate) : null}
                onChange={(d) => onFromDateChange(d ? d.toISOString().slice(0, 10) : null)}
                placeholder="Start Date"
                width="110px"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>To:</span>
              <DatePicker
                value={toDate ? new Date(toDate) : null}
                onChange={(d) => onToDateChange(d ? d.toISOString().slice(0, 10) : null)}
                placeholder="End Date"
                width="110px"
              />
            </div>
          </div>

          {/* Export Button */}
          <div style={{ marginLeft: 'auto' }}>
            <ExportButton
              excel
              pdf
              onExcelExport={handleExportCSV}
              onPdfExport={handleExportPDF}
            />
          </div>
        </div>
      </div>

      {/* Table Card (Status Pills + Table) */}
      <div className="lc-card-panel">
        
        {/* Status Pills inside the Table Container */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
          <div className="leave-filters-container" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="leave-filter-chip" data-active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>
              <span className="leave-filter-label">All</span>
              <span className="leave-filter-badge">{searchFilteredLeaves.length}</span>
            </button>

            <button className="leave-filter-chip" data-active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')}>
              <span className="leave-filter-label">Pending</span>
              <span className="leave-filter-badge">{searchFilteredLeaves.filter(l => l.statusStr === 'pending').length}</span>
            </button>

            <button className="leave-filter-chip" data-active={filterStatus === 'approved'} onClick={() => setFilterStatus('approved')}>
              <span className="leave-filter-label">Approved</span>
              <span className="leave-filter-badge">{searchFilteredLeaves.filter(l => l.statusStr === 'approved').length}</span>
            </button>
          </div>
        </div>

        {/* Table Section */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <Loader message="Loading your leaves..." />
          </div>
        ) : (
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
                <th className="leave-table-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>LEAVE TYPE</div>
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
                
                const displayType = leave.displayType;
                const days = leave.in_days || leave.business_days || 0;
                const durationText = getDurationDisplay(leave);

                return (
                  <tr key={leave.id || idx} className="leave-table-row">
                    <td className="leave-table-cell">{displayType}</td>
                    <td className="leave-table-cell">
                      {leave.claimDates && leave.claimDates.length > 1 ? (
                        // Grouped multi-date claim submission (see
                        // groupClaimLeaves in LeaveManagementPage) — the
                        // dates aren't a contiguous range, so a "start -
                        // end" span with a summed day count is misleading
                        // (it implies continuous leave across every day in
                        // between). List each claimed date + duration
                        // instead, same as the Apply Leave tab table.
                        <div className="leave-table-dates">
                          {leave.claimDates.map((cd) => (
                            <div key={cd.id} className="leave-table-date-text text-[14px]">
                              {new Date(cd.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                              <span className="leave-table-date-duration">
                                {' '}({cd.in_days} day{cd.in_days !== 1 ? 's' : ''})
                                {cd.duration && cd.duration !== 'FULL_DAY' ? ` • ${cd.duration === 'FIRST_HALF' ? 'First Half' : 'Second Half'}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="leave-table-dates">
                          <span className="leave-table-date-text text-[14px]">{dateDisplay}</span>
                          <span className="leave-table-date-duration">
                            ({days} day{days !== 1 ? 's' : ''})
                            {durationText ? ` • ${durationText}` : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    {/* `|| days` fell back to in_days whenever business_days
                        was 0 — since 0 is falsy in JS, that always kicked in
                        for a Claim (which is never a leave day, so
                        business_days is always 0 — see leaves/services.py
                        _create_claim), showing the claimed day count instead
                        of the correct 0 work days. Apply Leave tab's own
                        table shows plain business_days with no such
                        fallback — mirror that here. */}
                    <td className="leave-table-cell">{leave.business_days ?? 0}</td>
                    <td className="leave-table-cell">
                      <TruncatedText text={leave.leave_reason || leave.reason} maxLength={25} title="Leave Reason" />
                    </td>
                    {filterStatus === 'pending' && (
                      <td className="leave-table-cell" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {getRelativePendingTime(leave.requested_date || leave.created_at)}
                      </td>
                    )}
                    <td className="leave-table-cell">
                      <span className="leave-table-status" data-status={leave.statusStr} title={STATUS_TOOLTIPS[leave.statusStr]}>{leave.statusStr === 'self-rejected' ? 'Self Rejected' : leave.statusStr}</span>
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
        )}
      </div>
    </div>
  );
}
