import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Users,
  BarChart3,
  Search,
  List,
  CalendarDays,
  Download,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  FileCheck,
  X,
  Edit,
  Eye,
  SlidersHorizontal,
  CalendarPlus,
  Home,
  Ship,
  ArrowUpDown,
  MessageCircle,
  Bell
} from 'lucide-react';
import { LeaveCard } from '@components/data-display/LeaveCard/LeaveCard';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import { TeamLeaveSummary } from '@components/data-display/TeamLeaveSummary/TeamLeaveSummary';
import { ExportButton } from '@components/ui/ExportButton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { ApplyLeaveModal } from './ApplyLeaveModal';
import { EditLeaveModal } from './EditLeaveModal';
import { CancelLeaveModal } from './CancelLeaveModal';
import { MyLeavesSummaryTab } from './MyLeavesSummaryTab';
import LeaveRequestDrawer from './components/LeaveRequestDrawer';
import { TeamRequestsTab } from './TeamRequestsTab';
import { LeaveConfigurationTab } from './LeaveConfigurationTab';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { useEmployeePhotos } from '@hooks/useEmployeePhotos';
import leaveService from '@services/leaveService';
import consultantService from '@services/consultantService';
import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { MY_LEAVE_EVENTS } from '@mocks/data/leave';

import './LeaveManagementPage.css';
import './LeaveTable.css';
import './TeamRequests.css';
// Apply Leave / My Leaves Summary: open to every authenticated user, no gate.
// Team Leave Requests / Team Leave Summary / Leave Configuration: gated by
// manager hierarchy (managerOnly), never by role or permission — see
// `isManager` above, derived from user.mySubordinates.
const ALL_TABS = [
  { id: 'my-leaves', label: 'Apply Leave', icon: Calendar },
  { id: 'my-leaves-summary', label: 'My Leaves Summary', icon: FileText },
  { id: 'team-requests', label: 'Team Leave Requests', icon: Users, managerOnly: true },
  { id: 'team-summary', label: 'Team Leave Summary', icon: BarChart3, managerOnly: true },
  { id: 'leave-config', label: 'Leave Configuration', icon: SlidersHorizontal, managerOnly: true },
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
  { modalType: 'leave', label: 'Apply Leave', codes: null, icon: Calendar, color: '#006633' },
  { modalType: 'wfh', label: 'Apply WFH', codes: null, icon: Calendar, color: '#006633' },
  { modalType: 'offshore', label: 'Apply Offshore Work', codes: ['OW'], icon: Home, color: '#2563eb' },
  { modalType: 'compoff', label: 'Submit Claim', codes: null, category: null, icon: CalendarPlus, color: '#f59e0b' },
];

const INELIGIBLE_TOOLTIP = 'You are not eligible to apply for this leave type.';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { getRelativePendingTime } from './TeamRequestsTab';

export const TruncatedText = ({ text, maxLength = 25, title = "Details" }) => {
  const [showFull, setShowFull] = useState(false);

  if (!text) return '-';
  if (text.length <= maxLength) return <span>{text}</span>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span>{text.substring(0, maxLength)}...</span>
      <span
        onClick={(e) => { e.stopPropagation(); setShowFull(!showFull); }}
        style={{
          color: 'var(--c-primary)',
          cursor: 'pointer',
          marginLeft: '4px',
          fontSize: '13px',
          fontWeight: '600',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
      >
        More
      </span>
      {showFull && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
            onClick={(e) => { e.stopPropagation(); setShowFull(false); }}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
            width: 'max-content',
            maxWidth: '300px',
            minWidth: '220px',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}>
              <span style={{ fontWeight: '600', color: '#334155', fontSize: '13px' }}>{title}</span>
              <X
                size={16}
                style={{ cursor: 'pointer', color: '#64748b' }}
                onClick={(e) => { e.stopPropagation(); setShowFull(false); }}
              />
            </div>
            <div style={{ padding: '12px 14px', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
              {text}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const SortIcon = ({ field, sortField, sortOrder }) => {
  const isActive = field === sortField;

  return (
    <ArrowUpDown
      size={12}
      style={{
        opacity: isActive ? 1 : 0.4,
        transition: 'all 0.2s ease'
      }}
    />
  );
};

export function LeaveManagementPage() {
  useDocumentTitle('Leave Management');

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

  const [searchParams, setSearchParams] = useSearchParams();
  const viewLeaveIdParam = searchParams.get('viewLeaveId');
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam) return tabParam;
    return localStorage.getItem('leaveManagementActiveTab') || 'my-leaves';
  });

  // Update active tab if URL changes while component is already mounted
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [modalType, setModalType] = useState(null);
  const [editModalLeave, setEditModalLeave] = useState(null);
  const [cancelModalLeave, setCancelModalLeave] = useState(null);
  const [viewModalLeave, setViewModalLeave] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [commentsModalText, setCommentsModalText] = useState(null);
  const currentDate = new Date();
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(currentDate.getMonth());
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuth();
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [eligibleLeaveTypes, setEligibleLeaveTypes] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [modRequests, setModRequests] = useState([]);
  const [cancellingModId, setCancellingModId] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState(MY_LEAVE_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryYear, setSummaryYear] = useState(String(currentDate.getFullYear()));
  const [summaryFrom, setSummaryFrom] = useState(null);
  const [summaryTo, setSummaryTo] = useState(null);

  // Clear the active tab state when navigating away from this page
  // This ensures it resets to the first tab when coming back from another page,
  // but since React cleanup doesn't run on F5 (refresh), it correctly stays on the same tab during refresh.
  useEffect(() => {
    return () => {
      localStorage.removeItem('leaveManagementActiveTab');
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch only if we're on the relevant tab that needs this data
      if (activeTab !== 'my-leaves' && activeTab !== 'my-leaves-summary') return;

      setIsLoading(true);
      setError(null);
      try {
        let targetEmpId = user?.emp_id;

        // Fetch explicitly from user-info if emp_id is missing
        if (!targetEmpId) {
          try {
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
          
          let calendarHolidays = [];
          try {
            const holResponse = await leaveService.listHolidays({ limit: 1000 });
            const holidaysList = Array.isArray(holResponse) ? holResponse : (holResponse?.results || holResponse?.data || []);
            
            calendarHolidays = holidaysList.map(h => {
              const dates = h.dates || [];
              const startDate = dates.length > 0 ? dates[0] : null;
              const endDate = dates.length > 0 ? dates[dates.length - 1] : null;
              
              return {
                ...h,
                id: `hol_${h.id}`,
                title: h.holiday_name || h.name,
                start_date: startDate || h.holiday_date || h.date,
                end_date: endDate || h.holiday_date || h.date,
                leave_type: 'Public Holiday',
                status: 'approved',
                className: 'rbc-event-holiday' // Optional class for styling
              };
            });
            console.log("mapped calendarHolidays:", calendarHolidays); // DEBUG
          } catch(e) {
            console.error("Failed to fetch holidays for calendar", e);
          }

          setLeaves(userLeaves);
          setCalendarEvents([...userLeaves, ...calendarHolidays]);
        } catch (e) {
          console.error("Failed to fetch leaves", e);
          setError(e);
        }

        try {
          // Pending/approved/rejected requests to modify an already-APPROVED
          // leave — shown as their own rows in MyLeavesSummaryTab so the
          // employee can see an edit is awaiting manager re-approval.
          const modResponse = await leaveService.getMyModRequests(targetEmpId);
          setModRequests(Array.isArray(modResponse) ? modResponse : (modResponse?.results || []));
        } catch (e) {
          console.error("Failed to fetch modification requests", e);
        }

      } catch (err) {
        console.error("Failed to fetch leave data", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, activeTab, refreshKey, summaryYear, summaryFrom, summaryTo]);

  // Handle direct navigation via push notifications
  useEffect(() => {
    if (!isLoading && viewLeaveIdParam && leaves.length > 0) {
      // Find the leave in the employee's own list (my-leaves-summary)
      const targetLeave = leaves.find(l => String(l.id) === String(viewLeaveIdParam));
      
      if (targetLeave) {
        setViewModalLeave(targetLeave);
        // Clean up the URL so it doesn't stay there if they refresh
        searchParams.delete('viewLeaveId');
        searchParams.delete('tab');
        setSearchParams(searchParams);
      }
      // Note: If it's a team-requests tab, the TeamRequestsTab component will handle parsing
      // the URL and opening its own internal drawer.
    }
  }, [viewLeaveIdParam, leaves, isLoading, searchParams, setSearchParams]);

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
  // Pending requests to modify an already-APPROVED leave, reshaped into
  // the same field names MyLeavesSummaryTab/ViewLeaveModal already read
  // off a plain Leave record (start_date/end_date/in_days/business_days/
  // leave_reason/status_code) but using the requested NEW values — shown
  // as their own rows (distinct 'MOD_PENDING' status) alongside the
  // employee's regular leaves so a pending edit awaiting manager
  // re-approval is visible. Approved/rejected mod requests aren't shown
  // here — their outcome is already reflected on the original leave row.
  const leavesWithModRequests = useMemo(() => {
    const pendingMods = modRequests
      .filter((m) => m.status === 'PENDING')
      .map((m) => ({
        id: `mod-${m.id}`,
        leave_type: leaves.find((l) => l.id === m.leave_id)?.leave_type || 'Leave',
        start_date: m.new_start_date,
        end_date: m.new_end_date,
        in_days: m.new_in_days,
        business_days: m.new_business_days,
        leave_reason: m.new_leave_reason || m.modification_reason,
        status_code: 'MOD_PENDING',
        comments: m.modification_reason || 'Awaiting manager re-approval',
        requested_date: m.created_at,
        is_mod_request: true,
        mod_request_id: m.id,
        original_leave_id: m.leave_id,
        orig_start_date: m.orig_start_date,
        orig_end_date: m.orig_end_date,
      }));
    return [...leaves, ...pendingMods];
  }, [leaves, modRequests]);

  const handleCancelModRequest = async (modRequestId) => {
    try {
      setCancellingModId(modRequestId);
      await leaveService.cancelModRequest(modRequestId, { emp_id: user?.emp_id });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error('Failed to cancel modification request', e);
    } finally {
      setCancellingModId(null);
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

  // Leave Management is manager-hierarchy-gated, never role/permission-gated:
  // any employee whose emp_id is another employee's manager_id counts as a
  // manager here, full stop. mySubordinates (direct reports, from
  // /auth/user-info/) is the single signal for every manager-only affordance
  // on this screen — Apply Leave / My Leave Summary have no gate at all.
  const isManager = Boolean(user?.mySubordinates?.length > 0);
  const canApplyOnBehalf = isManager;

  // Resolve the manager's own emp_id (falls back to /auth/user-info/ when
  // it's not already on `user`) before the photo hook can be scoped.
  const [resolvedManagerId, setResolvedManagerId] = useState(user?.emp_id ?? null);

  useEffect(() => {
    if (!isManager || user?.emp_id) {
      setResolvedManagerId(user?.emp_id ?? null);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const res = await httpClient.get(endpoints.auth.userInfo);
        const info = res.data?.userInformation || res.data;
        const empId = info?.empId || info?.emp_id || info?.employee_id;
        if (isMounted) setResolvedManagerId(empId ?? null);
      } catch (err) {
        console.error("Failed to fetch user-info for team photos", err);
      }
    })();
    return () => { isMounted = false; };
  }, [isManager, user?.emp_id]);

  const { getPhoto: getTeamPhoto } = useEmployeePhotos({
    managerId: resolvedManagerId,
    enabled: isManager && !!resolvedManagerId,
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const leaveTypeMap = { 'AL': 'Annual Leave', 'WFH': 'Work From Home', 'SL': 'Sick Leave', 'OW': 'Offshore Work', 'CompOff': 'Comp Off' };

  const filteredSortedLeaves = useMemo(() => {
    return leavesWithModRequests.filter(leave => {
      const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'offshore' ? leave.leave_type === 'OW' : statusStr === filterStatus);
      
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const displayType = leaveTypeMap[leave.leave_type] || leave.leave_type;
        matchesSearch = [
          displayType,
          leave.status_code,
          leave.leave_reason,
          leave.start_date,
          leave.end_date
        ].some(val => val && String(val).toLowerCase().includes(q));
      }

      return matchesStatus && matchesSearch;
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
  }, [leavesWithModRequests, filterStatus, sortField, sortOrder]);

  const handleExportCSV = () => {
    const headers = ['Leave Type', 'Start Date', 'End Date', 'Work Days', 'Leave Reason', 'Status', 'Comments'];
    const rows = filteredSortedLeaves.map(l => [
      l.leave_type || '',
      l.start_date || '',
      l.end_date || '',
      l.business_days || 0,
      l.leave_reason || '',
      l.status_code || '',
      l.manager_comment || l.hr_comment || ''
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaves');
    XLSX.writeFile(workbook, 'leaves.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    autoTable(doc, {
      head: [['Leave Type', 'Dates', 'Work Days', 'Leave Reason', 'Status', 'Comments']],
      body: filteredSortedLeaves.map(l => [l.leave_type || '', `${l.start_date || ''} to ${l.end_date || ''}`, l.business_days || 0, l.leave_reason || '', l.status_code || '', l.manager_comment || l.hr_comment || '']),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 78, 216] }
    });
    doc.save('leaves.pdf');
  };

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
          canApplyOnBehalf={canApplyOnBehalf}
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

      {commentsModalText && (
        <div className="al-overlay" onClick={() => setCommentsModalText(null)} style={{ zIndex: 100 }}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', minHeight: 'auto' }}>
            <div className="al-header">
              <div className="al-header-left">
                <h2 className="al-title">Comments</h2>
              </div>
              <button type="button" className="al-close-btn" onClick={() => setCommentsModalText(null)}>
                <X size={15} />
              </button>
            </div>
            <div style={{
              padding: '24px',
              fontSize: '14px',
              color: '#334155',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              background: '#f8fafc',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              borderTop: '1px solid #e2e8f0'
            }}>
              {commentsModalText}
            </div>
          </div>
        </div>
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
            fromDateDuration: viewModalLeave.from_date_duration,
            toDateDuration: viewModalLeave.to_date_duration,
          }}
          drawerAction="view"
          isReadOnly={true}
          onClose={() => setViewModalLeave(null)}
        />
      )}
      <div className="leave-management-tabs">
        {ALL_TABS.filter(tab => !tab.managerOnly || isManager).map((tab) => {
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
                <input 
                  type="text" 
                  placeholder="Search leaves..." 
                  className="my-leaves-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="my-leaves-actions">
                {LEAVE_ACTION_BUTTONS.map(({ modalType: type, label, codes, category, icon: Icon, color }) => {
                  const eligible = isActionEligible(codes, category);
                  return (
                    <button
                      key={type}
                      className="my-leaves-action-btn"
                      disabled={!eligible}
                      title={eligible ? undefined : INELIGIBLE_TOOLTIP}
                      onClick={() => eligible && setModalType(type)}
                      style={{ '--btn-bg': color }}
                    >
                      {Icon && <Icon size={16} />}
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
                subtitle="Outside KSA"
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
                subtitle="Inside KSA"
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
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'pending'}
                        onClick={() => setFilterStatus('pending')}
                      >
                        <span className="leave-filter-label">Pending</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.filter(l => l.status_code?.toLowerCase() === 'pending').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'approved'}
                        onClick={() => setFilterStatus('approved')}
                      >
                        <span className="leave-filter-label">Approved</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.filter(l => l.status_code?.toLowerCase() === 'approved').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'rejected'}
                        onClick={() => setFilterStatus('rejected')}
                      >
                        <span className="leave-filter-label">Rejected</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.filter(l => l.status_code?.toLowerCase() === 'rejected').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'mod-pending'}
                        onClick={() => setFilterStatus('mod-pending')}
                      >
                        <span className="leave-filter-label">Modification Requests</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.filter(l => l.is_mod_request).length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'offshore'}
                        onClick={() => setFilterStatus('offshore')}
                      >
                        <span className="leave-filter-label">Offshore work</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : leavesWithModRequests.filter(l => l.leave_type === 'OW').length}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

                    <ExportButton
                      excel
                      pdf
                      onExcelExport={handleExportCSV}
                      onPdfExport={handleExportPDF}
                    />
                  </div>
                </div>

                {error ? (
                  <ErrorState
                    title="Leave requests could not be loaded"
                    description={error.message}
                    onRetry={() => setRefreshKey((k) => k + 1)}
                  />
                ) : isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <Loader message="Loading your leaves..." />
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="leave-table-container">
                    <table className="leave-table">
                      <colgroup>
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: filterStatus === 'pending' ? '15%' : '25%' }} />
                        {filterStatus === 'pending' && <col style={{ width: '10%' }} />}
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
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
                          <th className="leave-table-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>COMMENTS</div>
                          </th>
                          <th className="leave-table-header">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="leave-table-tbody">
                        {filteredSortedLeaves.map((leave) => {
                          const startDate = new Date(leave.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const endDate = new Date(leave.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const dateDisplay = leave.start_date === leave.end_date ? startDate : `${startDate} - ${endDate}`;

                          const displayType = leaveTypeMap[leave.leave_type] || leave.leave_type;
                          const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
                          const durationText = getDurationDisplay(leave);

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
                                  <span className="leave-table-date-duration">
                                    ({leave.in_days} day{leave.in_days !== 1 ? 's' : ''})
                                    {durationText ? ` • ${durationText}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td className="leave-table-cell" data-label="Work Days">
                                {leave.business_days}
                              </td>
                              <td className="leave-table-cell" data-label="Leave Reason">
                                <TruncatedText text={leave.leave_reason} maxLength={30} title="Leave Reason" />
                              </td>

                              {filterStatus === 'pending' && (
                                <td className="leave-table-cell" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                  {getRelativePendingTime(leave.requested_date || leave.created_at)}
                                </td>
                              )}

                              <td className="leave-table-cell" data-label="Status">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="leave-table-status" data-status={statusStr}>
                                    {statusStr}
                                  </span>
                                  {statusStr === 'pending' && <RemindManagerButton leave={leave} />}
                                </div>
                              </td>

                              <td className="leave-table-cell" data-label="Comments">
                                <button
                                  className="leave-table-action-button"
                                  style={{ color: '#64748b' }}
                                  title="View Comments"
                                  onClick={() => setCommentsModalText(leave.comments || leave.approval_reason || leave.rejected_reason || 'No comments available')}
                                >
                                  <FileCheck />
                                </button>
                              </td>

                              <td className="leave-table-cell" data-label="Action">
                                <div className="leave-table-actions">
                                  {leave.is_mod_request ? (
                                    <button
                                      className="leave-table-action-button action-cancel"
                                      title="Withdraw Modification Request"
                                      disabled={cancellingModId === leave.mod_request_id}
                                      onClick={() => handleCancelModRequest(leave.mod_request_id)}
                                    >
                                      <X className="leave-table-action-icon" />
                                    </button>
                                  ) : (
                                    statusStr !== 'cancelled' && statusStr !== 'rejected' && statusStr !== 'self-rejected' && (
                                      <>

                                        <button
                                          className="tr-act-btn tr-act-edit"
                                          title="Edit Request"
                                          onClick={() => setEditModalLeave(leave)}
                                        >
                                          <Edit className="leave-table-action-icon" />
                                        </button>
                                        <button
                                          className="tr-act-btn tr-act-reject"
                                          title="Cancel Request"
                                          onClick={() => setCancelModalLeave(leave)}
                                        >
                                          <X className="leave-table-action-icon" />
                                        </button>
                                      </>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredSortedLeaves.length === 0 && (
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

        {activeTab === 'team-requests' && <TeamRequestsTab getPhoto={getTeamPhoto} />}

        {false}

        {activeTab === 'team-summary' && <TeamLeaveSummary getPhoto={getTeamPhoto} />}

        {activeTab === 'leave-config' && <LeaveConfigurationTab getPhoto={getTeamPhoto} />}

        {activeTab === 'my-leaves-summary' && error ? (
          <ErrorState
            title="Leave requests could not be loaded"
            description={error.message}
            onRetry={() => setRefreshKey((k) => k + 1)}
          />
        ) : activeTab === 'my-leaves-summary' && (
          <MyLeavesSummaryTab
            leaves={leavesWithModRequests}
            setViewModalLeave={setViewModalLeave}
            selectedYear={summaryYear}
            onYearChange={setSummaryYear}
            fromDate={summaryFrom}
            onFromDateChange={setSummaryFrom}
            toDate={summaryTo}
            onToDateChange={setSummaryTo}
            onCancelModRequest={handleCancelModRequest}
            cancellingModId={cancellingModId}
          />
        )}
      </div>
    </div>
  );
}
export default LeaveManagementPage;

export function RemindManagerButton({ leave }) {
  const { user } = useAuth();
  const toast = useToast();

  const [remindersLeft, setRemindersLeft] = useState(leave.reminders_left ?? 5);
  const [cooldownUntil, setCooldownUntil] = useState(leave.next_reminder_allowed_after ? new Date(leave.next_reminder_allowed_after) : null);
  const [isSending, setIsSending] = useState(false);
  const [now, setNow] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const isCoolingDown = cooldownUntil && cooldownUntil > now;
  const disabled = isSending || isCoolingDown || remindersLeft <= 0;

  const handleRemind = async () => {
    setIsSending(true);
    try {
      const response = await leaveService.remindManager(leave.id || leave.leave_id, { emp_id: user?.emp_id || user?.id });
      const data = response.data || response;
      if (data.success) {
        toast.success(data.message || 'Reminder sent to your manager.');
        if (data.reminders_left !== undefined) setRemindersLeft(data.reminders_left);
        if (data.next_reminder_allowed_after) setCooldownUntil(new Date(data.next_reminder_allowed_after));
      } else {
        toast.error(data.message || 'Failed to send reminder');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to send reminder';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  let title = "Send Reminder";
  if (remindersLeft <= 0) title = "No reminders left";
  else if (isCoolingDown) {
    const diff = cooldownUntil - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    title = `Next reminder in ${h}h ${m}m ${s}s`;
  } else {
    title = `Remind Manager (${remindersLeft} left)`;
  }

  // Hide the button completely if it's the very first reminder and the 24h delay hasn't passed yet
  if (isCoolingDown && remindersLeft === 5) {
    return null;
  }

  return (
    <button
      title={title}
      disabled={disabled}
      onClick={handleRemind}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        borderRadius: '50%',
        background: disabled ? '#f3f4f6' : isHovered ? '#fef3c7' : '#fffbeb',
        color: disabled ? '#9ca3af' : '#d97706',
        border: `1px solid ${disabled ? '#e5e7eb' : '#fde68a'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.7 : 1,
        boxShadow: disabled ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      <Bell size={14} />
    </button>
  );
}
