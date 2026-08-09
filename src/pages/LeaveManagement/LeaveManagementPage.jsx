import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  BarChart3,
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
  Eye,
  SlidersHorizontal,
  CalendarPlus,
  Home
} from 'lucide-react';
import { LeaveCard } from '@components/data-display/LeaveCard/LeaveCard';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import { TeamLeaveSummary } from '@components/data-display/TeamLeaveSummary/TeamLeaveSummary';

import { ApplyLeaveModal } from './ApplyLeaveModal';
import { EditLeaveModal } from './EditLeaveModal';
import { CancelLeaveModal } from './CancelLeaveModal';
import { MyLeavesSummaryTab } from './MyLeavesSummaryTab';
import LeaveRequestDrawer from './components/LeaveRequestDrawer';
import { TeamRequestsTab } from './TeamRequestsTab';
import { LeaveConfigurationTab } from './LeaveConfigurationTab';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';
import { MY_LEAVE_EVENTS } from '@mocks/data/leave';

import './LeaveManagementPage.css';
import './LeaveTable.css';
import './TeamRequests.css';
const ALL_TABS = [
  { id: 'my-leaves', label: 'Apply Leave', icon: Calendar },
  { id: 'my-leaves-summary', label: 'My Leaves Summary', icon: FileText },
  { id: 'team-requests', label: 'Team Leave Requests', icon: Users },
  { id: 'team-summary', label: 'Team Leave Summary', icon: BarChart3 },
  { id: 'leave-config', label: 'Leave Configuration', icon: SlidersHorizontal, adminOnly: true },
];

// Maps each leave-application action button to the eligible-leave-types API
// code(s) that unlock it. "Apply Leave" has no fixed code — it always opens the
// dropdown so eligibility for it is decided per-leave-type inside the modal.
// "Submit Claim" is similar but keyed by category rather than fixed codes —
// it opens a modal listing every active Claim-category leave type the
// employee is eligible for (CWW, CCompOff, and any custom Claim type HR
// created), not just a hardcoded pair.
// To add a new leave-specific button in the future, just add an entry here.
const LEAVE_ACTION_BUTTONS = [
  { modalType: 'leave', label: 'Apply Leave', codes: null },
  { modalType: 'wfh', label: 'Apply WFH', codes: ['WFH'] },
  { modalType: 'offshore', label: 'Apply Offshore Work', codes: ['OW'] },
  { modalType: 'compoff', label: 'Submit Claim', codes: null, category: 'CLAIM' },
];

const INELIGIBLE_TOOLTIP = 'You are not eligible to apply for this leave type.';
import { Loader } from '@components/feedback/Loader/Loader';

export function LeaveManagementPage() {
  useDocumentTitle('Leave Management');

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('leaveManagementActiveTab') || 'my-leaves';
  });
  const [modalType, setModalType] = useState(null);
  const [editModalLeave, setEditModalLeave] = useState(null);
  const [cancelModalLeave, setCancelModalLeave] = useState(null);
  const [viewModalLeave, setViewModalLeave] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const currentDate = new Date();
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(currentDate.getMonth());

  const { user } = useAuth();
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [eligibleLeaveTypes, setEligibleLeaveTypes] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState(MY_LEAVE_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryYear, setSummaryYear] = useState(String(currentDate.getFullYear()));
  const [summaryFrom, setSummaryFrom] = useState(null);
  const [summaryTo, setSummaryTo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch only if we're on the relevant tab that needs this data
      if (activeTab !== 'my-leaves' && activeTab !== 'my-leaves-summary') return;

      setIsLoading(true);
      try {
        let targetEmpId = user?.emp_id;

        // Fetch explicitly from user-info if emp_id is missing
        if (!targetEmpId) {
          try {
            const { default: httpClient } = await import('@api/httpClient');
            const { default: endpoints } = await import('@api/endpoints');
            const res = await httpClient.get(endpoints.auth.userInfo);
            const info = res.data?.userInformation || res.data;
            targetEmpId = info?.empId || info?.emp_id || info?.employee_id;
          } catch (err) {
            console.error("Failed to fetch user-info", err);
          }
        }

        // If STILL no targetEmpId, we must abort instead of falling back to 1
        // to avoid "You can only access your own profile" error.
        if (!targetEmpId) {
          console.error("No valid emp_id found for logged-in user.");
          setIsLoading(false);
          return;
        }

        console.log("Fetching data for targetEmpId:", targetEmpId, "User:", user);

        // leaveBalances / eligibleLeaveTypes only feed the "Apply Leave"
        // tab's summary cards and eligibility checks — MyLeavesSummaryTab
        // doesn't use either, so skip fetching them there.
        if (activeTab === 'my-leaves') {
          try {
            const response = await leaveService.getLeaveBalance(targetEmpId);
            setLeaveBalances(response?.balances);
          } catch (e) {
            console.error("Failed to fetch leave balances", e);
          }

          try {
            const eligibleResponse = await leaveService.getEligibleLeaveTypes(targetEmpId);
            const eligibleList = Array.isArray(eligibleResponse) ? eligibleResponse : (eligibleResponse?.results || []);
            setEligibleLeaveTypes(eligibleList);
          } catch (e) {
            console.error("Failed to fetch eligible leave types", e);
            setEligibleLeaveTypes([]);
          }
        }

        try {
          const leavesParams = {};
          if (summaryYear && summaryYear !== 'all') leavesParams.year = summaryYear;
          if (summaryFrom) leavesParams.from = summaryFrom;
          if (summaryTo) leavesParams.to = summaryTo;

          const leavesResponse = await leaveService.getMyLeaves(targetEmpId, leavesParams);
          const userLeaves = Array.isArray(leavesResponse) ? leavesResponse : (leavesResponse?.results || []);
          setLeaves(userLeaves);
          setCalendarEvents(userLeaves);
        } catch (e) {
          console.error("Failed to fetch leaves", e);
        }

      } catch (error) {
        console.error("Failed to fetch leave data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, calendarYear, calendarMonth, activeTab, refreshKey, summaryYear, summaryFrom, summaryTo]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };
  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };
  // "Apply for: Myself | On Behalf" should only show for users who can
  // actually apply on behalf of someone — a manager with direct/indirect
  // reports, or HR/admin (matches the backend's _is_hr() / _can_manage_target()
  // permission check on the apply-on-behalf endpoint).
  // A button is eligible if it has no fixed code (e.g. the generic "Apply
  // Leave" dropdown) or at least one of its codes is present and active in
  // the eligible-leave-types API response — never hardcoded. `category`
  // covers "Submit Claim", which isn't a fixed pair of codes — it's
  // eligible whenever any active Claim-category leave type exists.
  const isActionEligible = (codes, category) => {
    if (category) {
      return eligibleLeaveTypes.some((t) => t.category === category && t.active !== false);
    }
    if (!codes) return true;
    return eligibleLeaveTypes.some((t) => codes.includes(t.code) && t.active !== false);
  };

  const canApplyOnBehalf = Boolean(
    user?.mySubordinates?.length > 0 ||
    user?.isAdmin === 1 || user?.isAdmin === true ||
    user?.role === 'admin' || user?.roleName?.includes('HR') ||
    user?.role?.toLowerCase()?.includes('admin')
  );

  const pendingDateRangeText = useMemo(() => {
    const pendingLeaves = leaves.filter(l => l.status_code?.toLowerCase() === 'pending');
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
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return minDate.getTime() === maxDate.getTime() ? fmt(minDate) : `${fmt(minDate)} to ${fmt(maxDate)}`;
  }, [leaves]);
  return (
    <div className="leave-management">
      {modalType && (
        <ApplyLeaveModal
          onClose={(shouldRefresh) => {
            setModalType(null);
            if (shouldRefresh === true) {
              setRefreshKey(k => k + 1);
            }
          }}
          isAdmin={canApplyOnBehalf}
          type={modalType}
        />
      )}

      {editModalLeave && (
        <EditLeaveModal
          leave={editModalLeave}
          onClose={() => setEditModalLeave(null)}
          onSuccess={() => {
            setEditModalLeave(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {cancelModalLeave && (
        <CancelLeaveModal
          leave={cancelModalLeave}
          onClose={() => setCancelModalLeave(null)}
          onSuccess={() => {
            setCancelModalLeave(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {viewModalLeave && (
        <LeaveRequestDrawer
          open={!!viewModalLeave}
          liveReq={{
            id: viewModalLeave.id,
            employeeName: user?.username || user?.employee_name || 'You',
            employeeId: user?.emp_id || user?.employee_id || '-',
            leaveType: viewModalLeave.leave_type || viewModalLeave.type,
            startDate: viewModalLeave.start_date || viewModalLeave.date,
            endDate: viewModalLeave.end_date || viewModalLeave.date,
            bizDays: viewModalLeave.business_days || viewModalLeave.in_days || 0,
            requestedOn: viewModalLeave.created_at || new Date().toISOString(),
            status: viewModalLeave.status_code?.toLowerCase().replace('_', '-') || 'pending',
            reason: viewModalLeave.leave_reason || viewModalLeave.reason,
            duration: viewModalLeave.in_days === 0.5 ? 'Half Day' : 'Full Day',
          }}
          drawerAction="view"
          isReadOnly={true}
          onClose={() => setViewModalLeave(null)}
        />
      )}
      <div className="leave-management-tabs">
        {ALL_TABS.filter(tab => !tab.adminOnly || user?.isAdmin === 1 || user?.isAdmin === true || user?.role === 'admin' || user?.roleName?.includes('HR') || user?.role?.toLowerCase()?.includes('admin')).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                localStorage.setItem('leaveManagementActiveTab', tab.id);
                setFilterStatus('all');
              }}
              className="leave-management-tab"
              data-active={activeTab === tab.id}
            >
              <Icon className="leave-management-tab-icon" />
              <span className="leave-management-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="leave-management-content">
        {activeTab === 'my-leaves' && (
          <>
            <div className="my-leaves-toolbar">
              <div className="my-leaves-search-wrapper">
                <Search className="my-leaves-search-icon" />
                <input type="text" placeholder="Search leaves..." className="my-leaves-search" />
              </div>
              <div className="my-leaves-actions">
                {LEAVE_ACTION_BUTTONS.map(({ modalType: type, label, codes, category }) => {
                  const eligible = isActionEligible(codes, category);
                  return (
                    <button
                      key={type}
                      className="my-leaves-action-btn"
                      disabled={!eligible}
                      title={eligible ? undefined : INELIGIBLE_TOOLTIP}
                      onClick={() => eligible && setModalType(type)}
                    >
                      {label}
                    </button>
                  );
                })}
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
                isUnlimited={leaveBalances?.AL?.is_unlimited}
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
                isUnlimited={leaveBalances?.CompOff?.is_unlimited}
                color="#8b5cf6"
              />
              <LeaveCard
                title="Sick Leaves"
                isLoading={isLoading}
                centerCount={leaveBalances?.SL?.entitled ?? 0}
                left={leaveBalances?.SL?.available ?? 0}
                used={leaveBalances?.SL?.used ?? 0}
                total={leaveBalances?.SL?.entitled ?? 0}
                isUnlimited={leaveBalances?.SL?.is_unlimited}
                color="#dc2626"
              />
              <LeaveCard
                title="Weekend Work"
                isLoading={isLoading}
                centerCount={leaveBalances?.WW?.entitled ?? 0}
                left={leaveBalances?.WW?.available ?? 0}
                used={leaveBalances?.WW?.used ?? 0}
                total={leaveBalances?.WW?.entitled ?? 0}
                isUnlimited={leaveBalances?.WW?.is_unlimited}
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
                subtitle="Inside KSA"
                isLoading={isLoading}
                centerCount={leaveBalances?.OW?.entitled ?? 0}
                left={leaveBalances?.OW?.available ?? 0}
                used={leaveBalances?.OW?.used ?? 0}
                total={leaveBalances?.OW?.entitled ?? 0}
                isUnlimited={leaveBalances?.OW?.is_unlimited}
                color="#6366f1"
              />
              <LeaveCard
                title="WFH"
                subtitle="Outside KSA"
                isLoading={isLoading}
                centerCount={leaveBalances?.WFH?.entitled ?? 0}
                left={leaveBalances?.WFH?.available ?? 0}
                used={leaveBalances?.WFH?.used ?? 0}
                total={leaveBalances?.WFH?.entitled ?? 0}
                color="#d97706"
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
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'pending'}
                        onClick={() => setFilterStatus('pending')}
                      >
                        <span className="leave-filter-label">Pending</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.filter(l => l.status_code?.toLowerCase() === 'pending').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'approved'}
                        onClick={() => setFilterStatus('approved')}
                      >
                        <span className="leave-filter-label">Approved</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.filter(l => l.status_code?.toLowerCase() === 'approved').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'rejected'}
                        onClick={() => setFilterStatus('rejected')}
                      >
                        <span className="leave-filter-label">Rejected</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.filter(l => l.status_code?.toLowerCase() === 'rejected').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'self-rejected'}
                        onClick={() => setFilterStatus('self-rejected')}
                      >
                        <span className="leave-filter-label">Self Rejected</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.filter(l => l.status_code?.toLowerCase().replace('_', '-') === 'self-rejected').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'offshore'}
                        onClick={() => setFilterStatus('offshore')}
                      >
                        <span className="leave-filter-label">Offshore work</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leaves.filter(l => l.leave_type === 'OW').length}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {(filterStatus === 'pending') && pendingDateRangeText && (
                        <span style={{ fontSize: '13px', color: '#b45309', fontWeight: 500, backgroundColor: '#fef3c7', padding: '4px 12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                          Pending from: {pendingDateRangeText}
                        </span>
                      )}
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
                    <Loader message="Loading your leaves..." />
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
                        {leaves.filter(leave => {
                          const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
                          return filterStatus === 'all' || (filterStatus === 'offshore' ? leave.leave_type === 'OW' : statusStr === filterStatus);
                        }).map((leave) => {
                          const startDate = new Date(leave.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const endDate = new Date(leave.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const dateDisplay = leave.start_date === leave.end_date ? startDate : `${startDate} - ${endDate}`;

                          // Mapping standard abbreviation codes to readable text if needed
                          const leaveTypeMap = { 'AL': 'Annual Leave', 'WFH': 'Work From Home', 'SL': 'Sick Leave', 'OW': 'Offshore Work', 'CompOff': 'Comp Off' };
                          const displayType = leaveTypeMap[leave.leave_type] || leave.leave_type;
                          const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';

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
                                {(leave.comments || leave.approval_reason || leave.rejected_reason) ? (
                                  <span style={{ fontSize: '13px', color: '#666' }}>
                                    {leave.comments || leave.approval_reason || leave.rejected_reason}
                                  </span>
                                ) : '-'}
                              </td>

                              <td className="leave-table-cell" data-label="Action">
                                <div className="leave-table-actions">
                                  {statusStr !== 'cancelled' && statusStr !== 'rejected' && statusStr !== 'self-rejected' && (
                                    <>
                                      <button
                                        className="leave-table-action-button action-cancel"
                                        title="Cancel Request"
                                        onClick={() => setCancelModalLeave(leave)}
                                      >
                                        <X className="leave-table-action-icon" />
                                      </button>
                                      <button
                                        className="leave-table-action-button action-edit"
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
                        {leaves.filter(leave => {
                          const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
                          return filterStatus === 'all' || (filterStatus === 'offshore' ? leave.leave_type === 'OW' : statusStr === filterStatus);
                        }).length === 0 && (
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
        )}

        {activeTab === 'team-requests' && <TeamRequestsTab />}

        {false}

        {activeTab === 'team-summary' && <TeamLeaveSummary />}

        {activeTab === 'leave-config' && <LeaveConfigurationTab />}

        {activeTab === 'my-leaves-summary' && (
          <MyLeavesSummaryTab
            leaves={leaves}
            setViewModalLeave={setViewModalLeave}
            selectedYear={summaryYear}
            onYearChange={setSummaryYear}
            fromDate={summaryFrom}
            onFromDateChange={setSummaryFrom}
            toDate={summaryTo}
            onToDateChange={setSummaryTo}
          />
        )}
      </div>
    </div>
  );
}
export default LeaveManagementPage;
