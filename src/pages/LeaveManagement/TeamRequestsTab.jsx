import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  List,
  CalendarDays,
  Check,
  X,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  Home,
  Anchor,
  Gift,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  FileEdit,
  Ban,
  ArrowUpDown,
  CalendarPlus,
  Globe2,
  CalendarClock,
} from 'lucide-react';
import { useDebounce } from '@hooks/useDebounce';
import { Select } from '@components/forms/Select/Select';
import { ExportButton } from '@components/ui/ExportButton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TimelineCalendar } from '@components/data-display/TimelineCalendar/TimelineCalendar';
import { SortIcon } from './LeaveManagementPage';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import { LEAVE_REQUESTS as INITIAL_REQUESTS } from '@mocks/data/leaveRequests';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import LeaveRequestDrawer from './components/LeaveRequestDrawer';
import { EditLeaveModal } from './EditLeaveModal';
import { CancelLeaveModal } from './CancelLeaveModal';
import './TeamRequests.css';
import { activatable } from '@utils/interactive';
export const AVATAR_COLORS = [
  '#1d4ed8',
  '#065f46',
  '#5b21b6',
  '#92400e',
  '#1e40af',
  '#9a3412',
  '#0e7490',
  '#6d28d9',
];
const PUBLIC_HOLIDAYS = /* @__PURE__ */ new Set([
  '2026-01-01',
  '2026-02-22',
  '2026-03-22',
  '2026-03-23',
  '2026-04-01',
  '2026-04-02',
  '2026-04-03',
  '2026-04-04',
  '2026-04-05',
  '2026-06-29',
  '2026-07-01',
  '2026-09-23',
  '2026-12-25',
]);
const LEAVE_TYPE_OPTIONS = [
  'Annual Leave',
  'Sick Leave',
  'Compensatory Off',
  'Offshore Work',
  'Weekend Work',
  'WFH',
  'Paternity Leave',
  'Visa Purpose',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
export function initials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
export function getPhotoUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith('http') || photo.startsWith('data:image') || photo.startsWith('/')) return photo;
  return `data:image/jpeg;base64,${photo}`;
}
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
export function fmtDate(s) {
  if (!s) return '\u2014';
  return /* @__PURE__ */ new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
export function fmtShort(s) {
  if (!s) return '\u2014';
  return /* @__PURE__ */ new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}
function fmtFullDate(s) {
  if (!s) return '\u2014';
  const d = new Date(s + 'T00:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}
export function eachDay(s, e) {
  const days = [];
  const cur = /* @__PURE__ */ new Date(s + 'T00:00:00'),
    end = /* @__PURE__ */ new Date(e + 'T00:00:00');
  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function isSaudiWeekend(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + 'T00:00:00').getDay();
  return d === 5 || d === 6;
}

export function getRelativePendingTime(isoString) {
  if (!isoString) return '-';
  const requestedDate = new Date(isoString);
  if (isNaN(requestedDate.getTime())) return '-';

  const now = new Date();
  const diffMs = now - requestedDate;
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return remainingHours > 0
      ? `${diffDays} day${diffDays !== 1 ? 's' : ''} ${remainingHours} hr${remainingHours !== 1 ? 's' : ''}`
      : `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return remainingMins > 0
      ? `${diffHours} hr${diffHours !== 1 ? 's' : ''} ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`
      : `${diffHours} hr${diffHours !== 1 ? 's' : ''}`;
  } else if (diffMins > 0) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  } else {
    return 'Just now';
  }
}

export function getDurationDisplay(req) {
  const formatDurationStr = (duration) => {
    if (!duration) return '';
    const map = {
      'FULL_DAY': 'Full Day',
      'FIRST_HALF': 'First Half',
      'SECOND_HALF': 'Second Half',
      'full': 'Full Day',
      'morning': 'First Half',
      'afternoon': 'Second Half',
      'full_day': 'Full Day'
    };
    return map[duration] || duration;
  };

  if (req.fromDateDuration || req.toDateDuration) {
    const fromStr = formatDurationStr(req.fromDateDuration);
    const toStr = formatDurationStr(req.toDateDuration);
    if (fromStr && toStr) {
      return `${fromStr} to ${toStr}`;
    } else if (fromStr) {
      return fromStr;
    } else if (toStr) {
      return toStr;
    }
  }
  return formatDurationStr(req.duration);
}

export const TYPE_CONFIG = {
  leave: { label: 'Leave', css: 'tr-type-leave', Icon: Briefcase },
  wfh: { label: 'WFH', css: 'tr-type-wfh', Icon: Home },
  offshore: { label: 'Offshore Work', css: 'tr-type-offshore', Icon: Anchor },
  compoff: { label: 'Comp-off', css: 'tr-type-compoff', Icon: Gift },
};

import { leaveService } from '@services/leaveService';
import { Loader } from '@components/feedback/Loader/Loader';



export async function fetchAndMapTeamLeaves(managerId) {
  const response = await leaveService.getTeamLeaves(managerId);
  const results = Array.isArray(response) ? response : (response?.results || []);

  return results.map(req => {
    let type = 'leave';
    const reasonLower = (req.leave_reason || '').toLowerCase();
    const typeLower = (req.leave_type || '').toLowerCase();

    if (typeLower.includes('wfh') || reasonLower.includes('wfh')) type = 'wfh';
    else if (typeLower.includes('offshore') || reasonLower.includes('offshore')) type = 'offshore';
    else if (typeLower.includes('comp') || reasonLower.includes('comp')) type = 'compoff';

    return {
      id: req.id.toString(),
      employeeId: `EMP${req.emp_id}`,
      employeeName: req.emp_name,
      photo: req.photo,
      team: req.team_name,
      type: type,
      leaveType: req.leave_name || req.leave_type,
      startDate: req.start_date,
      endDate: req.end_date,
      duration: req.leave_duration === 'FULL_DAY' ? 'full' : req.leave_duration === 'FIRST_HALF' ? 'morning' : req.leave_duration === 'SECOND_HALF' ? 'afternoon' : req.leave_duration === 'full_day' ? 'full' : req.leave_duration,
      // Multi-day partial-day boundaries — set only when start_date !==
      // end_date; kept as raw API enum values (FULL_DAY/FIRST_HALF/
      // SECOND_HALF) for the drawer's label mapping to consume.
      fromDateDuration: req.from_date_duration,
      toDateDuration: req.to_date_duration,
      inDays: req.in_days,
      bizDays: req.business_days,
      requestedOn: req.requested_date ? req.requested_date.split('T')[0] : '',
      requestedAt: req.requested_date || '',
      status: req.status ? req.status.toLowerCase() : 'pending',
      priority: 'normal',
      manager: req.manager_name,
      designation: req.designation,
      reason: req.leave_reason,
      // Set only when the employee exceeded a Flexible-mode entitlement and
      // supplied a reason for it — distinct from the normal leave_reason.
      justification: req.justification || null,
      balance: null, // As discussed, real backend does not have this currently
      conflicts: [], // As discussed
      // Original endpoints if needed:
      approve_endpoint: req.approve_endpoint,
      reject_endpoint: req.reject_endpoint,
      // Untouched backend leave object — EditLeaveModal/CancelLeaveModal
      // expect real field names (emp_id, leave_type, start_date, ...),
      // not this row's camelCase display shape, so keep it around for
      // when a manager opens either modal on-behalf from this table.
      raw: req,
    };
  });
}

// Modification requests (PUT /me/leaves/<id>/modify/ on an already-APPROVED
// leave) sit in a separate backend table (LeaveModificationRequest) with its
// own approve/reject endpoints — they never show up in getTeamLeaves(). This
// maps them into the same row shape the table/drawer already render, so they
// appear in "Team Leave Requests" alongside ordinary pending leave requests.
export async function fetchAndMapModRequests(managerId, employeeDirectory = {}) {
  const response = await leaveService.getPendingModRequests(managerId);
  const results = Array.isArray(response) ? response : (response?.results || []);

  return results.map((req) => {
    const dir = employeeDirectory[req.emp_id];
    return {
      id: `mod-${req.id}`,
      modRequestId: req.id,
      leaveId: req.leave_id,
      isModRequest: true,
      employeeId: `EMP${req.emp_id}`,
      employeeName: dir?.employeeName || `Employee #${req.emp_id}`,
      team: dir?.team || '—',
      designation: dir?.designation,
      manager: dir?.manager,
      type: dir?.type || 'leave',
      leaveType: 'Modification Request',
      startDate: req.new_start_date,
      endDate: req.new_end_date,
      origStartDate: req.orig_start_date,
      origEndDate: req.orig_end_date,
      duration: req.new_duration === 'FIRST_HALF' ? 'morning' : req.new_duration === 'SECOND_HALF' ? 'afternoon' : 'full',
      fromDateDuration: req.from_date_duration,
      toDateDuration: req.to_date_duration,
      inDays: req.new_in_days,
      bizDays: req.new_business_days,
      requestedOn: req.created_at ? req.created_at.split('T')[0] : '',
      requestedAt: req.created_at || '',
      status: (req.status || 'pending').toLowerCase(),
      priority: 'normal',
      reason: req.modification_reason || req.new_leave_reason,
      origReason: req.orig_leave_reason,
      justification: req.justification || null,
      balance: null,
      conflicts: [],
    };
  });
}

export function TeamRequestsTab({ getPhoto }) {
  const toast = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editModalLeave, setEditModalLeave] = useState(null);
  const [cancelModalLeave, setCancelModalLeave] = useState(null);

  const refetch = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const managerId = user?.emp_id || user?.id || 1;
      const mappedLeaves = await fetchAndMapTeamLeaves(managerId);

      // Build a quick emp_id -> {employeeName, team, ...} lookup from the
      // leave requests we already have names for, so modification-request
      // rows (which the backend returns with no employee name/team) can
      // still display something meaningful instead of just an emp_id.
      const employeeDirectory = {};
      mappedLeaves.forEach((r) => {
        const empId = Number(String(r.employeeId).replace('EMP', ''));
        if (!employeeDirectory[empId]) {
          employeeDirectory[empId] = {
            employeeName: r.employeeName, team: r.team,
            designation: r.designation, manager: r.manager, type: r.type,
          };
        }
      });

      const mappedModRequests = await fetchAndMapModRequests(managerId, employeeDirectory)
        .catch((error) => {
          console.error('Failed to fetch modification requests:', error);
          return [];
        });

      const combined = [...mappedLeaves, ...mappedModRequests];
      setRequests(combined);
    } catch (error) {
      console.error("Failed to fetch team leaves:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.emp_id, user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const mergedRequests = useMemo(() => {
    if (!getPhoto) return requests;
    return requests.map(r => {
      const empId = String(r.employeeId).replace('EMP', '');
      const photo = getPhoto(empId);
      if (photo && photo !== r.photo) {
        return { ...r, photo };
      }
      return r;
    });
  }, [requests, getPhoto]);

  const [innerTab, setInnerTab] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [statusF, setStatusF] = useState('all');
  const [typeF, setTypeF] = useState('all');
  const [leaveTypeF, setLeaveTypeF] = useState('all');
  const [sortBy, setSortBy] = useState('requestedOn');
  const [tableSortField, setTableSortField] = useState(null);
  const [tableSortOrder, setTableSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('list');
  const today = /* @__PURE__ */ new Date();
  const [sdlYear, setSdlYear] = useState(today.getFullYear());
  const [sdlMonth, setSdlMonth] = useState(today.getMonth());
  const [sdlSelected, setSdlSelected] = useState(todayStr());
  const [sdlSearch, setSdlSearch] = useState('');
  const debouncedSdlSearch = useDebounce(sdlSearch, 500);
  const [sdlLeaveTF, setSdlLeaveTF] = useState('all');
  const [sdlTeam, setSdlTeam] = useState('all');
  const [sdlStatus, setSdlStatus] = useState('all');
  const [sdlSortBy, setSdlSortBy] = useState('name');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReq, setDrawerReq] = useState(null);
  const [drawerAction, setDrawerAction] = useState('view');
  const [managerNote, setManagerNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [rejectErr, setRejectErr] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected' || r.status === 'self_rejected').length,
      leave: requests.filter((r) => r.type === 'leave').length,
      wfh: requests.filter((r) => r.type === 'wfh').length,
      offshore: requests.filter((r) => r.type === 'offshore').length,
      compoff: requests.filter((r) => r.type === 'compoff').length,
      pendLeave: requests.filter((r) => r.status === 'pending' && r.type === 'leave' && !r.isModRequest).length,
      pendWfh: requests.filter((r) => r.status === 'pending' && r.type === 'wfh' && !r.isModRequest).length,
      pendOffshore: requests.filter((r) => r.status === 'pending' && r.type === 'offshore' && !r.isModRequest).length,
      pendCompoff: requests.filter((r) => r.status === 'pending' && r.type === 'compoff' && !r.isModRequest).length,
      pendModifications: requests.filter((r) => r.status === 'pending' && r.isModRequest).length,
    }),
    [requests],
  );
  const leaveDates = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    requests.forEach((r) => eachDay(r.startDate, r.endDate).forEach((d) => set.add(d)));
    return set;
  }, [requests]);
  const sdlDayCount = useMemo(() => leaveDates.size, [leaveDates]);
  const sdlTeams = useMemo(() => [...new Set(mergedRequests.map((r) => r.team))].sort(), [mergedRequests]);
  const sdlEmployees = useMemo(() => {
    let list = mergedRequests.filter((r) => eachDay(r.startDate, r.endDate).includes(sdlSelected));
    if (sdlLeaveTF !== 'all')
      list = list.filter(
        (r) =>
          (r.leaveType ?? '') === sdlLeaveTF ||
          (r.type === 'offshore' && sdlLeaveTF === 'Offshore Work'),
      );
    if (sdlTeam !== 'all') list = list.filter((r) => r.team === sdlTeam);
    if (sdlStatus !== 'all') list = list.filter((r) => r.status === sdlStatus);
    const q = debouncedSdlSearch.toLowerCase().trim();
    if (q)
      list = list.filter(
        (r) => r.employeeName.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q),
      );
    return [...list].sort((a, b) => {
      if (sdlSortBy === 'status') return a.status.localeCompare(b.status);
      if (sdlSortBy === 'type') return (a.leaveType ?? a.type).localeCompare(b.leaveType ?? b.type);
      if (sdlSortBy === 'team') return a.team.localeCompare(b.team);
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [mergedRequests, sdlSelected, sdlLeaveTF, sdlTeam, sdlStatus, debouncedSdlSearch, sdlSortBy]);
  function sdlPrevMonth() {
    if (sdlMonth === 0) {
      setSdlMonth(11);
      setSdlYear((y) => y - 1);
    } else setSdlMonth((m) => m - 1);
  }
  function sdlNextMonth() {
    if (sdlMonth === 11) {
      setSdlMonth(0);
      setSdlYear((y) => y + 1);
    } else setSdlMonth((m) => m + 1);
  }
  const filtered = useMemo(() => {
    let list = mergedRequests;
    const q = debouncedSearch.toLowerCase().trim();
    if (q)
      list = list.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    if (statusF !== 'all') {
      if (statusF === 'rejected') list = list.filter((r) => r.status === 'rejected' || r.status === 'self_rejected');
      else list = list.filter((r) => r.status === statusF);
    }
    if (typeF === 'modification') list = list.filter((r) => r.isModRequest);
    else if (typeF !== 'all') list = list.filter((r) => r.type === typeF);
    if (leaveTypeF !== 'all')
      list = list.filter(
        (r) =>
          (r.leaveType ?? '') === leaveTypeF ||
          (r.type === 'offshore' && leaveTypeF === 'Offshore Work'),
      );
    return [...list].sort((a, b) => {
      if (tableSortField) {
        let aVal = a[tableSortField];
        let bVal = b[tableSortField];

        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        const result = aVal > bVal ? 1 : -1;
        return tableSortOrder === 'asc' ? result : -result;
      }

      if (sortBy === 'oldestFirst') return a.requestedOn.localeCompare(b.requestedOn);
      if (sortBy === 'startDate') return a.startDate.localeCompare(b.startDate);
      if (sortBy === 'endDate') return a.endDate.localeCompare(b.endDate);
      return b.requestedOn.localeCompare(a.requestedOn);
    });
  }, [requests, debouncedSearch, statusF, typeF, leaveTypeF, sortBy, tableSortField, tableSortOrder]);

  const handleTableSort = (field) => {
    if (tableSortField === field) {
      setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortOrder('asc');
    }
  };

  function openDrawer(req, action) {
    setDrawerReq(req);
    setDrawerAction(action);
    setManagerNote('');
    setRejectErr(false);
    setShowConfirm(false);
    requestAnimationFrame(() => setDrawerOpen(true));
  }
  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerReq(null);
      setShowConfirm(false);
    }, 240);
  }
  async function handleApprove() {
    if (!drawerReq || isSubmittingAction) return;
    try {
      setIsSubmittingAction(true);
      if (drawerReq.isModRequest) {
        // Modification requests use their own approve endpoint (mod_id, not
        // leave_id) and only take a "comment" field — approving applies the
        // new dates/reason to the underlying leave and auto-approves it.
        await leaveService.approveModRequest(drawerReq.modRequestId, {
          comment: managerNote || 'Approved',
        });
      } else {
        const payload = {
          manager_id: user?.emp_id || user?.id || 1,
          reason: managerNote || 'Approved'
        };
        await leaveService.approveLeave(drawerReq.id, payload);
      }
      setShowConfirm(false);
      setRequests((prev) =>
        prev.map((r) => (r.id === drawerReq.id ? { ...r, status: 'approved' } : r)),
      );
      toast.success('Request approved successfully');
      closeDrawer();
    } catch (error) {
      console.error('Approval failed:', error);
      const msg = error.response?.data?.message || error.response?.data?.error || 'Failed to approve request';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleReject() {
    if (!drawerReq || isSubmittingAction) return;
    if (!managerNote.trim()) {
      setRejectErr(true);
      return;
    }
    try {
      setIsSubmittingAction(true);
      if (drawerReq.isModRequest) {
        // Rejecting a modification request leaves the underlying leave
        // completely unchanged — only the request itself is marked rejected.
        await leaveService.rejectModRequest(drawerReq.modRequestId, {
          comment: managerNote,
        });
      } else {
        const payload = {
          manager_id: user?.emp_id || user?.id || 1,
          reason: managerNote
        };
        await leaveService.rejectLeave(drawerReq.id, payload);
      }
      setShowConfirm(false);
      setRequests((prev) =>
        prev.map((r) => (r.id === drawerReq.id ? { ...r, status: 'rejected' } : r)),
      );
      toast.success('Request rejected successfully');
      closeDrawer();
    } catch (error) {
      console.error('Rejection failed:', error);
      const msg = error.response?.data?.message || error.response?.data?.error || 'Failed to reject request';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingAction(false);
    }
  }
  function handleKpiClick(type) {
    setTypeF((prev) => (prev === type ? 'all' : type));
    setStatusF('pending');
  }
  const teamAvailability = useMemo(() => {
    if (!drawerReq) return null;
    const range = new Set(eachDay(drawerReq.startDate, drawerReq.endDate));
    const others = requests.filter(
      (r) =>
        r.id !== drawerReq.id &&
        r.status !== 'rejected' &&
        eachDay(r.startDate, r.endDate).some((d) => range.has(d)),
    );
    return {
      total: others.length,
      onLeave: others.filter((r) => r.type === 'leave').length,
      onWfh: others.filter((r) => r.type === 'wfh').length,
      onOffshore: others.filter((r) => r.type === 'offshore').length,
      onCompoff: others.filter((r) => r.type === 'compoff').length,
      others,
    };
  }, [drawerReq, requests]);
  function balPct(r) {
    if (!r.balance) return 100;
    return r.balance.available > 0
      ? (Math.max(0, r.balance.available - r.balance.used) / r.balance.available) * 100
      : 0;
  }
  function balClass(r) {
    const p = balPct(r);
    return p <= 10 ? 'danger' : p <= 30 ? 'warn' : '';
  }
  const liveReq = drawerReq ? (requests.find((r) => r.id === drawerReq.id) ?? drawerReq) : null;
  const calEvents = useMemo(
    () =>
      filtered.map((r) => ({
        date: /* @__PURE__ */ new Date(r.startDate + 'T00:00:00').getDate(),
        title: r.employeeName,
        type: 'leave',
        status: 'approved',
      })),
    [filtered],
  );

  const pendingDateRangeText = useMemo(() => {
    const pendingLeaves = requests.filter(l => l.status === 'pending');
    if (pendingLeaves.length === 0) return null;

    let minDate = new Date(8640000000000000);
    let maxDate = new Date(-8640000000000000);
    let hasValidDates = false;

    pendingLeaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate || leave.startDate);

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
  }, [requests]);

  const handleExportCSV = () => {
    const headers = ['Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'];
    const rows = filtered.map(req => [
      req.employeeName || '',
      req.leaveType || '',
      req.startDate || '',
      req.endDate || '',
      req.bizDays || 0,
      req.status || '',
      req.reason || ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests');
    XLSX.writeFile(workbook, 'team_requests.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const headers = ['Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'];
    const body = filtered.map(req => [
      req.employeeName || '',
      req.leaveType || '',
      req.startDate || '',
      req.endDate || '',
      req.bizDays || 0,
      req.status || '',
      req.reason || ''
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 78, 216] }
    });

    doc.save('team_requests.pdf');
  };

  return (
    <div className="tr-workspace">
      {/* ── Inner Sub-tabs ────────────────────────────────────────────────────── */}
      <div className="tr-subtab-bar">
        <button
          className="tr-subtab"
          data-active={innerTab === 'all'}
          onClick={() => setInnerTab('all')}
        >
          All Requests<span className="tr-subtab-badge">{isLoading ? 0 : counts.all}</span>
        </button>
        <button
          className="tr-subtab"
          data-active={innerTab === 'sameday'}
          onClick={() => setInnerTab('sameday')}
        >
          Requests by dates
        </button>
        <div className="tr-subtab-indicator" data-tab={innerTab} />
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
      {innerTab === 'all' && (
        <div className="tr-kpi-strip">
          {[
            {
              type: 'leave',
              label: 'Pending Leave',
              count: counts.pendLeave,
              color: '#1d4ed8',
              bg: '#dbeafe',
              Icon: CalendarClock,
            },
            {
              type: 'wfh',
              label: 'Pending WFH',
              count: counts.pendWfh,
              color: '#065f46',
              bg: '#d1fae5',
              Icon: Home,
            },
            {
              type: 'offshore',
              label: 'Pending Offshore Work',
              count: counts.pendOffshore,
              color: '#5b21b6',
              bg: '#ede9fe',
              Icon: Globe2,
            },
            {
              type: 'compoff',
              label: 'Pending Comp-off / WW',
              count: counts.pendCompoff,
              color: '#92400e',
              bg: '#fef3c7',
              Icon: CalendarPlus,
            },
            {
              type: 'modification',
              label: 'Pending Modifications',
              count: counts.pendModifications,
              color: '#be123c',
              bg: '#ffe4e6',
              Icon: FileEdit,
            },
          ].map(({ type, label, count, color, bg, Icon }) => (
            <div
              key={type}
              className="tr-kpi-card"
              data-active={typeF === type && statusF === 'pending'}
              {...activatable(() => handleKpiClick(type), {
                isPressed: typeF === type && statusF === 'pending',
              })}
            >
              <div className="tr-kpi-icon-wrap" style={{ background: bg }}>
                <Icon size={16} color={color} />
              </div>
              <div className="tr-kpi-body">
                <div className="tr-kpi-count">{isLoading ? 0 : count}</div>
                <div className="tr-kpi-label">{label}</div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── All Requests: compact toolbar + status pills ─────────────────────── */}
      {innerTab === 'all' && (
        <>
          {/* Compact toolbar */}
          <div className="tr-all-toolbar">
            <div className="tr-all-toolbar-left">
              <div className="tr-search-wrap" style={{ maxWidth: 240 }}>
                <Search className="tr-search-icon" />
                <input
                  className="tr-search"
                  placeholder="Search requests…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={leaveTypeF}
                onChange={setLeaveTypeF}
                options={[
                  { value: 'all', label: 'All Leave Types' },
                  ...LEAVE_TYPE_OPTIONS.map((lt) => ({ value: lt, label: lt })),
                ]}
                width="leaveType"
              />
              <Select
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'requestedOn', label: 'Newest First' },
                  { value: 'oldestFirst', label: 'Oldest First' },
                  { value: 'startDate', label: 'Start Date' },
                  { value: 'endDate', label: 'End Date' },
                ]}
                width="sort"
              />
            </div>
            <div className="tr-all-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="tr-view-toggle">
                <button
                  className="tr-view-btn"
                  data-active={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <List size={14} />
                </button>
                <button
                  className="tr-view-btn"
                  data-active={viewMode === 'calendar'}
                  onClick={() => setViewMode('calendar')}
                  title="Calendar view"
                >
                  <CalendarDays size={14} />
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

          {/* Status pills */}
          <div className="tr-chip-bar">
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'approved', label: 'Approved', count: counts.approved },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
            ].map((c) => (
              <button
                key={c.key}
                className="tr-chip"
                data-active={statusF === c.key}
                onClick={() => setStatusF(c.key)}
              >
                {c.label}
                <span className="tr-chip-count">{c.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="tr-content">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
            <Loader message="Loading team requests..." />
          </div>
        ) : (
          <>
            {/* ── All Requests ─────────────────────────────────────────────────── */}
            {innerTab === 'all' &&
              (viewMode === 'list' ? (
                <div className="tr-table-wrap">
                  <table className="tr-table">
                    <thead className="tr-thead">
                      <tr className="tr-tr">
                        <th className="tr-th" onClick={() => handleTableSort('employeeName')} style={{ width: statusF === 'pending' ? '20%' : '24%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>CONSULTANT <SortIcon field="employeeName" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        <th className="tr-th" onClick={() => handleTableSort('leaveType')} style={{ width: statusF === 'pending' ? '14%' : '15%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>LEAVE TYPE <SortIcon field="leaveType" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        <th className="tr-th" onClick={() => handleTableSort('startDate')} style={{ width: statusF === 'pending' ? '20%' : '23%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>DATES <SortIcon field="startDate" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        <th className="tr-th" onClick={() => handleTableSort('bizDays')} style={{ width: statusF === 'pending' ? '8%' : '9%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>WORK DAYS <SortIcon field="bizDays" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        <th className="tr-th" onClick={() => handleTableSort('requestedOn')} style={{ width: statusF === 'pending' ? '10%' : '9%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>APPLIED ON <SortIcon field="requestedOn" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        <th className="tr-th" onClick={() => handleTableSort('status')} style={{ width: '10%', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>STATUS <SortIcon field="status" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                        </th>
                        {statusF === 'pending' && (
                          <th className="tr-th" onClick={() => handleTableSort('requestedAt')} style={{ width: '10%', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>PENDING SINCE <SortIcon field="requestedAt" sortField={tableSortField} sortOrder={tableSortOrder} /></div>
                          </th>
                        )}
                        <th className="tr-th" style={{ width: statusF === 'pending' ? '8%' : '10%' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={statusF === 'pending' ? 8 : 7}>
                            <div className="tr-empty">
                              <CheckCircle2 size={32} className="tr-empty-icon" />
                              <p className="tr-empty-text">No requests match the current filters.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((req) => {
                          const TC = TYPE_CONFIG[req.type];
                          return (
                            <tr key={req.id} className="tr-row" data-selected={liveReq?.id === req.id}>
                              <td className="tr-td">
                                <div className="tr-consultant-cell">
                                  <div
                                    className="tr-avatar"
                                    style={req.photo ? {} : { background: avatarColor(req.employeeName) }}
                                  >
                                    {req.photo ? (
                                      <img
                                        src={getPhotoUrl(req.photo)}
                                        alt={req.employeeName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                      />
                                    ) : null}
                                    <div style={{ display: req.photo ? 'none' : 'block' }}>
                                      {initials(req.employeeName)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="tr-con-name">{req.employeeName}</div>
                                    <div className="tr-con-sub">
                                      {req.team}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="tr-td">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                    {req.leaveType ?? TC.label}
                                  </span>
                                  {req.priority === 'high' && (
                                    <span className="tr-priority-high">
                                      <AlertTriangle size={8} />
                                      High
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="tr-td">
                                <div className="tr-dates-cell">
                                  <span className="tr-date-range">
                                    {req.startDate === req.endDate
                                      ? fmtFullDate(req.startDate)
                                      : `${fmtFullDate(req.startDate)} - ${fmtFullDate(req.endDate)}`}
                                  </span>
                                  <span className="tr-date-subtext">
                                    ({req.inDays} {req.inDays === 1 ? 'day' : 'days'})
                                    {getDurationDisplay(req) ? ` • ${getDurationDisplay(req)}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td className="tr-td" style={{ fontWeight: 600 }}>
                                {req.bizDays}d
                              </td>
                              <td
                                className="tr-td"
                                style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}
                              >
                                {req.requestedAt ? (
                                  <span title={req.requestedAt}>
                                    {new Date(req.requestedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    , {new Date(req.requestedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="tr-td">
                                <span className={`tr-status-badge tr-status-${req.status}`}>
                                  {req.status === 'pending' && <Clock size={9} />}
                                  {req.status === 'approved' && <CheckCircle2 size={9} />}
                                  {req.status === 'rejected' && <XCircle size={9} />}
                                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                </span>
                              </td>
                              {statusF === 'pending' && (
                                <td className="tr-td" style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                                  {req.status === 'pending' ? getRelativePendingTime(req.requestedAt) : '-'}
                                </td>
                              )}
                              <td className="tr-td">
                                <div className="tr-actions">
                                  {req.status === 'pending' && (
                                    <>
                                      <button
                                        className="tr-act-btn tr-act-approve"
                                        title="Approve"
                                        onClick={() => openDrawer(req, 'approve')}
                                      >
                                        <Check size={10} />
                                      </button>
                                      <button
                                        className="tr-act-btn tr-act-reject"
                                        title="Reject"
                                        onClick={() => openDrawer(req, 'reject')}
                                      >
                                        <X size={10} />
                                      </button>
                                    </>
                                  )}
                                  {!req.isModRequest && (req.status === 'pending' || req.status === 'approved') && (
                                    <>
                                      <button
                                        className="tr-act-btn"
                                        title="Edit on behalf"
                                        onClick={() => setEditModalLeave(req.raw)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>
                                      </button>
                                      <button
                                        className="tr-act-btn"
                                        title="Cancel on behalf"
                                        onClick={() => setCancelModalLeave(req.raw)}
                                      >
                                        <Ban size={10} />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    className="tr-act-btn"
                                    title="View"
                                    onClick={() => openDrawer(req, 'view')}
                                  >
                                    <Eye size={10} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="tr-calendar-wrap">
                  <LeaveCalendar
                    year={calYear}
                    month={calMonth}
                    events={calEvents}
                    onPrevMonth={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear((y) => y - 1);
                      } else setCalMonth((m) => m - 1);
                    }}
                    onNextMonth={() => {
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear((y) => y + 1);
                      } else setCalMonth((m) => m + 1);
                    }}
                  />
                </div>
              ))}

            {/* ── Same Day Leave ───────────────────────────────────────────────── */}
            {innerTab === 'sameday' && (
              <div className="tr-sdl-page">
                {/* Enterprise Timeline Calendar */}
                <TimelineCalendar
                  year={sdlYear}
                  month={sdlMonth}
                  selectedDate={sdlSelected}
                  onSelectDate={setSdlSelected}
                  onPrevMonth={sdlPrevMonth}
                  onNextMonth={sdlNextMonth}
                  leaveDates={leaveDates}
                  holidays={PUBLIC_HOLIDAYS}
                />

                {/* SDL Filters */}
                <div className="tr-sdl-filters">
                  <div className="tr-search-wrap" style={{ maxWidth: 220 }}>
                    <Search className="tr-search-icon" />
                    <input
                      className="tr-search"
                      placeholder="Search employee…"
                      value={sdlSearch}
                      onChange={(e) => setSdlSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={sdlLeaveTF}
                    onChange={setSdlLeaveTF}
                    options={[
                      { value: 'all', label: 'All Leave Types' },
                      ...LEAVE_TYPE_OPTIONS.map((lt) => ({ value: lt, label: lt })),
                    ]}
                    width="leaveType"
                  />
                  <Select
                    value={sdlTeam}
                    onChange={setSdlTeam}
                    options={[
                      { value: 'all', label: 'All Teams' },
                      ...sdlTeams.map((t) => ({ value: t, label: t })),
                    ]}
                    width="team"
                  />
                  <Select
                    value={sdlStatus}
                    onChange={(v) => setSdlStatus(v)}
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'approved', label: 'Approved' },
                      { value: 'rejected', label: 'Rejected' },
                    ]}
                    width="status"
                  />
                  <Select
                    value={sdlSortBy}
                    onChange={setSdlSortBy}
                    options={[
                      { value: 'name', label: 'Sort: Name' },
                      { value: 'team', label: 'Sort: Team' },
                      { value: 'type', label: 'Sort: Type' },
                      { value: 'status', label: 'Sort: Status' },
                    ]}
                    width="sort"
                  />
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span
                      style={{
                        fontFamily: 'var(--font-family)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>{sdlEmployees.length}</strong> on
                      leave · {fmtDate(sdlSelected)}
                    </span>
                  </div>
                </div>

                {/* Employee list */}
                <div className="tr-sdl-list">
                  {sdlEmployees.length === 0 ? (
                    <div className="tr-sdl-empty">
                      <CheckCircle2
                        size={36}
                        style={{ color: 'var(--text-tertiary)', marginBottom: 10 }}
                      />
                      <p
                        style={{
                          fontFamily: 'var(--font-family)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          margin: 0,
                        }}
                      >
                        No team members are on leave for this date.
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-family)',
                          fontSize: 11.5,
                          color: 'var(--text-tertiary)',
                          margin: '4px 0 0',
                        }}
                      >
                        Full team is available on {fmtDate(sdlSelected)}.
                      </p>
                    </div>
                  ) : (
                    sdlEmployees.map((req) => {
                      const TC = TYPE_CONFIG[req.type];
                      return (
                        <div
                          key={req.id}
                          className="tr-sdl-emp-row"
                          data-selected={liveReq?.id === req.id}
                        >
                          {/* Avatar */}
                          <div
                            className="tr-avatar tr-sdl-emp-avatar"
                            style={req.photo ? {} : { background: avatarColor(req.employeeName) }}
                          >
                            {req.photo ? (
                              <img
                                src={getPhotoUrl(req.photo)}
                                alt={req.employeeName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                              />
                            ) : null}
                            <div style={{ display: req.photo ? 'none' : 'block' }}>
                              {initials(req.employeeName)}
                            </div>
                          </div>

                          {/* Identity */}
                          <div className="tr-sdl-emp-identity">
                            <div className="tr-con-name">{req.employeeName}</div>
                            <div className="tr-con-sub">
                              {req.team} · {req.designation}
                            </div>
                          </div>

                          {/* Leave type */}
                          <div className="tr-sdl-emp-type">
                            <span className={`tr-type-badge ${TC.css}`}>
                              <TC.Icon size={10} />
                              {req.leaveType ?? TC.label}
                            </span>
                          </div>

                          {/* Duration */}
                          <div className="tr-sdl-emp-dur">
                            <span
                              style={{
                                fontFamily: 'var(--font-family)',
                                fontSize: 11.5,
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                              }}
                            >
                              {req.duration === 'full'
                                ? 'Full Day'
                                : req.duration === 'morning'
                                  ? 'First Half'
                                  : 'Second Half'}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-family)',
                                fontSize: 10.5,
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              {req.bizDays}d
                            </span>
                          </div>

                          {/* Dates */}
                          <div className="tr-sdl-emp-dates">
                            <span
                              style={{
                                fontFamily: 'var(--font-family)',
                                fontSize: 11.5,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {fmtShort(req.startDate)}
                            </span>
                            {req.startDate !== req.endDate && (
                              <span
                                style={{
                                  fontFamily: 'var(--font-family)',
                                  fontSize: 10.5,
                                  color: 'var(--text-tertiary)',
                                }}
                              >
                                → {fmtShort(req.endDate)}
                              </span>
                            )}
                          </div>

                          {/* Status */}
                          <span className={`tr-status-badge tr-status-${req.status}`}>
                            {req.status === 'pending' && <Clock size={9} />}
                            {req.status === 'approved' && <CheckCircle2 size={9} />}
                            {req.status === 'rejected' && <XCircle size={9} />}
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>

                          {/* Actions */}
                          <div className="tr-actions">
                            {req.status === 'pending' && (
                              <>
                                <button
                                  className="tr-act-btn tr-act-approve"
                                  title="Approve"
                                  onClick={() => openDrawer(req, 'approve')}
                                >
                                  <Check size={10} />
                                </button>
                                <button
                                  className="tr-act-btn tr-act-reject"
                                  title="Reject"
                                  onClick={() => openDrawer(req, 'reject')}
                                >
                                  <X size={10} />
                                </button>
                              </>
                            )}
                            {!req.isModRequest && (req.status === 'pending' || req.status === 'approved') && (
                              <>
                                <button
                                  className="tr-act-btn"
                                  title="Edit on behalf"
                                  onClick={() => setEditModalLeave(req.raw)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>
                                </button>
                                <button
                                  className="tr-act-btn"
                                  title="Cancel on behalf"
                                  onClick={() => setCancelModalLeave(req.raw)}
                                >
                                  <Ban size={10} />
                                </button>
                              </>
                            )}
                            <button
                              className="tr-act-btn tr-act-view"
                              title="View"
                              onClick={() => openDrawer(req, 'view')}
                            >
                              <Eye size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Review Drawer ─────────────────────────────────────────────────────── */}
      <LeaveRequestDrawer
        open={drawerOpen}
        liveReq={liveReq}
        drawerAction={drawerAction}
        teamAvailability={teamAvailability}
        managerNote={managerNote}
        setManagerNote={setManagerNote}
        rejectErr={rejectErr}
        setRejectErr={setRejectErr}
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        isSubmittingAction={isSubmittingAction}
        onClose={closeDrawer}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* ── Edit / Cancel on behalf ────────────────────────────────────────────── */}
      {editModalLeave && (
        <EditLeaveModal
          leave={editModalLeave}
          onClose={() => setEditModalLeave(null)}
          onSuccess={() => {
            setEditModalLeave(null);
            refetch();
          }}
        />
      )}
      {cancelModalLeave && (
        <CancelLeaveModal
          leave={cancelModalLeave}
          onClose={() => setCancelModalLeave(null)}
          onSuccess={() => {
            setCancelModalLeave(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default TeamRequestsTab;
