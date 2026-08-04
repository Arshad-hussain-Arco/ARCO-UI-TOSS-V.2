import {
  Search,
  List,
  CalendarDays,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileCheck,
  X,
  Edit,
} from 'lucide-react';
import { LeaveCard } from '@components/data-display/LeaveCard/LeaveCard';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import { TableSkeleton } from '@components/feedback/Skeleton';

const LEAVE_TYPE_MAP = { 'AL': 'Annual Leave', 'WFH': 'Work From Home', 'SL': 'Sick Leave', 'OW': 'Offshore Work', 'CompOff': 'Comp Off' };

function statusOf(leave) {
  return leave.status === 1 ? 'pending' : (leave.status === 3 ? 'approved' : (leave.status === 2 ? 'rejected' : (leave.status === 4 ? 'self-rejected' : leave.status_code?.toLowerCase() || 'pending')));
}

export function MyLeavesTab({
  isLoading,
  leaveBalances,
  leaves,
  filterStatus,
  setFilterStatus,
  viewMode,
  setViewMode,
  showExportDropdown,
  setShowExportDropdown,
  calendarYear,
  calendarMonth,
  calendarEvents,
  handlePrevMonth,
  handleNextMonth,
  setModalType,
  setCancelModalLeave,
  setEditModalLeave,
}) {
  const filteredLeaves = leaves.filter(leave => {
    const statusStr = statusOf(leave);
    return filterStatus === 'all' || (filterStatus === 'offshore' ? leave.leave_type === 'OW' : statusStr === filterStatus);
  });

  return (
    <>
      <div className="my-leaves-toolbar">
        <div className="my-leaves-search-wrapper">
          <Search className="my-leaves-search-icon" />
          <input type="text" placeholder="Search leaves..." className="my-leaves-search" />
        </div>
        <div className="my-leaves-actions">
          <button className="my-leaves-action-btn" onClick={() => setModalType('leave')}>
            Apply Leave
          </button>
          <button className="my-leaves-action-btn" onClick={() => setModalType('wfh')}>
            Apply WFH
          </button>
          <button className="my-leaves-action-btn" onClick={() => setModalType('offshore')}>
            Apply Offshore Work
          </button>
          <button className="my-leaves-action-btn" onClick={() => setModalType('compoff')}>
            Book Comp-off / Weekend Work
          </button>
        </div>
      </div>

      <div className="leave-cards-grid">
        <LeaveCard
          title="Leave Quota"
          isLoading={isLoading}
          centerCount={leaveBalances?.AL?.entitled ?? 0}
          left={leaveBalances?.AL?.available ?? 0}
          used={leaveBalances?.AL?.used ?? 0}
          total={leaveBalances?.AL?.entitled ?? 0}
          color="#006633"
        />
        <LeaveCard
          title="Carry Over"
          isLoading={isLoading}
          centerCount={leaveBalances?.AL?.carried_forward ?? 0}
          left={leaveBalances?.AL?.carried_forward ?? 0}
          used={0}
          total={leaveBalances?.AL?.carried_forward ?? 0}
          color="#0891b2"
        />
        <LeaveCard
          title="Comp Off"
          isLoading={isLoading}
          centerCount={leaveBalances?.CompOff?.entitled ?? 0}
          left={leaveBalances?.CompOff?.available ?? 0}
          used={leaveBalances?.CompOff?.used ?? 0}
          total={leaveBalances?.CompOff?.entitled ?? 0}
          color="#8b5cf6"
        />
        <LeaveCard
          title="Sick Leaves"
          isLoading={isLoading}
          centerCount={leaveBalances?.SL?.entitled ?? 0}
          left={leaveBalances?.SL?.available ?? 0}
          used={leaveBalances?.SL?.used ?? 0}
          total={leaveBalances?.SL?.entitled ?? 0}
          color="#dc2626"
        />
        <LeaveCard
          title="Weekend Work"
          isLoading={isLoading}
          centerCount={leaveBalances?.WW?.entitled ?? 0}
          left={leaveBalances?.WW?.available ?? 0}
          used={leaveBalances?.WW?.used ?? 0}
          total={leaveBalances?.WW?.entitled ?? 0}
          color="#f59e0b"
        />
        <LeaveCard
          title="Booked Leave"
          isLoading={isLoading}
          centerCount={leaveBalances?.AL?.used ?? 0}
          left={0}
          used={leaveBalances?.AL?.used ?? 0}
          total={leaveBalances?.AL?.used ?? 0}
          color="#059669"
        />
        <LeaveCard
          title="Upcoming"
          isLoading={isLoading}
          centerCount={0}
          left={0}
          used={0}
          total={0}
          color="#3b82f6"
        />
        <LeaveCard
          title="Completed"
          isLoading={isLoading}
          centerCount={0}
          left={0}
          used={0}
          total={0}
          color="#10b981"
        />
        <LeaveCard
          title="Offshore Work"
          isLoading={isLoading}
          centerCount={leaveBalances?.OW?.entitled ?? 0}
          left={leaveBalances?.OW?.available ?? 0}
          used={leaveBalances?.OW?.used ?? 0}
          total={leaveBalances?.OW?.entitled ?? 0}
          color="#6366f1"
        />
      </div>

      <div className="leave-content-split-section" style={{ display: 'block' }}>
        <div className="leave-content-left" style={{ width: '100%' }}>
          <div className="leave-filters-section">
            <div className="leave-filters-row">
              <div className="leave-filters-container">
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'all'}
                  onClick={() => setFilterStatus('all')}
                >
                  <span className="leave-filter-label">All</span>
                  <span className="leave-filter-badge">{leaves.length}</span>
                </button>
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'pending'}
                  onClick={() => setFilterStatus('pending')}
                >
                  <span className="leave-filter-label">Pending</span>
                  <span className="leave-filter-badge">{leaves.filter(l => (l.status === 1 || l.status_code?.toLowerCase() === 'pending')).length}</span>
                </button>
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'approved'}
                  onClick={() => setFilterStatus('approved')}
                >
                  <span className="leave-filter-label">Approved</span>
                  <span className="leave-filter-badge">{leaves.filter(l => (l.status === 3 || l.status_code?.toLowerCase() === 'approved')).length}</span>
                </button>
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'rejected'}
                  onClick={() => setFilterStatus('rejected')}
                >
                  <span className="leave-filter-label">Rejected</span>
                  <span className="leave-filter-badge">{leaves.filter(l => (l.status === 2 || l.status_code?.toLowerCase() === 'rejected')).length}</span>
                </button>
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'self-rejected'}
                  onClick={() => setFilterStatus('self-rejected')}
                >
                  <span className="leave-filter-label">Self Rejected</span>
                  <span className="leave-filter-badge">{leaves.filter(l => (l.status === 4 || l.status_code?.toLowerCase() === 'self-rejected')).length}</span>
                </button>
                <button
                  className="leave-filter-chip"
                  data-active={filterStatus === 'offshore'}
                  onClick={() => setFilterStatus('offshore')}
                >
                  <span className="leave-filter-label">Offshore work</span>
                  <span className="leave-filter-badge">{leaves.filter(l => l.leave_type === 'OW').length}</span>
                </button>
              </div>

              <div className="view-mode-segmented">
                <button
                  className="view-mode-segment"
                  data-active={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  <List className="view-mode-icon" />
                </button>
                <button
                  className="view-mode-segment"
                  data-active={viewMode === 'calendar'}
                  onClick={() => setViewMode('calendar')}
                >
                  <CalendarDays className="view-mode-icon" />
                </button>
              </div>

              <div className="export-button-wrapper">
                <button
                  className="export-button font-[Helvetica]"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                >
                  <Download className="export-button-icon" />
                  <span className="export-button-label font-[Helvetica]">Export</span>
                  <ChevronDown className="export-button-chevron" />
                </button>

                {showExportDropdown && (
                  <div className="export-dropdown">
                    <button
                      className="export-dropdown-item"
                      onClick={() => {
                        setShowExportDropdown(false);
                      }}
                    >
                      <FileSpreadsheet className="export-dropdown-icon" />
                      <span className="export-dropdown-label">Excel</span>
                    </button>
                    <button
                      className="export-dropdown-item"
                      onClick={() => {
                        setShowExportDropdown(false);
                      }}
                    >
                      <FileText className="export-dropdown-icon" />
                      <span className="export-dropdown-label">PDF</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              <TableSkeleton rows={5} columns={7} showHeader={false} />
            </div>
          ) : viewMode === 'list' ? (
            <div className="leave-table-container">
              <table className="leave-table">
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="leave-table-thead">
                  <tr className="leave-table-header-row">
                    <th className="leave-table-header">LEAVE TYPE</th>
                    <th className="leave-table-header">DATES</th>
                    <th className="leave-table-header">WORK DAYS</th>
                    <th className="leave-table-header">LEAVE REASON</th>
                    <th className="leave-table-header">STATUS</th>
                    <th className="leave-table-header">COMMENTS</th>
                    <th className="leave-table-header">ACTION</th>
                  </tr>
                </thead>
                <tbody className="leave-table-tbody">
                  {filteredLeaves.map((leave) => {
                    const startDate = new Date(leave.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                    const endDate = new Date(leave.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                    const dateDisplay = leave.start_date === leave.end_date ? startDate : `${startDate} - ${endDate}`;
                    const displayType = LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type;
                    const statusStr = statusOf(leave);

                    return (
                      <tr key={leave.id} className="leave-table-row">
                        <td className="leave-table-cell" data-label="Leave Type">
                          {displayType}
                        </td>
                        <td className="leave-table-cell" data-label="Dates">
                          <div className="leave-table-dates">
                            <span className="leave-table-date-text text-[14px]">
                              {dateDisplay}
                            </span>
                            <span className="leave-table-date-duration">({leave.in_days} day{leave.in_days !== 1 ? 's' : ''})</span>
                          </div>
                        </td>
                        <td className="leave-table-cell" data-label="Work Days">
                          {leave.business_days}
                        </td>
                        <td className="leave-table-cell" data-label="Leave Reason">
                          {leave.leave_reason}
                        </td>
                        <td className="leave-table-cell" data-label="Status">
                          <span className="leave-table-status" data-status={statusStr}>
                            {statusStr}
                          </span>
                        </td>
                        <td className="leave-table-cell" data-label="Comments">
                          {(leave.approval_reason || leave.rejected_reason) ? (
                            <button className="leave-table-icon-button" title={leave.approval_reason || leave.rejected_reason}>
                              <FileCheck className="leave-table-icon" />
                            </button>
                          ) : null}
                        </td>
                        <td className="leave-table-cell" data-label="Action">
                          <div className="leave-table-actions">
                            {statusStr !== 'cancelled' && statusStr !== 'rejected' && statusStr !== 'self-rejected' && (
                              <>
                                <button
                                  className="leave-table-action-button"
                                  title="Cancel Request"
                                  onClick={() => setCancelModalLeave(leave)}
                                >
                                  <X className="leave-table-action-icon" />
                                </button>
                                <button
                                  className="leave-table-action-button"
                                  title="Edit Request"
                                  onClick={() => setEditModalLeave(leave)}
                                >
                                  <Edit className="leave-table-action-icon" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeaves.length === 0 && (
                    <tr className="leave-table-row">
                      <td colSpan="7" className="leave-table-cell text-center py-4">No leaves found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <LeaveCalendar
              year={calendarYear}
              month={calendarMonth}
              events={calendarEvents}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default MyLeavesTab;
