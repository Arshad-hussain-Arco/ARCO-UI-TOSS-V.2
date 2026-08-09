import React, { useState, useMemo } from 'react';
import { Download, Eye, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';

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

export function MyLeavesSummaryTab({ leaves = [], setViewModalLeave }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Normalize leave status for filtering
  const normalizedLeaves = useMemo(() => {
    const mapped = leaves.map(leave => {
      let statusStr = 'pending';
      if (leave.status === 1) statusStr = 'pending';
      else if (leave.status === 3) statusStr = 'approved';
      else if (leave.status === 2) statusStr = 'rejected';
      else if (leave.status === 4) statusStr = 'self-rejected';
      else if (leave.status_code) statusStr = leave.status_code.toLowerCase().replace('_', '-');
      
      return { ...leave, statusStr };
    });
    
    // Sort by start_date descending so the most future leaves are at the top
    return mapped.sort((a, b) => {
      const dateA = new Date(a.start_date || a.date || 0);
      const dateB = new Date(b.start_date || b.date || 0);
      return dateB - dateA;
    });
  }, [leaves]);

  const dateFilteredLeaves = useMemo(() => {
    return normalizedLeaves.filter(leave => {
      const rawStart = leave.start_date || leave.date;
      if (!rawStart) return true;
      
      const leaveStart = new Date(rawStart);
      if (isNaN(leaveStart.getTime())) return true;
      
      // Month filter
      if (selectedMonth !== 'all') {
        if (leaveStart.getMonth() !== parseInt(selectedMonth)) return false;
      }
      
      // Year filter
      if (selectedYear !== 'all') {
        if (leaveStart.getFullYear() !== parseInt(selectedYear)) return false;
      }
      
      // Date Range filter
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0,0,0,0);
        if (leaveStart < from) return false;
      }
      
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23,59,59,999);
        const rawEnd = leave.end_date || leave.date;
        const leaveEnd = rawEnd ? new Date(rawEnd) : leaveStart;
        if (!isNaN(leaveEnd.getTime()) && leaveEnd > to) return false;
      }
      
      return true;
    });
  }, [normalizedLeaves, selectedMonth, selectedYear, fromDate, toDate]);

  const filteredLeaves = useMemo(() => {
    return dateFilteredLeaves.filter(leave => {
      if (filterStatus === 'all') return true;
      return leave.statusStr === filterStatus;
    });
  }, [dateFilteredLeaves, filterStatus]);



  const leaveTypeMap = { 'AL': 'Annual Leave', 'WFH': 'Work From Home', 'SL': 'Sick Leave', 'OW': 'Offshore Work', 'CompOff': 'Comp Off' };

  return (
    <div className="my-leaves-summary-tab" style={{ marginTop: '20px' }}>
      
      {/* Filters Toolbar */}
      <div className="leave-filters-section" style={{ marginBottom: '16px', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
        
        {/* Top row: Status Tabs & Export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="leave-filters-container" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
            <button className="leave-filter-chip" data-active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>
              <span className="leave-filter-label">All</span>
              <span className="leave-filter-badge">{dateFilteredLeaves.length}</span>
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
            <div className="export-button-wrapper">
              <button className="export-button font-[Helvetica]" onClick={() => setShowExportDropdown(!showExportDropdown)}>
              <Download className="export-button-icon" />
              <span className="export-button-label font-[Helvetica]">Export</span>
              <ChevronDown className="export-button-chevron" />
            </button>
            {showExportDropdown && (
              <div className="export-dropdown">
                <button className="export-dropdown-item" onClick={() => setShowExportDropdown(false)}>
                  <FileSpreadsheet className="export-dropdown-icon" />
                  <span className="export-dropdown-label">Excel</span>
                </button>
                <button className="export-dropdown-item" onClick={() => setShowExportDropdown(false)}>
                  <FileText className="export-dropdown-icon" />
                  <span className="export-dropdown-label">PDF</span>
                </button>
              </div>
            )}
          </div>
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
              onChange={setSelectedYear} 
              options={YEARS} 
              placeholder="Select Year"
              width="130px"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>From:</span>
            <DatePicker 
              value={fromDate ? new Date(fromDate) : null} 
              onChange={(d) => setFromDate(d ? d.toISOString() : null)} 
              placeholder="Start Date" 
              width="130px"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>To:</span>
            <DatePicker 
              value={toDate ? new Date(toDate) : null} 
              onChange={(d) => setToDate(d ? d.toISOString() : null)} 
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
              <col style={{ width: '25%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="leave-table-thead">
              <tr className="leave-table-header-row">
                <th className="leave-table-header">LEAVE TYPE</th>
                <th className="leave-table-header">DATES</th>
                <th className="leave-table-header">WORK DAYS</th>
                <th className="leave-table-header">LEAVE REASON</th>
                <th className="leave-table-header">STATUS</th>
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
                    <td className="leave-table-cell">{leave.leave_reason || leave.reason || '-'}</td>
                    <td className="leave-table-cell">
                      <span className="leave-table-status" data-status={leave.statusStr}>{leave.statusStr}</span>
                    </td>
                    <td className="leave-table-cell">
                      <div className="leave-table-actions">
                        <button className="leave-table-action-button action-view" title="View Details" onClick={() => setViewModalLeave(leave)}>
                          <Eye className="leave-table-action-icon" />
                        </button>
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
