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
  Bell,
  ScissorsLineDashed,
  Globe2
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
import { EditClaimModal } from './EditClaimModal';
import { CancelLeaveModal } from './CancelLeaveModal';
import { PartialCancelLeaveModal } from './PartialCancelLeaveModal';
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

import './LeaveManagementPage.css';
import './LeaveTable.css';
import './TeamRequests.css';
// Apply Leave / My Leaves Summary: open to every authenticated user, no gate.
// Team Leave Requests / Team Leave Summary / Leave Configuration: gated by
// manager hierarchy (managerOnly), never by role or permission — see
// `isManager` above, derived from user.mySubordinates.
const ALL_TABS = [
  { id: 'my-leaves', label: 'My Leaves', icon: Calendar },
  { id: 'my-leaves-summary', label: 'My Leaves History', icon: FileText },
  { id: 'team-requests', label: 'Team Leave Requests', icon: Users, managerOnly: true },
  { id: 'team-summary', label: 'Team Leave Summary', icon: BarChart3, managerOnly: true },
  { id: 'leave-config', label: 'Leave Configuration', icon: SlidersHorizontal, managerOnly: true },
];

// A multi-date claim submission (see ApplyLeaveModal's Claim flow) creates
// one Leave row per claimed date/half on the backend — the employee applied
// under one Claim Type + reason in a single "Submit Claim" click, though,
// so showing N separate rows here (and in Team Leave Requests) would look
// like N unrelated requests. The backend stamps every row from one
// submit_claim() call with the identical requested_date instant (no
// dedicated batch-id column exists on the Leave table), so that plus
// leave_type is the grouping key. leave_category (LMSLeaveType.category,
// sent by the backend's LeaveSerializer) is the authoritative "is this a
// claim" signal — business_days === 0 was tried first and reverted, since
// it also false-positives on ordinary Actual/Nominal leave rows (e.g. a
// still-PENDING leave whose business_days hasn't been computed yet),
// which showed up as Annual/Sick Leave incorrectly landing in claim-only
// counts/filters.
// Renders one balance-backed LeaveCard from `leaveBalances[code]` (the
// per-leave-type object BalanceService.summary() returns), always wiring
// isUnlimited from the API response — so a leave type's policy can be
// flipped between Limited/Unlimited without any card needing its own
// isUnlimited prop remembered by hand.
function balanceCard(leaveBalances, isLoading, code, title, color, subtitle) {
  const bal = leaveBalances?.[code];
  return (
    <LeaveCard
      key={code}
      title={title}
      subtitle={subtitle}
      isLoading={isLoading}
      centerCount={bal?.entitled ?? 0}
      left={bal?.available ?? 0}
      used={bal?.used ?? 0}
      total={bal?.entitled ?? 0}
      isUnlimited={bal?.is_unlimited ?? false}
      color={color}
    />
  );
}

function groupClaimLeaves(leaves) {
  const groups = new Map();
  const result = [];
  leaves.forEach((lv) => {
    const isClaimRow = lv.leave_category === 'CLAIM' && lv.requested_date && lv.leave_type;
    if (!isClaimRow) {
      result.push(lv);
      return;
    }
    const key = `${lv.emp_id}|${lv.leave_type}|${lv.requested_date}`;
    const existing = groups.get(key);
    if (!existing) {
      const group = {
        ...lv,
        claimDates: [{ id: lv.id, date: lv.start_date, duration: lv.leave_duration, in_days: lv.in_days }],
      };
      groups.set(key, group);
      result.push(group);
    } else {
      existing.claimDates.push({ id: lv.id, date: lv.start_date, duration: lv.leave_duration, in_days: lv.in_days });
      existing.in_days = (Number(existing.in_days) || 0) + (Number(lv.in_days) || 0);
      if (lv.start_date < existing.start_date) existing.start_date = lv.start_date;
      if (lv.end_date > existing.end_date) existing.end_date = lv.end_date;
    }
  });
  result.forEach((r) => {
    if (r.claimDates && r.claimDates.length > 1) {
      r.claimDates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    } else {
      delete r.claimDates;
    }
  });
  return result;
}

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
  { modalType: 'wfh', label: 'Apply WFH', codes: ['WFH'], icon: Calendar, color: '#006633' },
  { modalType: 'offshore', label: 'Apply Offshore Work', codes: ['OW'], icon: Home, color: '#3b82f6' },
  { modalType: 'compoff', label: 'Submit Claim', codes: null, category: null, icon: CalendarPlus, color: '#f59e0b' },
];

const INELIGIBLE_TOOLTIP = 'You are not eligible to apply for this leave type.';
import { Loader } from '@components/feedback/Loader/Loader';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { getRelativePendingTime, STATUS_TOOLTIPS } from './TeamRequestsTab';

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

/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function LeaveManagementSkeleton() {
  return (
    <div style={{ width: '100%' }}>
      <Skeleton height={48} width="100%" style={{ borderRadius: '8px 8px 0 0', marginBottom: '2px' }} />
      <Skeleton height={64} width="100%" count={1} style={{ marginBottom: '2px' }} />
      <Skeleton height={64} width="100%" count={1} style={{ marginBottom: '2px' }} />
      <Skeleton height={64} width="100%" count={1} style={{ marginBottom: '2px' }} />
      <Skeleton height={64} width="100%" count={1} style={{ borderRadius: '0 0 8px 8px' }} />
    </div>
  );
}

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
  const [editModalClaim, setEditModalClaim] = useState(null);
  const [cancelModalLeave, setCancelModalLeave] = useState(null);
  const [partialCancelModalLeave, setPartialCancelModalLeave] = useState(null);
  const [viewModalLeave, setViewModalLeave] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  // Offshore work / WFH used to be crammed into filterStatus too (mutually
  // exclusive with every status pill), so picking one reset any active
  // status filter and vice versa. Split into its own dimension so they
  // combine via AND — see filteredSortedLeaves below.
  const [filterType, setFilterType] = useState('all');
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
  const [calendarHolidayEvents, setCalendarHolidayEvents] = useState([]);
  const [calendarDayFlags, setCalendarDayFlags] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryYear, setSummaryYear] = useState(String(currentDate.getFullYear()));
  const [summaryFrom, setSummaryFrom] = useState(null);
  const [summaryTo, setSummaryTo] = useState(null);
  const [leaveTypeMap, setLeaveTypeMap] = useState({});

  // Code -> readable name lookup for every leave type that exists (not
  // just ones the current employee is eligible for right now — a past
  // leave can reference a type they no longer qualify for), fetched once
  // since it's shared read-only reference data used across this page's
  // tabs and modals.
  useEffect(() => {
    leaveService.getAllLeaveTypes()
      .then((response) => {
        const list = Array.isArray(response) ? response : (response?.results || []);
        const map = {};
        list.forEach((t) => {
          if (t.code) map[t.code] = t.leave_type || t.name || t.code;
        });
        setLeaveTypeMap(map);
      })
      .catch((e) => console.error('Failed to fetch leave types', e));
  }, []);

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
          } catch(e) {
            console.error("Failed to fetch holidays for calendar", e);
          }

          // groupClaimLeaves collapses a multi-date claim submission (one
          // Leave row per claimed date/half on the backend) into a single
          // row with an itemized claimDates list, so it displays and
          // approves as one request instead of N — see groupClaimLeaves
          // above for the full rationale.
          setLeaves(groupClaimLeaves(userLeaves));
          setCalendarHolidayEvents(calendarHolidays);
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

  // Real weekend/holiday flags for the visible month, from the employee's
  // own calendar endpoint — same integration as TeamRequestsTab's
  // dayFlags, but for a single employee (this page's `me/<id>/calendar/`
  // rather than the manager `team-employee-calendars/`).
  useEffect(() => {
    if (activeTab !== 'my-leaves' || viewMode !== 'calendar') return;
    const targetEmpId = user?.emp_id;
    if (!targetEmpId) return;
    const start = new Date(calendarYear, calendarMonth, 1).toISOString().slice(0, 10);
    const end = new Date(calendarYear, calendarMonth + 1, 0).toISOString().slice(0, 10);
    let cancelled = false;
    leaveService.getCalendar(targetEmpId, { start, end })
      .then((data) => {
        if (cancelled) return;
        const map = {};
        (data?.calendar || []).forEach((d) => {
          map[d.date] = {
            isWeekend: !!d.is_weekend,
            isHoliday: !!d.is_org_holiday,
            claimTypes: (d.claim_types || []).map((c) => c.name || c.code),
          };
        });
        setCalendarDayFlags(map);
      })
      .catch((error) => {
        console.error('Failed to fetch my calendar:', error);
        if (!cancelled) setCalendarDayFlags({});
      });
    return () => { cancelled = true; };
  }, [activeTab, viewMode, calendarYear, calendarMonth, user]);

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
    const pendingModsRaw = modRequests.filter((m) => m.status === 'PENDING');

    // A Claim batch edit (see ClaimService.modify_claim_batch) creates one
    // LeaveModificationRequest per date, all sharing `batch_key` — group
    // them back into a single display row (same claimDates shape as
    // groupClaimLeaves) so the whole edited claim shows as ONE
    // Modification-Pending entry instead of one row per date. Regular
    // (non-claim) mod requests have no batch_key, so each is its own group.
    const byGroup = new Map();
    pendingModsRaw.forEach((m) => {
      const key = m.batch_key || `single-${m.id}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(m);
    });

    const pendingMods = [];
    byGroup.forEach((mods) => {
      mods.sort((a, b) => (a.new_start_date < b.new_start_date ? -1 : a.new_start_date > b.new_start_date ? 1 : 0));
      const first = mods[0];
      const last = mods[mods.length - 1];
      const row = {
        id: `mod-${first.id}`,
        leave_type: leaves.find((l) => l.id === first.leave_id)?.leave_type || 'Leave',
        start_date: first.new_start_date,
        end_date: last.new_end_date,
        in_days: mods.reduce((sum, m) => sum + (Number(m.new_in_days) || 0), 0),
        business_days: mods.reduce((sum, m) => sum + (Number(m.new_business_days) || 0), 0),
        leave_reason: first.new_leave_reason || first.modification_reason,
        status_code: 'MOD_PENDING',
        comments: first.modification_reason || 'Awaiting manager re-approval',
        requested_date: first.created_at,
        is_mod_request: true,
        mod_request_id: first.id,
        mod_request_ids: mods.map((m) => m.id),
        original_leave_id: first.leave_id,
        original_leave_ids: mods.map((m) => m.leave_id),
        orig_start_date: mods[0].orig_start_date,
        orig_end_date: last.orig_end_date,
        orig_duration: first.orig_duration,
        leave_duration: first.new_duration,
      };
      if (mods.length > 1) {
        row.claimDates = mods.map((m) => ({
          id: m.leave_id, date: m.new_start_date, duration: m.new_duration, in_days: m.new_in_days,
          orig_in_days: m.orig_in_days, orig_duration: m.orig_duration,
        }));
      }
      pendingMods.push(row);
    });

    // A mod request normally wraps an already-APPROVED leave — the
    // original row should stay visible exactly as it is (still Approved)
    // right alongside this synthetic MOD_PENDING overlay, only getting
    // replaced once the manager actually approves the edit. The one
    // exception is a Claim "add a date to my approved claim" mod request,
    // which wraps a leave that's itself still PENDING and has never been
    // approved before (see ClaimService.modify_claim_batch /
    // _create_claim_mod_request's orig_in_days=0 addition marker) — left
    // in `leaves` unfiltered, THAT row would show up twice: once as a
    // plain Pending claim, once as this Mod-Pending overlay, for a date
    // that was never really "its own" claim to begin with. Only that pure-
    // addition case gets dropped from the plain list; every other wrapped
    // leave (unchanged, duration-changed, or proposed-for-removal) keeps
    // showing normally until the edit is decided.
    const pureAdditionLeaveIds = new Set(
      pendingModsRaw.filter((m) => Number(m.orig_in_days) === 0).map((m) => m.leave_id),
    );
    const leavesWithoutModWrapped = leaves.filter((l) => !pureAdditionLeaveIds.has(l.id));
    return [...leavesWithoutModWrapped, ...pendingMods];
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
  // Partial cancel is only meaningful for Actual/Nominal leave types, not
  // Claim-category ones (a claim earns balance on approval — there's no
  // "unused portion" to hand back the way there is for a normal leave).
  const claimLeaveTypeCodes = useMemo(
    () => new Set(eligibleLeaveTypes.filter((t) => t.category === 'CLAIM').map((t) => t.code)),
    [eligibleLeaveTypes]
  );

  const isActionEligible = (codes, category) => {
    if (canApplyOnBehalf) return true;
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
  const isManager = Boolean(user?.isManager);
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

  // Search applies before the status/type chips, so the chip badge counts
  // (All/Pending/Approved/.../Offshore work/Work From Home) reflect the
  // search too — typing narrows both the table and what each chip counts,
  // same pattern as MyLeavesSummaryTab's searchFilteredLeaves.
  const searchFilteredLeaves = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leavesWithModRequests;
    return leavesWithModRequests.filter(leave => {
      const displayType = leave.leave_name || leaveTypeMap[leave.leave_type] || leave.leave_type;
      return [
        displayType,
        leave.status_code,
        leave.leave_reason,
        leave.start_date,
        leave.end_date
      ].some(val => val && String(val).toLowerCase().includes(q));
    });
  }, [leavesWithModRequests, searchQuery, leaveTypeMap]);

  const typeFilteredLeaves = useMemo(() => {
    if (filterType === 'all') return searchFilteredLeaves;
    return searchFilteredLeaves.filter(leave => 
      filterType === 'offshore' ? leave.leave_type === 'OW' : leave.leave_type === 'WFH'
    );
  }, [searchFilteredLeaves, filterType]);

  const filteredSortedLeaves = useMemo(() => {
    return typeFilteredLeaves.filter(leave => {
      const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
      const statusMatch = filterStatus === 'all' || statusStr === filterStatus;
      return statusMatch;
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
  }, [typeFilteredLeaves, filterStatus, sortField, sortOrder]);

  // Calendar view mirrors whatever the status/type chips above have
  // filtered `filteredSortedLeaves` down to — same integration pattern as
  // TeamRequestsTab's calEvents — instead of always showing every leave
  // regardless of the active chip. Holidays are unaffected by the chips
  // and always render.
  const calendarEvents = useMemo(() => {
    const mappedLeaves = filteredSortedLeaves.flatMap((l) => {
      const displayType = l.leave_name || leaveTypeMap[l.leave_type] || l.leave_type;
      const status = l.status_code === 'MOD_PENDING' ? 'pending' : (l.status_code?.toLowerCase() || 'pending');
      const base = {
        ...l,
        status,
        title: l.is_mod_request ? `Modification Request - ${displayType}` : displayType,
        leave_type: displayType,
      };
      // A grouped multi-date claim (see groupClaimLeaves) carries start_date/
      // end_date as the min/max of its claimed dates for the table view's
      // sake — but those dates aren't necessarily contiguous (that's the
      // whole reason Claims take an explicit date list, not a range; see
      // ClaimSubmitSerializer). Rendering start_date -> end_date as one
      // calendar event would draw a single continuous span covering every
      // day in between, implying continuous leave across weeks that were
      // never actually claimed. Expand back into one single-day event per
      // actually-claimed date instead — same fix as TeamRequestsTab's
      // calEvents.
      if (l.claimDates && l.claimDates.length > 1) {
        return l.claimDates.map((cd) => ({
          ...base,
          id: cd.id,
          start_date: cd.date,
          end_date: cd.date,
          in_days: cd.in_days,
          leave_duration: cd.duration,
        }));
      }
      // Split standard leaves around holidays so they don't visually overlap
      const splitSegments = [];
      let currentStart = new Date(base.start_date);
      const leaveEnd = new Date(base.end_date);
      currentStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(0, 0, 0, 0);

      // Sort holidays by start date
      const sortedHols = [...calendarHolidayEvents].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      for (const hol of sortedHols) {
        if (!hol.start_date || !hol.end_date) continue;
        const hs = new Date(hol.start_date); hs.setHours(0, 0, 0, 0);
        const he = new Date(hol.end_date); he.setHours(0, 0, 0, 0);
        
        if (currentStart <= leaveEnd) {
           if (currentStart <= he && leaveEnd >= hs) {
              // Overlap found
              if (currentStart < hs) {
                 // Segment before the holiday
                 const segEnd = new Date(hs);
                 segEnd.setDate(segEnd.getDate() - 1);
                 const formattedStart = new Date(currentStart.getTime() - (currentStart.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                 const formattedEnd = new Date(segEnd.getTime() - (segEnd.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                 splitSegments.push({
                   ...base,
                   start_date: formattedStart,
                   end_date: formattedEnd,
                   id: `${base.id}_${splitSegments.length}`
                 });
              }
              // Move currentStart past the holiday
              const nextStart = new Date(he);
              nextStart.setDate(nextStart.getDate() + 1);
              currentStart = nextStart > currentStart ? nextStart : currentStart;
           }
        }
      }
      
      if (currentStart <= leaveEnd) {
        const formattedStart = new Date(currentStart.getTime() - (currentStart.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const formattedEnd = new Date(leaveEnd.getTime() - (leaveEnd.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        splitSegments.push({
           ...base,
           start_date: formattedStart,
           end_date: formattedEnd,
           id: `${base.id}_${splitSegments.length}`
        });
      }
      
      return splitSegments;
    });
    return [...mappedLeaves, ...calendarHolidayEvents];
  }, [filteredSortedLeaves, calendarHolidayEvents, leaveTypeMap]);

  const handleExportCSV = () => {
    const headers = ['Leave Type', 'Start Date', 'End Date', 'Work Days', 'Leave Reason', 'Status', 'Comments'];
    const rows = filteredSortedLeaves.map(l => [
      l.leave_name || l.leave_type || '',
      l.start_date || '',
      l.end_date || '',
      l.business_days || 0,
      l.leave_reason || '',
      l.status_code || '',
      l.comments || (l.status_code === 'REJECTED' ? l.rejected_reason : l.approval_reason) || l.rejected_reason || l.approval_reason || ''
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
      body: filteredSortedLeaves.map(l => [l.leave_name || l.leave_type || '', `${l.start_date || ''} to ${l.end_date || ''}`, l.business_days || 0, l.leave_reason || '', l.status_code || '', l.comments || (l.status_code === 'REJECTED' ? l.rejected_reason : l.approval_reason) || l.rejected_reason || l.approval_reason || '']),      
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
          selfEligible={(() => {
            const btn = LEAVE_ACTION_BUTTONS.find((b) => b.modalType === modalType);
            if (!btn) return true;
            if (btn.category) return eligibleLeaveTypes.some((t) => t.category === btn.category && t.active !== false);
            if (!btn.codes) return true;
            return eligibleLeaveTypes.some((t) => btn.codes.includes(t.code) && t.active !== false);
          })()}
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

      {editModalClaim && (
        <EditClaimModal
          leaveGroup={editModalClaim}
          onClose={() => setEditModalClaim(null)}
          onSuccess={() => {
            setEditModalClaim(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {cancelModalLeave && (
        <CancelLeaveModal
          leave={cancelModalLeave}
          pendingModRequest={modRequests.find(
            (m) => m.status === 'PENDING' && m.leave_id === cancelModalLeave.id,
          ) || null}
          leaveTypeMap={leaveTypeMap}
          onClose={() => setCancelModalLeave(null)}
          onSuccess={() => {
            setCancelModalLeave(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {partialCancelModalLeave && (
        <PartialCancelLeaveModal
          leave={partialCancelModalLeave}
          onClose={() => setPartialCancelModalLeave(null)}
          onSuccess={() => {
            setPartialCancelModalLeave(null);
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
            // employeeName is the bold header line, employeeId renders
            // directly below it — this was showing username ("mahboob1")
            // as the name and emp_id ("22") below it. Show the actual name
            // up top and username below, matching what "employeeId" reads
            // as everywhere else in this drawer (an identifier line, not
            // literally required to be a numeric id).
            employeeName: user?.name || user?.employee_name || 'You',
            employeeId: user?.username || user?.emp_id || '-',
            // Request Type must be the leave's display name (e.g. "Claim
            // Weekend Work"), not its raw code ("CWW") — leave_name comes
            // straight from LeaveSerializer; leaveTypeMap is the same
            // code -> name lookup this page already uses for every other
            // leave-name display (see displayType below).
            leaveType: viewModalLeave.leave_name || leaveTypeMap[viewModalLeave.leave_type] || viewModalLeave.leave_type || viewModalLeave.type,
            startDate: viewModalLeave.start_date || viewModalLeave.date,
            endDate: viewModalLeave.end_date || viewModalLeave.date,
            // `|| in_days` always kicked in for a Claim (business_days is
            // always 0 for one — see leaves/services.py _create_claim — and
            // 0 is falsy), showing the claimed day count instead of the
            // correct 0 work days.
            bizDays: viewModalLeave.business_days ?? 0,
            // Leave has no `created_at` field — that always fell through to
            // `new Date().toISOString()`, and fmtDate (which expects a bare
            // YYYY-MM-DD string, appending 'T00:00:00' itself) choked on the
            // full ISO datetime string, rendering "Invalid Date". Use the
            // real field (requested_date), date-only.
            requestedOn: viewModalLeave.requested_date ? viewModalLeave.requested_date.split('T')[0] : '',
            status: viewModalLeave.status_code?.toLowerCase().replace('_', '-') || 'pending',
            reason: viewModalLeave.leave_reason || viewModalLeave.reason,
            duration: viewModalLeave.leave_duration || (viewModalLeave.in_days === 0.5 ? 'Half Day' : 'Full Day'),
            fromDateDuration: viewModalLeave.from_date_duration,
            toDateDuration: viewModalLeave.to_date_duration,
            // Needed for the drawer's mod-request-specific rows (Original
            // Dates/Reason/Duration, and the claimDates Removed/Added tags)
            // and for hiding "Team Availability" on a claim — see
            // leavesWithModRequests for where these are set.
            isModRequest: !!viewModalLeave.is_mod_request,
            origStartDate: viewModalLeave.orig_start_date,
            origEndDate: viewModalLeave.orig_end_date,
            origReason: viewModalLeave.orig_leave_reason,
            origDuration: viewModalLeave.orig_duration,
            type: viewModalLeave.leave_category === 'CLAIM' ? 'compoff' : undefined,
            // Grouped multi-date claim submission (see groupClaimLeaves) —
            // lets the drawer list each claimed date individually instead
            // of a misleading single Start/End Date range.
            claimDates: viewModalLeave.claimDates,
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
                setFilterType('all');
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
              <div className="my-leaves-actions" style={{ marginLeft: 'auto' }}>
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
              {/* Balance-backed cards are driven off `leaveBalances[code]`, keyed by
                  the same leave type codes the backend's BalanceService.summary()
                  returns — including is_unlimited. Reading isUnlimited from the API
                  response here, once, per card means flipping a leave type's policy
                  between Limited/Unlimited (Admin Panel > Leave Types and Policy) is
                  reflected automatically without touching this page — no card can be
                  left out and silently render wrong (as WFH's card previously did,
                  since it never passed isUnlimited at all). */}
              {balanceCard(leaveBalances, isLoading, 'AL', 'Leave Quota', '#006633')}
              <LeaveCard
                title="Carry Over"
                variant="simple"
                isLoading={isLoading}
                centerCount={leaveBalances?.AL?.carried_forward ?? 0}
                color="#0891b2"
              />
              {balanceCard(leaveBalances, isLoading, 'CompOff', 'Comp Off', '#8b5cf6')}
              {balanceCard(leaveBalances, isLoading, 'SL', 'Sick Leaves', '#dc2626')}
              {balanceCard(leaveBalances, isLoading, 'WW', 'Weekend Work', '#f59e0b')}
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
              {balanceCard(leaveBalances, isLoading, 'OW', 'Offshore Work', '#6366f1', 'Outside KSA')}
              {balanceCard(leaveBalances, isLoading, 'WFH', 'WFH', '#d97706', 'Inside KSA')}
            </div>

            <div className="leave-content-split-section" style={{ display: 'block' }}>
              <div className="leave-content-left" style={{ width: '100%' }}>
                <div className="leave-filters-section">
                  <div className="leave-filters-row">
                    <div className="leave-filters-container">
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'all' && filterType === 'all'}
                        onClick={() => {
                          setFilterStatus('all');
                          setFilterType('all');
                        }}
                      >
                        <span className="leave-filter-label">All</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'pending'}
                        onClick={() => setFilterStatus('pending')}
                      >
                        <span className="leave-filter-label">Pending</span>
                        {/* Matches the table's own filter below (which
                            normalizes MOD_PENDING -> 'mod-pending', never
                            'pending') — a Mod-Pending row belongs only in
                            the Modification Requests count, not counted
                            here too. */}
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.status_code?.toLowerCase() === 'pending').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'approved'}
                        onClick={() => setFilterStatus('approved')}
                      >
                        <span className="leave-filter-label">Approved</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.status_code?.toLowerCase() === 'approved').length}</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'rejected'}
                        onClick={() => setFilterStatus('rejected')}
                      >
                        <span className="leave-filter-label">Rejected</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.status_code?.toLowerCase() === 'rejected').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'self-rejected'}
                        onClick={() => setFilterStatus('self-rejected')}
                        title={STATUS_TOOLTIPS['self-rejected']}
                      >
                        <span className="leave-filter-label">Self-Rejected</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.status_code?.toLowerCase() === 'self_rejected').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'cancelled'}
                        onClick={() => setFilterStatus('cancelled')}
                        title={STATUS_TOOLTIPS.cancelled}
                      >
                        <span className="leave-filter-label">Cancelled</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.status_code?.toLowerCase() === 'cancelled').length}</span>
                      </button>

                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'mod-pending'}
                        onClick={() => setFilterStatus('mod-pending')}
                      >
                        <span className="leave-filter-label">Modification Requests</span>
                        <span className="leave-filter-badge">{isLoading ? 0 : typeFilteredLeaves.filter(l => l.is_mod_request).length}</span>
                      </button>

                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="my-leaves-search-wrapper" style={{ width: '300px' }}>
                        <Search className="my-leaves-search-icon" size={14} />
                        <input 
                          type="text" 
                          placeholder="Search leaves..." 
                          className="my-leaves-search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
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

                      <ExportButton
                        excel
                        pdf
                        onExcelExport={handleExportCSV}
                        onPdfExport={handleExportPDF}
                      />
                    </div>
                  </div>
                </div>

                {error ? (
                  <ErrorState
                    title="Leave requests could not be loaded"
                    description={error.message}
                    onRetry={() => setRefreshKey((k) => k + 1)}
                  />
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
                        {isLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="leave-table-row">
                              <td className="leave-table-cell"><Skeleton height={20} width="80%" /></td>
                              <td className="leave-table-cell"><Skeleton height={20} width="70%" /></td>
                              <td className="leave-table-cell"><Skeleton height={20} width="40%" /></td>
                              <td className="leave-table-cell"><Skeleton height={20} width="80%" /></td>
                              {filterStatus === 'pending' && <td className="leave-table-cell"><Skeleton height={20} width="60%" /></td>}
                              <td className="leave-table-cell"><Skeleton height={24} width="70%" style={{ borderRadius: '12px' }} /></td>
                              <td className="leave-table-cell"><Skeleton height={20} width="80%" /></td>
                              <td className="leave-table-cell"><Skeleton height={24} width={24} style={{ borderRadius: '4px' }} /></td>
                            </tr>
                          ))
                        ) : filteredSortedLeaves.map((leave) => {
                          const startDate = new Date(leave.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const endDate = new Date(leave.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                          const dateDisplay = leave.start_date === leave.end_date ? startDate : `${startDate} - ${endDate}`;

                          const displayType = leaveTypeMap[leave.leave_type] || leave.leave_type;
                          const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';
                          const durationText = getDurationDisplay(leave);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const startDateObj = new Date(leave.start_date);
                          startDateObj.setHours(0, 0, 0, 0);
                          // Same authoritative signal groupClaimLeaves uses. A
                          // claim's dates come from the claim-eligible-dates
                          // picker, not free-form start/end fields, so "Edit"
                          // opens EditClaimModal (whole-batch edit) instead of
                          // EditLeaveModal for these rows — see below.
                          const isClaimRequest = leave.leave_category === 'CLAIM';

                          // A Claim's start_date is *always* in the past by
                          // design (you're claiming a day you already
                          // worked — see ClaimService.submit_claim's
                          // past-date requirement), so the isPast/
                          // isApprovedPastOrPresent gates below — meant to
                          // stop editing/cancelling an ordinary leave once
                          // it's already underway or over — would otherwise
                          // block Edit/Cancel on every claim unconditionally.
                          // Claims exempt themselves from both checks.
                          const isPast = !isClaimRequest && startDateObj < today;
                          const isApprovedPastOrPresent = !isClaimRequest && statusStr === 'approved' && startDateObj <= today;
                          const canModify = statusStr !== 'cancelled' && statusStr !== 'rejected' && statusStr !== 'self-rejected' && !isApprovedPastOrPresent && !isPast;

                          // Partial cancel: only once the leave has actually started (ongoing) —
                          // before it starts, Edit + full Cancel already cover every case.
                          // Must still have a future-or-today portion left to cancel.
                          const endDateObj = new Date(leave.end_date);
                          endDateObj.setHours(0, 0, 0, 0);
                          const canPartialCancel = statusStr === 'approved'
                            && !leave.is_mod_request
                            && !claimLeaveTypeCodes.has(leave.leave_type)
                            && startDateObj <= today
                            && endDateObj >= today;

                          return (
                            <tr key={leave.id} className="leave-table-row">
                              <td className="leave-table-cell" data-label="Leave Type">
                                {leave.leave_name || displayType}
                              </td>
                              <td className="leave-table-cell" data-label="Dates">
                                {leave.claimDates && leave.claimDates.length > 1 ? (
                                  // Grouped multi-date claim submission — the dates
                                  // aren't a contiguous range (see groupClaimLeaves),
                                  // so list each claimed date with its own duration
                                  // instead of collapsing to a start-end span.
                                  <div className="leave-table-dates">
                                    {leave.claimDates.map((cd) => {
                                      // A grouped Modification Request row (see
                                      // leavesWithModRequests) includes a 0-day entry
                                      // for every date being REMOVED from the claim,
                                      // and — for a brand-new date — one whose ORIGINAL
                                      // in_days was 0 (see _create_claim_mod_request's
                                      // orig_in_days=0 addition marker). Flag both
                                      // instead of showing either as a plain "(N days)"
                                      // that gives no hint the claim is actually
                                      // changing shape.
                                      const isRemoval = leave.is_mod_request && Number(cd.in_days) === 0;
                                      const isAddition = leave.is_mod_request && Number(cd.orig_in_days) === 0 && Number(cd.in_days) > 0;
                                      // A pure duration change (Full Day -> First Half,
                                      // say) on an otherwise unchanged date has neither
                                      // marker above — without this, only the NEW
                                      // duration ever showed, with no hint it changed
                                      // at all.
                                      const durLabel = (d) => (d === 'FIRST_HALF' ? 'First Half' : d === 'SECOND_HALF' ? 'Second Half' : 'Full Day');
                                      const isDurationChange = leave.is_mod_request && !isRemoval && !isAddition
                                        && cd.orig_duration && cd.orig_duration !== cd.duration;
                                      return (
                                        <div
                                          key={cd.id}
                                          className="leave-table-date-text text-[14px]"
                                          style={isRemoval ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}
                                        >
                                          {new Date(cd.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                          {isRemoval ? (
                                            <span className="leave-table-date-duration" style={{ color: 'var(--c-danger)', textDecoration: 'none' }}> (Removed)</span>
                                          ) : (
                                            <span className="leave-table-date-duration">
                                              {' '}({cd.in_days} day{cd.in_days !== 1 ? 's' : ''})
                                              {cd.duration && cd.duration !== 'FULL_DAY' ? ` • ${cd.duration === 'FIRST_HALF' ? 'First Half' : 'Second Half'}` : ''}
                                              {isAddition ? <span style={{ color: 'var(--c-success, #16a34a)' }}> (Added)</span> : ''}
                                              {isDurationChange ? <span style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through' }}> (was {durLabel(cd.orig_duration)})</span> : ''}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="leave-table-dates">
                                    <span className="leave-table-date-text text-[14px]">
                                      {dateDisplay}
                                    </span>
                                    <span className="leave-table-date-duration">
                                      ({leave.in_days} day{leave.in_days !== 1 ? 's' : ''})
                                      {durationText ? ` • ${durationText}` : ''}
                                    </span>
                                  </div>
                                )}
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
                                  <span className="leave-table-status" data-status={statusStr} title={STATUS_TOOLTIPS[statusStr]}>
                                    {statusStr === 'self-rejected' ? 'Self Rejected' : statusStr}
                                  </span>
                                  {statusStr === 'pending' && <RemindManagerButton leave={leave} />}
                                </div>
                              </td>

                              <td className="leave-table-cell" data-label="Comments">
                                <button
                                  className="leave-table-action-button"
                                  style={{ color: '#64748b' }}
                                  title="View Comments"
                                  onClick={() => setCommentsModalText(
                                    leave.comments
                                      || (leave.status_code === 'REJECTED' ? leave.rejected_reason : leave.approval_reason)
                                      || leave.rejected_reason
                                      || leave.approval_reason
                                      || 'No comments available'
                                  )}
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
                                  ) : canModify ? (
                                    <>
                                      {/* A Claim's dates come from the claim-
                                          eligible-dates picker, not free-form
                                          start/end fields — EditLeaveModal
                                          doesn't apply, so a claim row (single
                                          or grouped multi-date) opens
                                          EditClaimModal instead, which edits
                                          the whole batch of sibling Leave
                                          rows. Cancel still applies —
                                          LeaveModifyService.cancel() cascades
                                          to every date in the same submission,
                                          see backend. */}
                                      <button
                                        className="tr-act-btn tr-act-edit"
                                        title="Edit Request"
                                        onClick={() => (isClaimRequest ? setEditModalClaim(leave) : setEditModalLeave(leave))}
                                      >
                                        <Edit className="leave-table-action-icon" />
                                      </button>
                                      <button
                                        className="tr-act-btn tr-act-reject"
                                        title={leave.claimDates && leave.claimDates.length > 1 ? 'Cancel Request (all dates)' : 'Cancel Request'}
                                        onClick={() => setCancelModalLeave(leave)}
                                      >
                                        <X className="leave-table-action-icon" />
                                      </button>
                                      {canPartialCancel && (
                                        <button
                                          className="tr-act-btn tr-act-reject"
                                          title="Partially Cancel Request"
                                          onClick={() => setPartialCancelModalLeave(leave)}
                                        >
                                          <ScissorsLineDashed className="leave-table-action-icon" />
                                        </button>
                                      )}
                                    </>
                                  ) : canPartialCancel ? (
                                    <button
                                      className="tr-act-btn tr-act-reject"
                                      title="Partially Cancel Request"
                                      onClick={() => setPartialCancelModalLeave(leave)}
                                    >
                                      <ScissorsLineDashed className="leave-table-action-icon" />
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', paddingLeft: '4px' }}>
                                      No Modification
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!isLoading && filteredSortedLeaves.length === 0 && (
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
                    dayFlags={calendarDayFlags}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    style={{ border: 'none', boxShadow: 'none', padding: 0 }}
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
            leaveTypeMap={leaveTypeMap}
            isLoading={isLoading}
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
