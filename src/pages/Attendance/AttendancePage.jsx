import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  TrendingUp,
  Users,
  Building2,
  Home,
  Clock,
  AlertCircle,
  Percent,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { format } from 'date-fns';
import { ATTENDANCE_TEAMS } from '@mocks/data/attendance';
import { attendanceService } from '@services/attendanceService';
import { leaveService } from '@services/leaveService';
import { activatable } from '@utils/interactive';

import './AttendancePage.css';

// ─── Constants ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_OPTIONS = MONTH_NAMES.map((label, value) => ({ label, value: String(value) }));
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const y = new Date().getFullYear() - 4 + i;
  return { label: String(y), value: String(y) };
});

/**
 * Attendance status code → display config.
 * Used for cell badges AND legends section.
 */
const ATTENDANCE_CODE_MAP = [
  { code: 'P',   label: 'Present',           color: '#22c55e', bg: '#f0fdf4', darkBg: '#14532d' },
  { code: 'A',   label: 'Absent',            color: '#ef4444', bg: '#fef2f2', darkBg: '#7f1d1d' },
  { code: 'SL',  label: 'Sick Leave',        color: '#f97316', bg: '#fff7ed', darkBg: '#7c2d12' },
  { code: 'AL',  label: 'Annual Leave',      color: '#3b82f6', bg: '#eff6ff', darkBg: '#1e3a8a' },
  { code: 'CL',  label: 'Casual Leave',      color: '#8b5cf6', bg: '#f5f3ff', darkBg: '#4c1d95' },
  { code: 'WFH', label: 'Work From Home',    color: '#06b6d4', bg: '#ecfeff', darkBg: '#164e63' },
  { code: 'WW',  label: 'Weekend Work',      color: '#d97706', bg: '#fffbeb', darkBg: '#78350f' },
  { code: 'CO',  label: 'Comp Off',          color: '#7c3aed', bg: '#ede9fe', darkBg: '#4c1d95' },
  { code: 'ML',  label: 'Maternity Leave',   color: '#ec4899', bg: '#fdf2f8', darkBg: '#831843' },
  { code: 'OW',  label: 'Offshore Work',     color: '#0ea5e9', bg: '#f0f9ff', darkBg: '#075985' },
  { code: 'LWP', label: 'Leave Without Pay', color: '#dc2626', bg: '#fef2f2', darkBg: '#7f1d1d' },
  { code: 'OD',  label: 'On Duty',           color: '#059669', bg: '#ecfdf5', darkBg: '#064e3b' },
  { code: 'HD',  label: 'Half Day',          color: '#ca8a04', bg: '#fefce8', darkBg: '#713f12' },
  { code: 'HO',  label: 'Holiday',           color: '#9333ea', bg: '#faf5ff', darkBg: '#581c87' },
  { code: 'WE',  label: 'Weekend',           color: '#6b7280', bg: '#f9fafb', darkBg: '#1f2937' },
];

const CODE_LOOKUP = Object.fromEntries(ATTENDANCE_CODE_MAP.map(c => [c.code, c]));

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateDates(startDate, days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getMonthDates(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return generateDates(start, end.getDate());
}

function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

function calcStats(dates) {
  const values = Object.values(dates);
  const presentDays = values.filter(v => v === 'P').length;
  const totalWorkingDays = values.filter(v => v !== 'WE' && v !== 'HO').length;
  const absentDays = values.filter(v => v === 'A').length;
  return { presentDays, absentDays, totalWorkingDays };
}

/** Generate mock per-day attendance for a consultant over the given dates. */
function generateAttendanceForDates(dates) {
  const result = {};
  for (const date of dates) {
    const key = formatDateKey(date);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) {
      result[key] = 'WE';
    } else {
      const r = Math.random();
      if (r < 0.78) result[key] = 'P';
      else if (r < 0.85) result[key] = 'AL';
      else if (r < 0.90) result[key] = 'SL';
      else if (r < 0.93) result[key] = 'WFH';
      else if (r < 0.96) result[key] = 'CL';
      else result[key] = 'A';
    }
  }
  return result;
}

/** Export filtered data to CSV. */
function exportToCSV(rows, dates, filename = 'attendance.csv') {
  const headers = ['Consultant', 'Team', ...dates.map(d => formatDateKey(d)), 'Present', 'Absent', 'Total'];
  const lines = [
    headers.join(','),
    ...rows.map(({ consultant, record, stats }) =>
      [
        `"${consultant.name}"`,
        `"${consultant.team}"`,
        ...dates.map(d => record.dates[formatDateKey(d)] || ''),
        stats.presentDays,
        stats.absentDays,
        stats.totalWorkingDays,
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Codes that render as plain coloured text (no badge background/border)
const PLAIN_TEXT_CODES = new Set(['P', 'WFH', 'WE', 'A', 'OD']);

function StatusBadge({ code }) {
  const cfg = CODE_LOOKUP[code] || { code, label: code, color: '#6b7280', bg: '#f9fafb' };
  const isPlain = PLAIN_TEXT_CODES.has(code);
  return (
    <span
      className={isPlain ? 'att-cell-plain' : 'att-cell-badge'}
      style={
        isPlain
          ? { color: cfg.color }
          : { color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }
      }
      title={cfg.label}
    >
      {code}
    </span>
  );
}

function InlineLegend() {
  const items = ATTENDANCE_CODE_MAP;
  return (
    <div className="att-inline-legend">
      {items.map(({ code, label, color }) => (
        <span key={code} className="att-inline-legend-item">
          <span className="att-legend-dot" style={{ backgroundColor: color }} />
          <span className="att-legend-code" style={{ color }}>{code}</span>
          <span className="att-legend-desc">{label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AttendancePage() {
  useDocumentTitle('Attendance');

  const { user } = useAuth();
  
  // ── UI state ──
  const [subTab, setSubTab] = useState('on-duty');
  const [viewMode, setViewMode] = useState('list');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedTeams, setExpandedTeams] = useState(
    new Set(['management', 'frontend', 'backend', 'uiux', 'data']),
  );
  const [activeKPI, setActiveKPI] = useState(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const [wfhData, setWfhData] = useState(null);
  const [isWfhLoading, setIsWfhLoading] = useState(false);

  const [leaveData, setLeaveData] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);

  const [dutyData, setDutyData] = useState(null);
  const [isDutyLoading, setIsDutyLoading] = useState(false);

  // ── Dynamic Tab Indicator ──
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef({});

  useEffect(() => {
    const activeTabEl = tabsRef.current[subTab];
    if (activeTabEl) {
      setIndicatorStyle({
        left: activeTabEl.offsetLeft,
        width: activeTabEl.offsetWidth,
      });
    }
  }, [subTab]);

  useEffect(() => {
    const managerId = user?.emp_id || user?.id || 1;
    if (subTab === 'on-duty') {
      setIsDutyLoading(true);
      leaveService.getTeamPresentToday(managerId)
        .then(data => setDutyData(data))
        .catch(err => console.error(err))
        .finally(() => setIsDutyLoading(false));
    }
    if (subTab === 'on-wfh') {
      setIsWfhLoading(true);
      leaveService.getTeamOnWfhToday(managerId)
        .then(data => setWfhData(data))
        .catch(err => console.error(err))
        .finally(() => setIsWfhLoading(false));
    }
    if (subTab === 'on-leave') {
      setIsLeaveLoading(true);
      leaveService.getTeamOnLeaveToday(managerId)
        .then(data => setLeaveData(data))
        .catch(err => console.error(err))
        .finally(() => setIsLeaveLoading(false));
    }
  }, [subTab, user]);

  // ── Date filters ──
  const today = useMemo(() => new Date(), []);
  const [filterMonth, setFilterMonth] = useState(String(today.getMonth()));
  const [filterYear, setFilterYear] = useState(String(today.getFullYear()));
  const [filterDateRange, setFilterDateRange] = useState({ from: undefined, to: undefined });

  // ── Debounce search ──
  const debounceTimer = useRef(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  // ── Derived dates for Report tab ──
  const reportDates = useMemo(() => {
    if (filterDateRange.from && filterDateRange.to) {
      const diff = Math.floor(
        (filterDateRange.to - filterDateRange.from) / (1000 * 60 * 60 * 24),
      ) + 1;
      return generateDates(filterDateRange.from, diff);
    }
    return getMonthDates(Number(filterYear), Number(filterMonth));
  }, [filterMonth, filterYear, filterDateRange]);

  // ── Timeline dates (On Leave tab) ──
  const timelineDates = useMemo(() => generateDates(today, 30), [today]);

  // ── Data Fetching ──
  const fetchAttendance = useCallback(() => {
    if (!reportDates.length || !timelineDates.length) return Promise.resolve(null);
    const dates = [...reportDates, ...timelineDates];
    const minDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
    const managerId = user?.emp_id || user?.id || 1;
    return attendanceService.getAttendance(managerId, format(minDate, 'yyyy-MM-dd'), format(maxDate, 'yyyy-MM-dd'));
  }, [user, reportDates, timelineDates]);

  const { data, isLoading, error, refetch } = useAsync(fetchAttendance);

  // ── Attendance records (generated from real consultants + selected dates) ──
  const allConsultants = useMemo(() => {
    if (!data?.teamMembers) return [];
    return data.teamMembers.map(m => ({
      id: m.emp_id,
      name: m.emp_name,
      team: m.team_name || 'Other',
      manager: '', 
      location: '', 
      phone: '', 
      email: '',
      status: 'present', 
      avatar: m.emp_name ? m.emp_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : '?',
      designation: m.designation,
    }));
  }, [data?.teamMembers]);

  const attendanceRecords = useMemo(() => {
    if (!data?.calendar || !allConsultants.length) return [];
    const calendarMap = data.calendar.reduce((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {});

    const LABEL_TO_CODE = Object.fromEntries(ATTENDANCE_CODE_MAP.map(c => [c.label, c.code]));

    return allConsultants.map(c => {
      const datesObj = {};
      for (const date of reportDates) {
        const dateStr = formatDateKey(date);
        const dayData = calendarMap[dateStr];
        if (!dayData) {
          datesObj[dateStr] = 'P'; // fallback
          continue;
        }
        
        if (dayData.is_holiday) {
          datesObj[dateStr] = 'HO';
        } else if (dayData.is_weekend) {
          datesObj[dateStr] = 'WE';
        } else {
          const leaveDetail = dayData.on_leave_details?.find(l => l.emp_id === c.id);
          if (leaveDetail) {
            datesObj[dateStr] = LABEL_TO_CODE[leaveDetail.leave_type] || 'AL';
          } else {
            const wfhDetail = dayData.on_wfh_details?.find(l => l.emp_id === c.id);
            if (wfhDetail) {
              datesObj[dateStr] = 'WFH';
            } else {
              datesObj[dateStr] = 'P';
            }
          }
        }
      }
      return { consultantId: c.id, dates: datesObj };
    });
  }, [allConsultants, reportDates, data?.calendar]);

  const { onDutyConsultants, onLeaveConsultants } = useMemo(() => {
    const todayStr = formatDateKey(today);
    if (!data?.calendar || !allConsultants.length) return { onDutyConsultants: [], onLeaveConsultants: [] };
    
    const todayData = data.calendar.find(d => d.date === todayStr);
    if (!todayData) {
      return { onDutyConsultants: allConsultants, onLeaveConsultants: [] };
    }

    const leaveIds = new Set(todayData.on_leave_details?.map(l => l.emp_id) || []);
    const wfhIds = new Set(todayData.on_wfh_details?.map(l => l.emp_id) || []);

    const onDuty = [];
    const onLeave = [];

    allConsultants.forEach(c => {
      if (leaveIds.has(c.id)) {
        const leaveDetail = todayData.on_leave_details.find(l => l.emp_id === c.id);
        onLeave.push({
          consultantId: c.id,
          consultantName: c.name,
          team: c.team,
          leaveType: leaveDetail?.leave_type || 'Leave',
          startDate: todayStr,
          endDate: todayStr,
          days: 1,
          avatar: c.avatar
        });
      } else {
        onDuty.push({
          ...c,
          status: wfhIds.has(c.id) ? 'remote' : 'present'
        });
      }
    });

    return { onDutyConsultants: onDuty, onLeaveConsultants: onLeave };
  }, [allConsultants, data?.calendar, today]);

  // ── Filtered data ──
  const filteredOnDuty = useMemo(() => {
    let source = onDutyConsultants;
    if (dutyData?.present_details) {
      source = dutyData.present_details.map(d => ({
        id: d.emp_id,
        name: d.emp_name,
        team: d.team_name || 'Other',
        status: d.working_mode === 'WFH' ? 'remote' : 'present',
        manager: d.designation || 'Manager',
        location: d.working_mode === 'WFH' ? 'Remote' : 'Office',
        phone: 'N/A',
        email: 'N/A',
        avatar: d.emp_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()
      }));
    }

    return source
      .filter(c => selectedTeam === 'all' || c.team === selectedTeam)
      .filter(c => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [onDutyConsultants, dutyData, selectedTeam, debouncedSearch]);

  const filteredOnLeave = useMemo(() =>
    onLeaveConsultants.filter(l =>
      (selectedTeam === 'all' || l.team === selectedTeam) &&
      l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase()),
    ), [onLeaveConsultants, selectedTeam, debouncedSearch]);

  const filteredReportRows = useMemo(() => {
    return attendanceRecords.reduce((acc, record) => {
      const consultant = allConsultants.find(c => c.id === record.consultantId);
      if (!consultant) return acc;
      if (selectedTeam !== 'all' && consultant.team !== selectedTeam) return acc;
      if (debouncedSearch && !consultant.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return acc;
      const stats = calcStats(record.dates);
      acc.push({ consultant, record, stats });
      return acc;
    }, []);
  }, [attendanceRecords, allConsultants, selectedTeam, debouncedSearch]);

  // ── Codes used in current report view (for dynamic legends) ──
  const codesUsed = useMemo(() => {
    const s = new Set();
    filteredReportRows.forEach(({ record }) => Object.values(record.dates).forEach(v => s.add(v)));
    return [...s];
  }, [filteredReportRows]);

  // ── Helpers ──
  const groupByTeam = useCallback(consultants => {
    return consultants.reduce((g, c) => {
      if (!g[c.team]) g[c.team] = [];
      g[c.team].push(c);
      return g;
    }, {});
  }, []);

  const groupedOnDuty = useMemo(() => groupByTeam(filteredOnDuty), [filteredOnDuty, groupByTeam]);

  const dynamicTeamOptions = useMemo(() => {
    const teams = new Set();
    if (allConsultants) {
      allConsultants.forEach(c => {
        if (c.team && c.team !== 'Other') teams.add(c.team);
      });
    }
    if (dutyData?.present_details) {
      dutyData.present_details.forEach(d => {
        if (d.team_name && d.team_name !== 'Other') teams.add(d.team_name);
      });
    }
    if (wfhData?.team_members) {
      wfhData.team_members.forEach(d => {
        if (d.team_name && d.team_name !== 'Other') teams.add(d.team_name);
      });
    }
    if (leaveData?.team_members) {
      leaveData.team_members.forEach(d => {
        if (d.team_name && d.team_name !== 'Other') teams.add(d.team_name);
      });
    }
    const teamList = Array.from(teams).sort().map(team => ({
      value: team,
      label: team
    }));
    return [{ value: 'all', label: 'All Teams' }, ...teamList];
  }, [allConsultants, dutyData, wfhData, leaveData]);
  const toggleTeam = useCallback(teamId => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  }, []);

  const getLeaveTypeColor = useCallback(type => {
    const map = { 'Annual Leave': '#93c5fd', 'Sick Leave': '#fca5a5', 'Comp Off': '#c4b5fd' };
    return map[type] || '#d1d5db';
  }, []);

  const getStatusBadgeClass = useCallback(status => {
    const map = { present: 'att-status-present', remote: 'att-status-remote', offshore: 'att-status-offshore' };
    return map[status] || '';
  }, []);

  const isWeekend = useCallback(date => {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
  }, []);

  const handleExportCSV = useCallback(() => {
    exportToCSV(filteredReportRows, reportDates, `attendance_${filterYear}_${MONTH_NAMES[Number(filterMonth)]}.csv`);
    setExportDropdownOpen(false);
  }, [filteredReportRows, reportDates, filterYear, filterMonth]);

  const handleClearDateRange = useCallback(() => {
    setFilterDateRange({ from: undefined, to: undefined });
  }, []);

  const handlePrevMonth = useCallback(() => {
    setFilterMonth(prev => {
      const m = Number(prev);
      if (m === 0) { setFilterYear(y => String(Number(y) - 1)); return '11'; }
      return String(m - 1);
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setFilterMonth(prev => {
      const m = Number(prev);
      if (m === 11) { setFilterYear(y => String(Number(y) + 1)); return '0'; }
      return String(m + 1);
    });
  }, []);

  // ── Error / Loading ──
  if (error) return <ErrorState title="Attendance could not be loaded" description={error.message} onRetry={refetch} />;
  if (isLoading || !data) return <Loader message="Loading attendance…" />;

  return (
    <div className="attendance-page">

      {/* ── Sub-tabs ── */}
      <div className="attendance-subtabs">
        {['on-duty', 'on-wfh', 'on-leave', 'report'].map(id => (
          <button
            key={id}
            ref={el => (tabsRef.current[id] = el)}
            className={`attendance-subtab${subTab === id ? ' attendance-subtab-active' : ''}`}
            onClick={() => setSubTab(id)}
          >
            {id === 'on-duty' ? 'On Duty Today' : id === 'on-wfh' ? 'On WFH Today' : id === 'on-leave' ? 'On Leave' : 'Attendance Report'}
          </button>
        ))}
        <div className="attendance-subtab-indicator" style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
      </div>

      {/* ── Filters — compact single row ── */}
      <div className="att-filterbar">
        <Select
          value={selectedTeam}
          onChange={setSelectedTeam}
          options={dynamicTeamOptions}
          width="190px"
        />

        {/* Search */}
        <div className="att-search-wrap">
          <Search size={13} className="att-search-icon" />
          <input
            type="text"
            placeholder="Search consultant…"
            className="att-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingRight: '32px' }}
          />
          {searchQuery && (
            <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Month nav — only on Report tab, when no date range active */}
        {subTab === 'report' && !filterDateRange.from && (
          <div className="att-month-nav">
            <button className="att-month-arrow" onClick={handlePrevMonth} title="Previous month">
              <ChevronLeft size={14} />
            </button>
            <Select
              value={filterMonth}
              onChange={setFilterMonth}
              options={MONTH_OPTIONS}
              width="130px"
            />
            <Select
              value={filterYear}
              onChange={setFilterYear}
              options={YEAR_OPTIONS}
              width="92px"
            />
            <button className="att-month-arrow" onClick={handleNextMonth} title="Next month">
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Date Range — only on Report tab */}
        {subTab === 'report' && (
          <DatePicker
            mode="range"
            value={filterDateRange.from ? filterDateRange : undefined}
            onChange={val => setFilterDateRange(val ?? { from: undefined, to: undefined })}
            placeholder="Date range…"
            showClear
            width="200px"
          />
        )}

        {/* Spacer */}
        <div className="att-filterbar-spacer" />

        {/* View toggle — not on On Duty or On WFH */}
        {subTab !== 'on-duty' && subTab !== 'on-wfh' && (
          <div className="attendance-view-switcher">
            <button
              className={`attendance-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
            >List</button>
            {subTab === 'on-leave' && (
              <button
                className={`attendance-view-btn${viewMode === 'timeline' ? ' active' : ''}`}
                onClick={() => setViewMode('timeline')}
              >Timeline</button>
            )}
            {subTab === 'report' && (
              <button
                className={`attendance-view-btn${viewMode === 'card' ? ' active' : ''}`}
                onClick={() => setViewMode('card')}
              >Card</button>
            )}
          </div>
        )}

        {/* Export */}
        <div className="att-export-wrapper">
          <button
            className="attendance-export-btn"
            onClick={() => setExportDropdownOpen(p => !p)}
          >
            <Download size={14} />
            Export
            <ChevronDown size={12} />
          </button>
          {exportDropdownOpen && (
            <div className="attendance-export-dropdown">
              <button className="attendance-export-option" onClick={handleExportCSV}>
                <FileSpreadsheet size={14} /> Export as CSV
              </button>
              <button className="attendance-export-option" onClick={() => setExportDropdownOpen(false)}>
                <FileText size={14} /> Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards — On Duty tab only ── */}
      {subTab === 'on-duty' && (
        <div className="attendance-kpi-section">
          {[
            { key: 'total',      icon: <Users size={20} />,        color: 'blue',  count: filteredOnDuty.length + filteredOnLeave.length, label: 'Total Consultants' },
            { key: 'present',    icon: <Building2 size={20} />,    color: 'green', count: filteredOnDuty.filter(c => c.status === 'present').length, label: 'Present (Office)' },
            { key: 'wfh',        icon: <Home size={20} />,         color: 'blue',  count: filteredOnDuty.filter(c => c.status === 'remote').length, label: 'Work From Home' },
            { key: 'leave',      icon: <Clock size={20} />,        color: 'amber', count: filteredOnLeave.length, label: 'On Leave' },
            { key: 'absent',     icon: <AlertCircle size={20} />,  color: 'red',   count: 0, label: 'Absent / Not Marked' },
            { key: 'attendance', icon: <Percent size={20} />,      color: 'green', count: `${Math.round(filteredOnDuty.length / Math.max(filteredOnDuty.length + filteredOnLeave.length, 1) * 100)}%`, label: 'Attendance %' },
          ].map(({ key, icon, color, count, label }) => (
            <div
              key={key}
              className={`attendance-kpi-card${activeKPI === key ? ' kpi-active' : ''}`}
              {...activatable(() => setActiveKPI(p => p === key ? null : key), { isPressed: activeKPI === key })}
            >
              <div className="kpi-icon-wrapper" data-color={color}>{icon}</div>
              <div className="kpi-details">
                <div className="kpi-count">{count}</div>
                <div className="kpi-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="attendance-content">

        {/* On Duty — List */}
        {subTab === 'on-duty' && (
          <div className="attendance-list">
            {Object.entries(groupedOnDuty).map(([team, consultants]) => (
              <div key={team} className="attendance-team-group">
                <button className="attendance-team-header" onClick={() => toggleTeam(team)}>
                  {expandedTeams.has(team) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="attendance-team-name">{team.charAt(0).toUpperCase() + team.slice(1)}</span>
                  <span className="attendance-team-badge">{consultants.length}</span>
                </button>
                {expandedTeams.has(team) && (
                  <div className="attendance-team-content">
                    {consultants.map(c => (
                      <div key={c.id} className="attendance-consultant-row">
                        <div className="attendance-consultant-main">
                          <div className="attendance-consultant-avatar">{c.avatar}</div>
                          <div className="attendance-consultant-info">
                            <div className="attendance-consultant-name">{c.name}</div>
                            <div className="attendance-consultant-manager">Manager: {c.manager}</div>
                          </div>
                        </div>
                        <div className="attendance-consultant-details">
                          <div className="attendance-detail-item"><MapPin size={12} className="attendance-detail-icon" /><span>{c.location}</span></div>
                          <div className="attendance-detail-item"><Phone size={12} className="attendance-detail-icon" /><span>{c.phone}</span></div>
                          <div className="attendance-detail-item"><Mail size={12} className="attendance-detail-icon" /><span>{c.email}</span></div>
                        </div>
                        <div className={`attendance-status-badge ${getStatusBadgeClass(c.status)}`}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredOnDuty.length === 0 && (
              <div className="attendance-empty">
                <User size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants on duty</p>
              </div>
            )}
          </div>
        )}

        {/* On WFH — List */}
        {subTab === 'on-wfh' && (
          <div className="attendance-list">
            {isWfhLoading ? (
              <Loader message="Loading WFH data..." />
            ) : wfhData?.on_wfh_details?.length > 0 ? (
              <div className="attendance-team-content" style={{ marginTop: '20px' }}>
                {wfhData.team_members
                  .filter(c => wfhData.on_wfh_details.some(d => d.emp_id === c.emp_id))
                  .map(c => (
                    <div key={c.emp_id} className="attendance-consultant-row">
                      <div className="attendance-consultant-main">
                        <div className="attendance-consultant-avatar">
                          {c.emp_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="attendance-consultant-info">
                          <div className="attendance-consultant-name">{c.emp_name}</div>
                          <div className="attendance-consultant-manager">{c.designation || 'Consultant'}</div>
                        </div>
                      </div>
                      <div className="attendance-consultant-details">
                        <div className="attendance-detail-item">
                          <span>{c.team_name}</span>
                        </div>
                      </div>
                      <div className="attendance-status-badge att-status-remote">
                        Working From Home
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="attendance-empty">
                <Home size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants on WFH today</p>
              </div>
            )}
          </div>
        )}

        {/* On Leave — Timeline */}
        {subTab === 'on-leave' && viewMode === 'timeline' && (
          <div className="attendance-timeline-wrapper">
            <div className="attendance-timeline">
              <div className="attendance-timeline-header">
                <div className="attendance-timeline-consultant-col">Consultant</div>
                <div className="attendance-timeline-dates">
                  {timelineDates.map((date, idx) => (
                    <div key={idx} className="attendance-timeline-date">
                      <div className="attendance-timeline-date-day">{date.getDate()}</div>
                      <div className="attendance-timeline-date-month">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="attendance-timeline-body">
                {filteredOnLeave.map(leave => (
                  <div key={leave.consultantId} className="attendance-timeline-row">
                    <div className="attendance-timeline-consultant">
                      <div className="attendance-timeline-consultant-name">{leave.consultantName}</div>
                      <div className="attendance-timeline-consultant-team">{leave.team}</div>
                    </div>
                    <div className="attendance-timeline-bars">
                      {timelineDates.map((date, idx) => {
                        const dateStr = formatDateKey(date);
                        const dayData = data?.calendar?.find(d => d.date === dateStr);
                        const leaveDetail = dayData?.on_leave_details?.find(l => l.emp_id === leave.consultantId);
                        const inLeave = !!leaveDetail;
                        return (
                          <div
                            key={idx}
                            className={`attendance-timeline-cell${inLeave ? ' attendance-timeline-leave' : ''}`}
                            style={inLeave ? { backgroundColor: getLeaveTypeColor(leave.leaveType) } : {}}
                            title={inLeave ? `${leave.leaveType} – ${leave.days} days` : ''}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {filteredOnLeave.length === 0 && (
              <div className="attendance-empty">
                <Calendar size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants on leave</p>
              </div>
            )}
          </div>
        )}

        {/* On Leave — List */}
        {subTab === 'on-leave' && viewMode === 'list' && (
          <div className="attendance-list">
            {filteredOnLeave.map(leave => (
              <div key={leave.consultantId} className="attendance-leave-card">
                <div className="attendance-leave-main">
                  <div className="attendance-consultant-avatar">
                    {leave.consultantName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="attendance-leave-info">
                    <div className="attendance-consultant-name">{leave.consultantName}</div>
                    <div className="attendance-consultant-team">{leave.team}</div>
                  </div>
                </div>
                <div className="attendance-leave-details">
                  <div className="attendance-leave-type">{leave.leaveType}</div>
                  <div className="attendance-leave-dates">
                    {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    {' – '}
                    {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="attendance-leave-days">{leave.days} days</div>
                </div>
              </div>
            ))}
            {filteredOnLeave.length === 0 && (
              <div className="attendance-empty">
                <Calendar size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants on leave</p>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance Report — Table ── */}
        {subTab === 'report' && viewMode === 'list' && (
          <div className="att-report-outer">
            {/* Meta bar */}
            <div className="att-report-meta">
              <span className="att-report-range-label">
                {filterDateRange.from && filterDateRange.to
                  ? `${filterDateRange.from.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} – ${filterDateRange.to.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`
                  : `${MONTH_NAMES[Number(filterMonth)]} ${filterYear}`}
              </span>
              {filterDateRange.from && (
                <button className="att-clear-range-btn" onClick={handleClearDateRange}>
                  Clear range
                </button>
              )}
              <span className="att-report-count">{filteredReportRows.length} consultants</span>
            </div>

            <div className="att-report-scroll">
              <table className="att-report-table">
                <thead className="att-report-thead">
                  <tr>
                    <th className="att-th att-th-consultant">Consultant</th>
                    {reportDates.map((date, idx) => {
                      const we = isWeekend(date);
                      return (
                        <th key={idx} className={`att-th att-th-date${we ? ' att-th-weekend' : ''}`}>
                          <div className="att-date-header">
                            <span className="att-date-num">{date.getDate()}</span>
                            <span className="att-date-dow">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0,2)}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="att-th att-th-summary">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRows.map(({ consultant, record, stats }) => (
                    <tr key={consultant.id} className="att-report-row">
                      <td className="att-td att-td-consultant">
                        <div className="att-consultant-cell">
                          <div className="attendance-consultant-avatar att-avatar-sm">{consultant.avatar}</div>
                          <div>
                            <div className="att-consultant-name">{consultant.name}</div>
                            <div className="att-consultant-team">{consultant.team}</div>
                          </div>
                        </div>
                      </td>
                      {reportDates.map((date, idx) => {
                        const key = formatDateKey(date);
                        const code = record.dates[key] || '';
                        const we = isWeekend(date);
                        return (
                          <td key={idx} className={`att-td att-td-cell${we ? ' att-td-weekend' : ''}`}>
                            {code && <StatusBadge code={code} />}
                          </td>
                        );
                      })}
                      <td className="att-td att-td-summary">
                        <div className="att-summary-block">
                          <div className="att-summary-row att-summary-present">
                            <span className="att-summary-label">P</span>
                            <span className="att-summary-val">{stats.presentDays}</span>
                          </div>
                          <div className="att-summary-row att-summary-absent">
                            <span className="att-summary-label">A</span>
                            <span className="att-summary-val">{stats.absentDays}</span>
                          </div>
                          <div className="att-summary-row att-summary-total">
                            <span className="att-summary-label">T</span>
                            <span className="att-summary-val">{stats.totalWorkingDays}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReportRows.length === 0 && (
                    <tr>
                      <td colSpan={reportDates.length + 2} className="att-empty-cell">
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Inline legend as tfoot — visually attached to table */}
                <tfoot>
                  <tr>
                    <td colSpan={reportDates.length + 3} className="att-legend-tfoot">
                      <InlineLegend />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Attendance Report — Card */}
        {subTab === 'report' && viewMode === 'card' && (
          <div className="attendance-card-grid">
            {filteredReportRows.map(({ consultant, stats }) => {
              const percentage = Math.round((stats.presentDays / Math.max(stats.totalWorkingDays, 1)) * 100);
              return (
                <div key={consultant.id} className="attendance-card">
                  <div className="attendance-card-header">
                    <div className="attendance-consultant-avatar">{consultant.avatar}</div>
                    <div className="attendance-card-info">
                      <div className="attendance-consultant-name">{consultant.name}</div>
                      <div className="attendance-consultant-team">{consultant.team}</div>
                    </div>
                  </div>
                  <div className="attendance-card-ring">
                    <svg className="attendance-ring-svg" viewBox="0 0 120 120">
                      <circle className="attendance-ring-bg" cx="60" cy="60" r="50" fill="none" stroke="var(--surface-tertiary)" strokeWidth="8" />
                      <circle
                        className="attendance-ring-progress"
                        cx="60" cy="60" r="50" fill="none"
                        stroke="var(--brand-primary)" strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 50}`}
                        strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div className="attendance-ring-text">
                      <div className="attendance-ring-percentage">{percentage}%</div>
                      <div className="attendance-ring-label">Present</div>
                    </div>
                  </div>
                  <div className="attendance-card-stats">
                    <div className="attendance-card-stat">
                      <div className="attendance-card-stat-value">{stats.presentDays}</div>
                      <div className="attendance-card-stat-label">Present</div>
                    </div>
                    <div className="attendance-card-stat">
                      <div className="attendance-card-stat-value">{stats.absentDays}</div>
                      <div className="attendance-card-stat-label">Absent</div>
                    </div>
                    <div className="attendance-card-stat">
                      <div className="attendance-card-stat-value">{stats.totalWorkingDays}</div>
                      <div className="attendance-card-stat-label">Total</div>
                    </div>
                  </div>
                  <div className="attendance-card-sparkline">
                    <TrendingUp size={12} className="attendance-sparkline-icon" />
                    <span className="attendance-sparkline-text">
                      {MONTH_NAMES[Number(filterMonth)]} {filterYear}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendancePage;
