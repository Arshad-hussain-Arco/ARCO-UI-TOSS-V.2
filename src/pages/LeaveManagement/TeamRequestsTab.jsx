import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  List,
  CalendarDays,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
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
} from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { TimelineCalendar } from '@components/data-display/TimelineCalendar/TimelineCalendar';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import { LEAVE_REQUESTS as INITIAL_REQUESTS } from '@mocks/data/leaveRequests';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import './TeamRequests.css';
import { activatable } from '@utils/interactive';
const AVATAR_COLORS = [
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
function avatarColor(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
function todayStr() {
  return /* @__PURE__ */ new Date().toISOString().slice(0, 10);
}
function fmtDate(s) {
  if (!s) return '\u2014';
  return /* @__PURE__ */ new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function fmtShort(s) {
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
function eachDay(s, e) {
  const days = [];
  const cur = /* @__PURE__ */ new Date(s + 'T00:00:00'),
    end = /* @__PURE__ */ new Date(e + 'T00:00:00');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function isSaudiWeekend(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + 'T00:00:00').getDay();
  return d === 5 || d === 6;
}
const TYPE_CONFIG = {
  leave: { label: 'Leave', css: 'tr-type-leave', Icon: Briefcase },
  wfh: { label: 'WFH', css: 'tr-type-wfh', Icon: Home },
  offshore: { label: 'Offshore Work', css: 'tr-type-offshore', Icon: Anchor },
  compoff: { label: 'Comp-off', css: 'tr-type-compoff', Icon: Gift },
};

import { leaveService } from '@services/leaveService';
import { Loader } from '@components/feedback/Loader/Loader';

function TeamRequestsTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchTeamLeaves = async () => {
      try {
        setIsLoading(true);
        const managerId = user?.emp_id || user?.id || 1; // Dynamically fetch logged in user
        const response = await leaveService.getTeamLeaves(managerId);
        const results = Array.isArray(response) ? response : (response?.results || []);
        
        // Map the API payload to the frontend format
        const mappedRequests = results.map(req => {
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
            team: req.team_name,
            type: type,
            leaveType: req.leave_type,
            reason: req.leave_reason,
            startDate: req.start_date,
            endDate: req.end_date,
            duration: req.leave_duration === 'full_day' ? 'full' : req.leave_duration,
            inDays: req.in_days,
            bizDays: req.business_days,
            requestedOn: req.requested_date ? req.requested_date.split('T')[0] : '',
            status: req.status ? req.status.toLowerCase() : 'pending',
            priority: 'normal',
          };
        });
        
        setRequests(mappedRequests);
      } catch (error) {
        console.error("Failed to fetch team leaves:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTeamLeaves();
  }, []);

  const [innerTab, setInnerTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [typeF, setTypeF] = useState('all');
  const [leaveTypeF, setLeaveTypeF] = useState('all');
  const [sortBy, setSortBy] = useState('requestedOn');
  const [viewMode, setViewMode] = useState('list');
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);
  const today = /* @__PURE__ */ new Date();
  const [sdlYear, setSdlYear] = useState(today.getFullYear());
  const [sdlMonth, setSdlMonth] = useState(today.getMonth());
  const [sdlSelected, setSdlSelected] = useState(todayStr());
  const [sdlSearch, setSdlSearch] = useState('');
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
  useEffect(() => {
    const h = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
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
      pendLeave: requests.filter((r) => r.status === 'pending' && r.type === 'leave').length,
      pendWfh: requests.filter((r) => r.status === 'pending' && r.type === 'wfh').length,
      pendOffshore: requests.filter((r) => r.status === 'pending' && r.type === 'offshore').length,
      pendCompoff: requests.filter((r) => r.status === 'pending' && r.type === 'compoff').length,
    }),
    [requests],
  );
  const leaveDates = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    requests.forEach((r) => eachDay(r.startDate, r.endDate).forEach((d) => set.add(d)));
    return set;
  }, [requests]);
  const sdlDayCount = useMemo(() => leaveDates.size, [leaveDates]);
  const sdlTeams = useMemo(() => [...new Set(requests.map((r) => r.team))].sort(), [requests]);
  const sdlEmployees = useMemo(() => {
    let list = requests.filter((r) => eachDay(r.startDate, r.endDate).includes(sdlSelected));
    if (sdlLeaveTF !== 'all')
      list = list.filter(
        (r) =>
          (r.leaveType ?? '') === sdlLeaveTF ||
          (r.type === 'offshore' && sdlLeaveTF === 'Offshore Work'),
      );
    if (sdlTeam !== 'all') list = list.filter((r) => r.team === sdlTeam);
    if (sdlStatus !== 'all') list = list.filter((r) => r.status === sdlStatus);
    const q = sdlSearch.toLowerCase().trim();
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
  }, [requests, sdlSelected, sdlLeaveTF, sdlTeam, sdlStatus, sdlSearch, sdlSortBy]);
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
    let list = requests;
    const q = search.toLowerCase().trim();
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
    if (typeF !== 'all') list = list.filter((r) => r.type === typeF);
    if (leaveTypeF !== 'all')
      list = list.filter(
        (r) =>
          (r.leaveType ?? '') === leaveTypeF ||
          (r.type === 'offshore' && leaveTypeF === 'Offshore Work'),
      );
    return [...list].sort((a, b) => {
      if (sortBy === 'oldestFirst') return a.requestedOn.localeCompare(b.requestedOn);
      if (sortBy === 'startDate') return a.startDate.localeCompare(b.startDate);
      if (sortBy === 'endDate') return a.endDate.localeCompare(b.endDate);
      return b.requestedOn.localeCompare(a.requestedOn);
    });
  }, [requests, search, statusF, typeF, leaveTypeF, sortBy]);
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
      const payload = {
        manager_id: user?.emp_id || user?.id || 1,
        reason: managerNote || 'Approved'
      };
      await leaveService.approveLeave(drawerReq.id, payload);
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
      const payload = {
        manager_id: user?.emp_id || user?.id || 1,
        reason: managerNote
      };
      await leaveService.rejectLeave(drawerReq.id, payload);
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
  return (
    <div className="tr-workspace">
      {/* ── Inner Sub-tabs ────────────────────────────────────────────────────── */}
      <div className="tr-subtab-bar">
        <button
          className="tr-subtab"
          data-active={innerTab === 'all'}
          onClick={() => setInnerTab('all')}
        >
          All Requests<span className="tr-subtab-badge">{counts.all}</span>
        </button>
        <button
          className="tr-subtab"
          data-active={innerTab === 'sameday'}
          onClick={() => setInnerTab('sameday')}
        >
          Same Day Leave<span className="tr-subtab-badge">{sdlEmployees.length} Employees</span>
        </button>
        <div className="tr-subtab-indicator" data-tab={innerTab} />
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
      <div className="tr-kpi-strip">
        {[
          {
            type: 'leave',
            label: 'Pending Leave',
            count: counts.pendLeave,
            color: '#1d4ed8',
            bg: '#dbeafe',
            Icon: Briefcase,
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
            Icon: Anchor,
          },
          {
            type: 'compoff',
            label: 'Pending Comp-off / WW',
            count: counts.pendCompoff,
            color: '#92400e',
            bg: '#fef3c7',
            Icon: Gift,
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
              <div className="tr-kpi-count">{count}</div>
              <div className="tr-kpi-label">{label}</div>
            </div>
            <div className="tr-kpi-trend" style={{ color: count > 0 ? '#92400e' : '#065f46' }}>
              {count > 0 ? <TrendingUp size={12} /> : <CheckCircle2 size={12} />}
            </div>
          </div>
        ))}
      </div>

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
            <div className="tr-all-toolbar-right">
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
              <div className="tr-export-wrap" ref={exportRef}>
                <button className="tr-export-btn" onClick={() => setShowExport((o) => !o)}>
                  <Download size={13} />
                  <span>Export</span>
                  <ChevronDown size={11} />
                </button>
                {showExport && (
                  <div className="tr-export-dropdown">
                    <button className="tr-export-item" onClick={() => setShowExport(false)}>
                      <FileSpreadsheet size={13} />
                      <span>Export as Excel</span>
                    </button>
                    <button className="tr-export-item" onClick={() => setShowExport(false)}>
                      <FileText size={13} />
                      <span>Export as PDF</span>
                    </button>
                  </div>
                )}
              </div>
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
                  <tr>
                    <th className="tr-th" style={{ width: '24%' }}>
                      Consultant
                    </th>
                    <th className="tr-th" style={{ width: '15%' }}>
                      Leave Type
                    </th>
                    <th className="tr-th" style={{ width: '23%' }}>
                      Dates
                    </th>
                    <th className="tr-th" style={{ width: '9%' }}>
                      Work Days
                    </th>
                    <th className="tr-th" style={{ width: '9%' }}>
                      Applied On
                    </th>
                    <th className="tr-th" style={{ width: '10%' }}>
                      Status
                    </th>
                    <th className="tr-th" style={{ width: '10%' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
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
                                style={{ background: avatarColor(req.employeeName) }}
                              >
                                {initials(req.employeeName)}
                              </div>
                              <div>
                                <div className="tr-con-name">{req.employeeName}</div>
                                <div className="tr-con-sub">
                                  {req.employeeId} · {req.team}
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
                                {req.startDate === req.endDate
                                  ? `(${
                                      req.duration === 'full'
                                        ? 'Full Day'
                                        : req.duration === 'morning'
                                          ? 'First Half'
                                          : 'Second Half'
                                    })`
                                  : `(${req.inDays} ${req.inDays === 1 ? 'day' : 'days'})`}
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
                            {fmtShort(req.requestedOn)}
                          </td>
                          <td className="tr-td">
                            <span className={`tr-status-badge tr-status-${req.status}`}>
                              {req.status === 'pending' && <Clock size={9} />}
                              {req.status === 'approved' && <CheckCircle2 size={9} />}
                              {req.status === 'rejected' && <XCircle size={9} />}
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                          </td>
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
                              <button
                                className="tr-act-btn tr-act-view"
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
                        style={{ background: avatarColor(req.employeeName) }}
                      >
                        {initials(req.employeeName)}
                      </div>

                      {/* Identity */}
                      <div className="tr-sdl-emp-identity">
                        <div className="tr-con-name">{req.employeeName}</div>
                        <div className="tr-con-sub">
                          {req.employeeId} · {req.team} · {req.designation}
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
      <div className={`tr-drawer${drawerOpen ? ' open' : ''}`}>
        {liveReq && (
          <>
            {showConfirm && (
              <div className="tr-confirm-overlay">
                <div className="tr-confirm-card">
                  <h3 className="tr-confirm-title">Confirm Approval</h3>
                  <p className="tr-confirm-sub">
                    Approve <strong>{liveReq.employeeName}</strong>&apos;s{' '}
                    {liveReq.leaveType ?? TYPE_CONFIG[liveReq.type].label} request (
                    {fmtShort(liveReq.startDate)} → {fmtShort(liveReq.endDate)}, {liveReq.bizDays}
                    d)?
                  </p>
                  <div className="tr-confirm-actions">
                    <button className="tr-btn tr-btn-ghost" onClick={() => setShowConfirm(false)}>
                      Back
                    </button>
                    <button 
                      className="tr-btn tr-btn-primary" 
                      onClick={handleApprove}
                      disabled={isSubmittingAction}
                    >
                      <Check size={12} />
                      {isSubmittingAction ? 'Approving...' : 'Confirm Approval'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="tr-drawer-header">
              <span className="tr-drawer-title">
                {drawerAction === 'approve'
                  ? 'Approve Request'
                  : drawerAction === 'reject'
                    ? 'Reject Request'
                    : 'Request Details'}
              </span>
              <button className="tr-drawer-close" onClick={closeDrawer}>
                <X size={14} />
              </button>
            </div>

            <div className="tr-drawer-body">
              {/* Employee Summary */}
              <div className="tr-emp-summary">
                <div
                  className="tr-emp-avatar"
                  style={{ background: avatarColor(liveReq.employeeName) }}
                >
                  {initials(liveReq.employeeName)}
                </div>
                <div>
                  <div className="tr-emp-name">{liveReq.employeeName}</div>
                  <div className="tr-emp-meta">
                    <span className="tr-emp-meta-item">{liveReq.employeeId}</span>
                    <span className="tr-emp-meta-item">· {liveReq.designation}</span>
                    <span className="tr-emp-meta-item">· {liveReq.team}</span>
                  </div>
                  <div className="tr-emp-meta" style={{ marginTop: 2 }}>
                    <span className="tr-emp-meta-item">Reports to: {liveReq.manager}</span>
                  </div>
                </div>
              </div>

              {/* Request Info */}
              <div className="tr-dsec">
                <div className="tr-dsec-title">Request Information</div>
                <div className="tr-drow">
                  <span className="tr-drow-label">Request Type</span>
                  <span className="tr-drow-value">
                    {liveReq.leaveType ?? TYPE_CONFIG[liveReq.type].label}
                  </span>
                </div>
                {liveReq.reason && liveReq.type !== 'offshore' && (
                  <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
                    <span className="tr-drow-label">
                      {liveReq.type === 'compoff'
                        ? 'Claim Reason'
                        : liveReq.type === 'wfh'
                          ? 'Reason for WFH'
                          : 'Leave Reason'}
                    </span>
                    <span className={`tr-type-badge ${TYPE_CONFIG[liveReq.type].css}`} style={{ maxWidth: 220 }}>
                      {React.createElement(TYPE_CONFIG[liveReq.type].Icon, { size: 10 })}
                      {liveReq.reason}
                    </span>
                  </div>
                )}
                {liveReq.type === 'compoff' && (
                  <div className="tr-drow">
                    <span className="tr-drow-label">Claim Type</span>
                    <span className="tr-drow-value">
                      {liveReq.claimType === 'weekend' ? 'Weekend Work' : 'Compensatory Off'}
                    </span>
                  </div>
                )}
                <div className="tr-drow">
                  <span className="tr-drow-label">
                    {liveReq.type === 'compoff' ? 'From Date' : 'Start Date'}
                  </span>
                  <span className="tr-drow-value">{fmtDate(liveReq.startDate)}</span>
                </div>
                <div className="tr-drow">
                  <span className="tr-drow-label">
                    {liveReq.type === 'compoff' ? 'To Date' : 'End Date'}
                  </span>
                  <span className="tr-drow-value">{fmtDate(liveReq.endDate)}</span>
                </div>
                {liveReq.type !== 'offshore' && (
                  <div className="tr-drow">
                    <span className="tr-drow-label">Duration</span>
                    <span className="tr-drow-value">
                      {liveReq.duration === 'full'
                        ? 'Full Day'
                        : liveReq.duration === 'morning'
                          ? 'First Half'
                          : 'Second Half'}
                    </span>
                  </div>
                )}
                <div className="tr-drow">
                  <span className="tr-drow-label">Business Days</span>
                  <span className="tr-drow-value">{liveReq.bizDays}d</span>
                </div>
                <div className="tr-drow">
                  <span className="tr-drow-label">Applied On</span>
                  <span className="tr-drow-value">{fmtDate(liveReq.requestedOn)}</span>
                </div>
                <div className="tr-drow">
                  <span className="tr-drow-label">Status</span>
                  <span className={`tr-status-badge tr-status-${liveReq.status}`}>
                    {liveReq.status === 'pending' && <Clock size={9} />}
                    {liveReq.status === 'approved' && <CheckCircle2 size={9} />}
                    {liveReq.status === 'rejected' && <XCircle size={9} />}
                    {liveReq.status.charAt(0).toUpperCase() + liveReq.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Leave Balance */}
              {liveReq.balance && (
                <div className="tr-dsec">
                  <div className="tr-dsec-title">
                    Leave Balance — {liveReq.leaveType ?? 'Comp-off'}
                  </div>
                  <div className="tr-bal-wrap">
                    {[
                      ['Available', liveReq.balance.available],
                      ['Used', liveReq.balance.used],
                      ['Requested', liveReq.bizDays],
                      [
                        'Remaining',
                        Math.max(
                          0,
                          liveReq.balance.available - liveReq.balance.used - liveReq.bizDays,
                        ),
                      ],
                    ].map(([l, v]) => (
                      <div key={l} className="tr-bal-row">
                        <span className="tr-bal-label">{l}</span>
                        <span className="tr-bal-val">{v}d</span>
                      </div>
                    ))}
                    <div className="tr-bal-track">
                      <div
                        className={`tr-bal-fill ${balClass(liveReq)}`}
                        style={{ width: `${balPct(liveReq)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Team Availability */}
              {teamAvailability && teamAvailability.total > 0 && (
                <div className="tr-dsec">
                  <div className="tr-dsec-title">Team Availability — Same Dates</div>
                  <div className="tr-avail-grid">
                    {[
                      {
                        label: 'On Leave',
                        count: teamAvailability.onLeave,
                        color: '#1d4ed8',
                        bg: '#dbeafe',
                      },
                      {
                        label: 'WFH',
                        count: teamAvailability.onWfh,
                        color: '#065f46',
                        bg: '#d1fae5',
                      },
                      {
                        label: 'Offshore',
                        count: teamAvailability.onOffshore,
                        color: '#5b21b6',
                        bg: '#ede9fe',
                      },
                      {
                        label: 'Comp-off',
                        count: teamAvailability.onCompoff,
                        color: '#92400e',
                        bg: '#fef3c7',
                      },
                    ].map(({ label, count, color, bg }) => (
                      <div key={label} className="tr-avail-card">
                        <div className="tr-avail-count" style={{ color }}>
                          {count}
                        </div>
                        <div className="tr-avail-label" style={{ background: bg, color }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {teamAvailability.others.slice(0, 4).map((r) => (
                    <div key={r.id} className="tr-avail-name-row">
                      <div
                        className="tr-avatar"
                        style={{
                          width: 20,
                          height: 20,
                          fontSize: 8,
                          background: avatarColor(r.employeeName),
                        }}
                      >
                        {initials(r.employeeName)}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>
                        {r.employeeName}
                      </span>
                      <span
                        className={`tr-type-badge ${TYPE_CONFIG[r.type].css}`}
                        style={{ fontSize: 9.5, padding: '1px 5px' }}
                      >
                        {r.leaveType ?? TYPE_CONFIG[r.type].label}
                      </span>
                    </div>
                  ))}
                  {teamAvailability.total >= 3 && (
                    <div className="tr-conflict-card" style={{ marginTop: 8 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        {teamAvailability.total} team members unavailable on the same dates. Review
                        capacity before approving.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Conflicts */}
              {liveReq.conflicts && liveReq.conflicts.length > 0 && (
                <div className="tr-dsec">
                  <div className="tr-dsec-title">Conflicts & Notices</div>
                  {liveReq.conflicts.map((c, i) => (
                    <div key={i} className="tr-conflict-card">
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Approval Timeline */}
              <div className="tr-dsec">
                <div className="tr-dsec-title">Approval Timeline</div>
                <div className="tr-timeline">
                  {[
                    {
                      label: 'Submitted',
                      sub: `by ${liveReq.employeeName} on ${fmtDate(liveReq.requestedOn)}`,
                      state: 'done',
                    },
                    {
                      label: 'Pending Manager Approval',
                      sub: `Reporting to ${liveReq.manager}`,
                      state:
                        liveReq.status === 'pending'
                          ? 'active'
                          : liveReq.status === 'approved'
                            ? 'done'
                            : 'rejected',
                    },
                    {
                      label:
                        liveReq.status === 'rejected'
                          ? 'Rejected'
                          : liveReq.status === 'approved'
                            ? 'Approved'
                            : 'Awaiting Decision',
                      sub:
                        liveReq.status === 'pending'
                          ? 'Pending manager action'
                          : `Status: ${liveReq.status}`,
                      state:
                        liveReq.status === 'pending'
                          ? 'waiting'
                          : liveReq.status === 'approved'
                            ? 'approved'
                            : 'rejected',
                    },
                  ].map((step, i, arr) => (
                    <div key={i} className="tr-tl-step">
                      <div className="tr-tl-track">
                        <div className={`tr-tl-dot ${step.state}`}>
                          {step.state === 'done' || step.state === 'approved' ? (
                            <Check size={9} />
                          ) : step.state === 'rejected' ? (
                            <X size={9} />
                          ) : step.state === 'active' ? (
                            <Clock size={9} />
                          ) : (
                            i + 1
                          )}
                        </div>
                        {i < arr.length - 1 && <div className="tr-tl-line" />}
                      </div>
                      <div className="tr-tl-content">
                        <div className="tr-tl-label">{step.label}</div>
                        <div className="tr-tl-sub">{step.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manager Notes */}
              {(drawerAction !== 'view' || liveReq.status === 'pending') && (
                <div className="tr-dsec">
                  <div className="tr-dsec-title">Manager Notes</div>
                  <textarea
                    className="tr-notes"
                    placeholder="Enter approval or rejection comments…"
                    value={managerNote}
                    onChange={(e) => {
                      setManagerNote(e.target.value);
                      if (e.target.value.trim()) setRejectErr(false);
                    }}
                  />
                  {rejectErr && (
                    <p className="tr-notes-hint">
                      <AlertCircle size={10} style={{ display: 'inline', marginRight: 3 }} />
                      Comments are required to reject a request.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="tr-drawer-footer">
              <div className="tr-footer-left">
                {rejectErr && (
                  <span className="tr-footer-left-label">
                    <AlertCircle size={11} />
                    Comments required to reject
                  </span>
                )}
              </div>
              <button className="tr-btn tr-btn-ghost" onClick={closeDrawer}>
                Cancel
              </button>
              {liveReq.status === 'pending' && (
                <>
                  {(drawerAction === 'view' || drawerAction === 'reject') && (
                    <button 
                      className="tr-btn tr-btn-danger" 
                      onClick={handleReject}
                      disabled={isSubmittingAction}
                    >
                      <X size={11} />
                      {isSubmittingAction ? 'Rejecting...' : 'Reject'}
                    </button>
                  )}
                  {(drawerAction === 'view' || drawerAction === 'approve') && (
                    <button 
                      className="tr-btn tr-btn-primary" 
                      onClick={() => setShowConfirm(true)}
                      disabled={isSubmittingAction}
                    >
                      <Check size={11} />
                      Approve
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export { TeamRequestsTab };
export default TeamRequestsTab;
