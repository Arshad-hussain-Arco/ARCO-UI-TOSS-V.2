import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  X,
  Briefcase
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDebounce } from '@hooks/useDebounce';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useEmployeePhotos } from '@hooks/useEmployeePhotos';
import { ExportButton } from '@components/ui/ExportButton';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ATTENDANCE_TEAMS } from '@mocks/data/attendance';
import { attendanceService } from '@services/attendanceService';
import { leaveService } from '@services/leaveService';
import { activatable } from '@utils/interactive';

import './AttendancePage.css';

// User provided custom team icon
const TeamIcon = ({ size = 14, color = "#3b82f6", className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className}>
    <path d="M0 0h24v24H0z" fill="none" />
    <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M1.874 17.625a2.625 2.625 0 1 0 5.25 0a2.625 2.625 0 0 0-5.25 0" />
      <path d="M8.249 23.25a4.25 4.25 0 0 0-7.5 0m16.125-5.625a2.625 2.625 0 1 0 5.25 0a2.625 2.625 0 0 0-5.25 0" />
      <path d="M23.249 23.25a4.25 4.25 0 0 0-7.5 0M9.374 3.375a2.625 2.625 0 1 0 5.25 0a2.625 2.625 0 0 0-5.25 0m5.874 4.875a4.27 4.27 0 0 0-6.5 0m.302 11.457a8.28 8.28 0 0 0 5.944-.018M6.348 6a8.22 8.22 0 0 0-2.6 6c0 .253.015.5.038.75m16.425 0c.022-.248.038-.5.038-.75a8.22 8.22 0 0 0-2.6-6" />
    </g>
  </svg>
);

// ─── Constants ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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
  { code: 'P', label: 'Present', color: 'var(--c-success)', bg: 'var(--c-success-light)', darkBg: '#14532d' },
  { code: 'A', label: 'Absent', color: 'var(--c-danger)', bg: 'var(--c-danger-light)', darkBg: '#7f1d1d' },
  { code: 'SL', label: 'Sick Leave', color: 'var(--c-warning)', bg: '#fff7ed', darkBg: '#7c2d12' },
  { code: 'AL', label: 'Annual Leave', color: 'var(--c-info)', bg: '#eff6ff', darkBg: '#1e3a8a' },
  { code: 'CL', label: 'Casual Leave', color: '#8b5cf6', bg: '#f5f3ff', darkBg: '#4c1d95' },
  { code: 'WFH', label: 'Work From Home', color: '#06b6d4', bg: '#ecfeff', darkBg: '#164e63' },
  { code: 'WW', label: 'Weekend Work', color: '#d97706', bg: '#fffbeb', darkBg: '#78350f' },
  { code: 'CO', label: 'Comp Off', color: '#7c3aed', bg: '#ede9fe', darkBg: '#4c1d95' },
  { code: 'ML', label: 'Maternity Leave', color: '#ec4899', bg: '#fdf2f8', darkBg: '#831843' },
  { code: 'OW', label: 'Offshore Work', color: '#0ea5e9', bg: '#f0f9ff', darkBg: '#075985' },
  { code: 'LWP', label: 'Leave Without Pay', color: 'var(--c-danger)', bg: 'var(--c-danger-light)', darkBg: '#7f1d1d' },
  { code: 'OD', label: 'On Duty', color: 'var(--c-success)', bg: '#ecfdf5', darkBg: '#064e3b' },
  { code: 'HD', label: 'Half Day', color: '#ca8a04', bg: '#fefce8', darkBg: '#713f12' },
  { code: 'HO', label: 'Holiday', color: '#9333ea', bg: '#faf5ff', darkBg: '#581c87' },
  { code: 'WE', label: 'Weekend', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', darkBg: 'var(--bg-primary)' },
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
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

/** Export filtered data to Excel. */
function exportToCSV(rows, dates, filename = 'attendance.csv') {
  const headers = ['Consultant', 'Team', ...dates.map(d => formatDateKey(d)), 'Present', 'Absent', 'Total'];
  const dataRows = rows.map(({ consultant, record, stats }) => [
    consultant.name || '',
    consultant.team || '',
    ...dates.map(d => record.dates[formatDateKey(d)] || ''),
    stats.presentDays,
    stats.absentDays,
    stats.totalWorkingDays,
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  XLSX.writeFile(workbook, filename.replace('.csv', '.xlsx'));
}

/** Export filtered data to PDF. */
function exportToPDF(rows, dates, filename = 'attendance.pdf') {
  const doc = new jsPDF('landscape');
  const headers = ['Consultant', 'Team', ...dates.map(d => formatDateKey(d)), 'P', 'A', 'T'];

  const body = rows.map(({ consultant, record, stats }) => [
    consultant.name,
    consultant.team,
    ...dates.map(d => record.dates[formatDateKey(d)] || ''),
    stats.presentDays,
    stats.absentDays,
    stats.totalWorkingDays,
  ]);

  autoTable(doc, {
    head: [headers],
    body: body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [0, 102, 51] }
  });

  doc.save(filename);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Codes that render as plain coloured text (no badge background/border)
const PLAIN_TEXT_CODES = new Set(['P', 'WFH', 'WE', 'A', 'OD']);

function StatusBadge({ code, variant = 'solid' }) {
  const cfg = CODE_LOOKUP[code] || { code, label: code, color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' };
  const isPlain = PLAIN_TEXT_CODES.has(code);
  return (
    <span
      className={isPlain ? 'att-cell-plain' : 'att-cell-badge'}
      style={
        isPlain
          ? { color: cfg.color }
          : {
            color: cfg.color,
            backgroundColor: variant === 'outline' ? 'transparent' : cfg.bg,
            borderColor: variant === 'outline' ? cfg.color : `${cfg.color}30`
          }
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

  const { user, hasPermission } = useAuth();
  const canExport = hasPermission('ATTENDANCE_EXPORT');

  const isManager = Boolean(user?.mySubordinates?.length > 0);
  const { getPhoto: getTeamPhoto } = useEmployeePhotos({
    managerId: user?.emp_id,
    enabled: isManager && !!user?.emp_id,
  });

  // ── UI state ──
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = searchParams.get('tab') || 'on-duty';

  const [viewMode, setViewMode] = useState('list');
  const [onLeaveTimelineFilter, setOnLeaveTimelineFilter] = useState('next30');
  const [onWfhTimelineFilter, setOnWfhTimelineFilter] = useState('next30');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const setSubTab = (tab) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    });
    setViewMode('list');
    setSearchQuery('');
  };

  const debouncedSearch = useDebounce(searchQuery, 500);
  const [collapsedTeams, setCollapsedTeams] = useState(new Set());
  const [activeKPI, setActiveKPI] = useState(null);

  const [wfhData, setWfhData] = useState(null);
  const [isWfhLoading, setIsWfhLoading] = useState(false);
  const [wfhError, setWfhError] = useState(null);

  const [leaveData, setLeaveData] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState(null);

  const [dutyData, setDutyData] = useState(null);
  const [isDutyLoading, setIsDutyLoading] = useState(false);
  const [dutyError, setDutyError] = useState(null);

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
    const managerId = user?.emp_id || user?.id;
    if (!managerId) return;

    setIsDutyLoading(true);
    setDutyError(null);
    leaveService.getTeamPresentToday(managerId)
      .then(data => setDutyData(data))
      .catch(err => { console.error(err); setDutyError(err); })
      .finally(() => setIsDutyLoading(false));

    setIsWfhLoading(true);
    setWfhError(null);
    leaveService.getTeamOnWfhToday(managerId)
      .then(data => setWfhData(data))
      .catch(err => { console.error(err); setWfhError(err); })
      .finally(() => setIsWfhLoading(false));

    setIsLeaveLoading(true);
    setLeaveError(null);
    leaveService.getTeamOnLeaveToday(managerId)
      .then(data => setLeaveData(data))
      .catch(err => { console.error(err); setLeaveError(err); })
      .finally(() => setIsLeaveLoading(false));
  }, [user?.emp_id, user?.id]);

  // ── Date filters ──
  const today = useMemo(() => new Date(), []);
  const [filterMonth, setFilterMonth] = useState(String(today.getMonth()));
  const [filterYear, setFilterYear] = useState(String(today.getFullYear()));
  const [filterDateRange, setFilterDateRange] = useState({ from: undefined, to: undefined });

  // ── Debounce search ──
  // Replaced with useDebounce hook

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

  // ── Timeline dates (On Leave / On WFH tab) ──
  const timelineDates = useMemo(() => {
    const filterValue = subTab === 'on-wfh' ? onWfhTimelineFilter : onLeaveTimelineFilter;
    if (filterValue === 'today') {
      return [today];
    }
    if (filterValue === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return [tomorrow];
    }
    return generateDates(today, 30);
  }, [today, onLeaveTimelineFilter, onWfhTimelineFilter, subTab]);

  // ── Data Fetching ──
  // Always fetch 30 days for timeline so filters are instant
  const fetchTimelineDates = useMemo(() => generateDates(today, 30), [today]);

  const fetchAttendance = useCallback(() => {
    if (!reportDates.length || !fetchTimelineDates.length) return Promise.resolve(null);
    const dates = [...reportDates, ...fetchTimelineDates];
    const minDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
    const managerId = user?.emp_id || user?.id;
    if (!managerId) return Promise.resolve(null);
    return attendanceService.getAttendance(managerId, format(minDate, 'yyyy-MM-dd'), format(maxDate, 'yyyy-MM-dd'));
  }, [user?.emp_id, user?.id, reportDates, fetchTimelineDates]);

  const { data, isLoading, error, refetch } = useAsync(fetchAttendance);

  // ── Attendance records (generated from real consultants + selected dates) ──
  const allConsultants = useMemo(() => {
    if (!data?.teamMembers) return [];

    return data.teamMembers
      .filter(m => m.is_active !== false && m.status !== 'inactive' && m.accountStatus !== 'inactive')
      .map(m => {
        const pPhoto = getTeamPhoto(m.emp_id) || m.photo_url_base64 || m.photo;
        return {
          id: m.emp_id,
          name: m.emp_name,
          team: m.team_name || 'Other',
          manager: '',
          location: '',
          phone: '',
          email: '',
          status: 'present',
          avatar: pPhoto || (m.emp_name ? m.emp_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
          designation: m.designation,
        };
      });
  }, [data?.teamMembers, getTeamPhoto]);

  const attendanceRecords = useMemo(() => {
    if (!allConsultants.length) return [];
    const calendarMap = (data?.calendar || []).reduce((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {});

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
            datesObj[dateStr] = CODE_LOOKUP[leaveDetail.leave_type] ? leaveDetail.leave_type : 'AL';
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

  const { onDutyConsultants, onLeaveConsultants, onWfhConsultants } = useMemo(() => {
    if (!allConsultants.length) return { onDutyConsultants: [], onLeaveConsultants: [], onWfhConsultants: [] };

    const todayStr = formatDateKey(today);
    const todayData = (data?.calendar || []).find(d => d.date === todayStr);

    // For Duty/WFH (which is strictly 'Today')
    const todayLeaveIds = new Set(todayData?.on_leave_details?.map(l => l.emp_id) || []);
    const wfhIds = new Set(todayData?.on_wfh_details?.map(l => l.emp_id) || []);

    // For Leaves (which should show any leave in the current calendar month)
    const allLeaveEmpIds = new Set();
    const leaveStatsForEmp = {};
    const allWfhEmpIds = new Set();
    const wfhStatsForEmp = {};

    (data?.calendar || []).forEach(day => {
      day.on_leave_details?.forEach(l => {
        allLeaveEmpIds.add(l.emp_id);
        if (!leaveStatsForEmp[l.emp_id]) {
          leaveStatsForEmp[l.emp_id] = { ...l, startDate: day.date, endDate: day.date, days: 1 };
        } else {
          leaveStatsForEmp[l.emp_id].days += 1;
          leaveStatsForEmp[l.emp_id].endDate = day.date; // Track latest date
        }
      });
      day.on_wfh_details?.forEach(l => {
        allWfhEmpIds.add(l.emp_id);
        if (!wfhStatsForEmp[l.emp_id]) {
          wfhStatsForEmp[l.emp_id] = { ...l, startDate: day.date, endDate: day.date, days: 1 };
        } else {
          wfhStatsForEmp[l.emp_id].days += 1;
          wfhStatsForEmp[l.emp_id].endDate = day.date;
        }
      });
    });

    const onDuty = [];
    const onLeave = [];
    const onWfhAll = [];

    allConsultants.forEach(c => {
      if (allLeaveEmpIds.has(c.id)) {
        const stats = leaveStatsForEmp[c.id];
        onLeave.push({
          consultantId: c.id,
          consultantName: c.name,
          team: c.team,
          leaveType: CODE_LOOKUP[stats.leave_type]?.label || stats.leave_type || 'Leave',
          startDate: stats.startDate,
          endDate: stats.endDate,
          days: stats.days,
          avatar: c.avatar
        });
      }
      if (allWfhEmpIds.has(c.id)) {
        const stats = wfhStatsForEmp[c.id];
        onWfhAll.push({
          consultantId: c.id,
          consultantName: c.name,
          team: c.team,
          leaveType: stats.leave_type || 'WFH',
          startDate: stats.startDate,
          endDate: stats.endDate,
          days: stats.days,
          avatar: c.avatar
        });
      }

      // On Duty Today excludes those on leave Today
      if (!todayLeaveIds.has(c.id)) {
        onDuty.push({
          ...c,
          status: wfhIds.has(c.id) ? 'remote' : 'present'
        });
      }
    });

    return { onDutyConsultants: onDuty, onLeaveConsultants: onLeave, onWfhConsultants: onWfhAll };
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
        avatar: d.photo_url_base64 || d.photo || allConsultants.find(c => c.id === d.emp_id)?.avatar || (d.emp_name ? d.emp_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?')
      }));
    }

    return source
      .filter(c => selectedTeam === 'all' || c.team === selectedTeam)
      .filter(c => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [onDutyConsultants, dutyData, selectedTeam, debouncedSearch, allConsultants]);

  const filteredOnLeaveTimeline = useMemo(() => {
    return onLeaveConsultants.filter(l => {
      if (selectedTeam !== 'all' && l.team !== selectedTeam) return false;
      if (!l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;

      return timelineDates.some(date => {
        const dateStr = formatDateKey(date);
        const dayData = data?.calendar?.find(d => d.date === dateStr);
        return dayData?.on_leave_details?.some(leave => leave.emp_id === l.consultantId);
      });
    });
  }, [onLeaveConsultants, selectedTeam, debouncedSearch, timelineDates, data?.calendar]);

  const filteredOnWfhTimeline = useMemo(() => {
    return onWfhConsultants.filter(l => {
      if (selectedTeam !== 'all' && l.team !== selectedTeam) return false;
      if (!l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;

      return timelineDates.some(date => {
        const dateStr = formatDateKey(date);
        const dayData = data?.calendar?.find(d => d.date === dateStr);
        return dayData?.on_wfh_details?.some(wfh => wfh.emp_id === l.consultantId);
      });
    });
  }, [onWfhConsultants, selectedTeam, debouncedSearch, timelineDates, data?.calendar]);

  const filteredOnLeaveTimelineNext30Count = useMemo(() => {
    return onLeaveConsultants.filter(l => {
      if (selectedTeam !== 'all' && l.team !== selectedTeam) return false;
      if (!l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return fetchTimelineDates.some(date => {
        const dateStr = formatDateKey(date);
        const dayData = data?.calendar?.find(d => d.date === dateStr);
        return dayData?.on_leave_details?.some(leave => leave.emp_id === l.consultantId);
      });
    }).length;
  }, [onLeaveConsultants, selectedTeam, debouncedSearch, fetchTimelineDates, data?.calendar]);

  const filteredOnWfhTimelineNext30Count = useMemo(() => {
    return onWfhConsultants.filter(l => {
      if (selectedTeam !== 'all' && l.team !== selectedTeam) return false;
      if (!l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return fetchTimelineDates.some(date => {
        const dateStr = formatDateKey(date);
        const dayData = data?.calendar?.find(d => d.date === dateStr);
        return dayData?.on_wfh_details?.some(wfh => wfh.emp_id === l.consultantId);
      });
    }).length;
  }, [onWfhConsultants, selectedTeam, debouncedSearch, fetchTimelineDates, data?.calendar]);

  const filteredOnLeaveList = useMemo(() => {
    let source = [];
    if (leaveData?.on_leave_details) {
      source = leaveData.on_leave_details.map(d => ({
        consultantId: d.emp_id,
        consultantName: d.emp_name,
        team: d.team_name || 'Other',
        leaveType: CODE_LOOKUP[d.leave_type]?.label || d.leave_type || 'Leave',
        startDate: leaveData.date,
        endDate: leaveData.date,
        days: 1,
        avatar: d.photo_url_base64 || d.photo || allConsultants.find(c => c.id === d.emp_id)?.avatar || (d.emp_name ? d.emp_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?')
      }));
    } else {
      const todayStr = formatDateKey(today);
      source = onLeaveConsultants.filter(l => l.startDate === todayStr);
    }

    return source.filter(l =>
      (selectedTeam === 'all' || l.team === selectedTeam) &&
      l.consultantName.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );
  }, [onLeaveConsultants, leaveData, selectedTeam, debouncedSearch, today, allConsultants]);

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

  const displayOnDuty = useMemo(() => {
    let source = filteredOnDuty;
    if (activeKPI === 'present') {
      source = filteredOnDuty.filter(c => c.status === 'present');
    } else if (activeKPI === 'wfh') {
      source = filteredOnDuty.filter(c => c.status === 'remote');
    } else if (activeKPI === 'leave') {
      source = filteredOnLeaveList.map(l => ({
        id: l.consultantId,
        name: l.consultantName,
        team: l.team,
        status: 'leave',
        manager: 'Manager',
        location: l.leaveType,
        phone: 'N/A',
        email: 'N/A',
        avatar: l.avatar
      }));
    } else if (activeKPI === 'total' || activeKPI === 'attendance') {
      const leaveSource = filteredOnLeaveList.map(l => ({
        id: l.consultantId,
        name: l.consultantName,
        team: l.team,
        status: 'leave',
        manager: 'Manager',
        location: l.leaveType,
        phone: 'N/A',
        email: 'N/A',
        avatar: l.avatar
      }));
      source = [...filteredOnDuty, ...leaveSource];
    } else if (activeKPI === 'absent') {
      source = [];
    }
    return source;
  }, [filteredOnDuty, filteredOnLeaveList, activeKPI]);

  const groupedOnDuty = useMemo(() => groupByTeam(displayOnDuty), [displayOnDuty, groupByTeam]);

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
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  }, []);

  const getLeaveTypeColor = useCallback(type => {
    const map = {
      'Annual Leave': '#93c5fd', 'AL': '#93c5fd',
      'Sick Leave': '#fca5a5', 'SL': '#fca5a5',
      'Comp Off': '#c4b5fd', 'CompOff': '#c4b5fd',
      'Work From Home': '#86efac', 'WFH': '#86efac',
      'Offshore Work': '#60a5fa', 'OW': '#60a5fa',
      'Compressed Work Week': '#fde047', 'CWW': '#fde047'
    };
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
  }, [filteredReportRows, reportDates, filterYear, filterMonth]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(filteredReportRows, reportDates, `attendance_${filterYear}_${MONTH_NAMES[Number(filterMonth)]}.pdf`);
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

  // ── Render Avatar Helper ──
  const renderAvatar = (avatarData, name) => {
    if (!avatarData || avatarData === '?' || avatarData === 'null') {
      return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
    }
    const imgStyle = { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#ffffff' };
    
    let src = avatarData;
    if (typeof src === 'string') {
      src = src.replace(/\s+/g, '');
      if (!src || src === 'null') {
          return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
      }
      if (src.startsWith('data:image') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
        // Use as-is
      } else if (src.startsWith('/')) {
        const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '');
        src = `${apiOrigin}${src}`;
      } else if (src.length > 100) {
        src = `data:image/jpeg;base64,${src}`;
      } else {
        return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
      }
    }
    
    return <img src={src} alt={name} style={imgStyle} />;
  };

  return (
    <div className="attendance-page">

      {/* ── Sub-tabs ── */}
      <div className="attendance-subtabs">
        {['on-duty', 'on-wfh', 'on-leave', 'report'].map(id => (
          <button
            key={id}
            ref={el => (tabsRef.current[id] = el)}
            className="attendance-subtab"
            data-active={subTab === id}
            onClick={() => setSubTab(id)}
          >
            {id === 'on-duty' && <Users className="attendance-subtab-icon" />}
            {id === 'on-wfh' && <Home className="attendance-subtab-icon" />}
            {id === 'on-leave' && <Calendar className="attendance-subtab-icon" />}
            {id === 'report' && <FileText className="attendance-subtab-icon" />}
            <span className="attendance-subtab-label">
              {id === 'on-duty' && 'On Duty'}
              {id === 'on-wfh' && 'WFH'}
              {id === 'on-leave' && 'On Leave'}
              {id === 'report' && 'Full Report'}
            </span>
          </button>
        ))}
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

        {/* View toggle — not on On Duty */}
        {subTab !== 'on-duty' && (
          <div className="attendance-view-switcher">
            <button
              className={`attendance-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
            >List</button>
            {(subTab === 'on-leave' || subTab === 'on-wfh') && (
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
        {canExport && (
          <ExportButton
            excel
            pdf
            onExcelExport={handleExportCSV}
            onPdfExport={handleExportPDF}
          />
        )}
      </div>

      {/* ── KPI Cards — On Duty tab only ── */}
      {subTab === 'on-duty' && (
        <div className="attendance-kpi-section">
          {[
            { key: 'total', icon: <Users size={20} />, color: 'blue', count: filteredOnDuty.length + filteredOnLeaveList.length, label: 'Total Consultants' },
            { key: 'present', icon: <Building2 size={20} />, color: 'green', count: filteredOnDuty.filter(c => c.status === 'present').length, label: 'Present (Office)' },
            { key: 'wfh', icon: <Home size={20} />, color: 'blue', count: filteredOnDuty.filter(c => c.status === 'remote').length, label: 'Work From Home' },
            { key: 'leave', icon: <Clock size={20} />, color: 'amber', count: filteredOnLeaveList.length, label: 'On Leave' },
            { key: 'absent', icon: <AlertCircle size={20} />, color: 'red', count: 0, label: 'Absent / Not Marked' },
            { key: 'attendance', icon: <Percent size={20} />, color: 'green', count: `${Math.round(filteredOnDuty.length / Math.max(filteredOnDuty.length + filteredOnLeaveList.length, 1) * 100)}%`, label: 'Attendance %' },
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
            {dutyError && (
              <div className="attendance-inline-error">
                <AlertCircle size={16} />
                <span>Could not load today&apos;s live status; showing data from the attendance calendar instead.</span>
              </div>
            )}
            {Object.entries(groupedOnDuty).map(([team, consultants]) => {
              const isExpanded = !collapsedTeams.has(team) || Boolean(debouncedSearch.trim());
              return (
              <div key={team} className="attendance-team-group">
                <button className="attendance-team-header" onClick={() => toggleTeam(team)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="attendance-team-name">{team.charAt(0).toUpperCase() + team.slice(1)}</span>
                  <span className="attendance-team-badge">{consultants.length}</span>
                </button>
                {isExpanded && (
                  <div className="attendance-team-content">
                    {consultants.map(c => (
                      <div key={c.id} className="attendance-consultant-row">
                        <div className="attendance-consultant-main">
                          <div className="attendance-consultant-avatar">{renderAvatar(c.avatar, c.name)}</div>
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
            );
            })}
            {displayOnDuty.length === 0 && (
              <div className="attendance-empty">
                <User size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants found for this filter</p>
              </div>
            )}
          </div>
        )}

        {/* On WFH — Timeline */}
        {subTab === 'on-wfh' && viewMode === 'timeline' && (
          <div className="attendance-timeline-wrapper">
            <div className="att-timeline-folder-tabs">
              <button
                className="att-folder-tab"
                data-active={onWfhTimelineFilter === 'next30'}
                onClick={() => setOnWfhTimelineFilter('next30')}
              >
                <span className="att-folder-tab-label">Next 30 Days</span>
                <span className="att-folder-tab-badge">{filteredOnWfhTimelineNext30Count}</span>
              </button>
              <button
                className="att-folder-tab"
                data-active={onWfhTimelineFilter === 'today'}
                onClick={() => setOnWfhTimelineFilter('today')}
              >
                <span className="att-folder-tab-label">Today</span>
              </button>
              <button
                className="att-folder-tab"
                data-active={onWfhTimelineFilter === 'tomorrow'}
                onClick={() => setOnWfhTimelineFilter('tomorrow')}
              >
                <span className="att-folder-tab-label">Tomorrow</span>
              </button>
            </div>

            <div className="attendance-timeline">
              <div style={{ minWidth: 'max-content', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="attendance-timeline-header">
                  <div className="attendance-timeline-consultant-col">CONSULTANT</div>
                  <div className="attendance-timeline-dates">
                    {timelineDates.map((date, idx) => (
                      <div key={idx} className="attendance-timeline-date">
                        <div className="attendance-timeline-date-day">{date.getDate()}</div>
                        <div className="attendance-timeline-date-month">{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="attendance-timeline-body">
                  {Object.entries(
                    filteredOnWfhTimeline.reduce((acc, curr) => {
                      const t = curr.team || 'Other';
                      if (!acc[t]) acc[t] = [];
                      acc[t].push(curr);
                      return acc;
                    }, {})
                  ).map(([teamName, members]) => (
                    <div key={teamName} className="attendance-timeline-team-group">
                      <div
                        className="attendance-timeline-team-header"
                        style={{ backgroundColor: '#ecfeff', border: '1px solid #cffafe', color: '#164e63', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px' }}
                      >
                        <div className="att-team-header-icon" style={{ color: '#06b6d4', display: 'flex', alignItems: 'center' }}><TeamIcon size={20} /></div>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{teamName}</span>
                      </div>
                      {members.map(leave => (
                        <div key={leave.consultantId} className="attendance-timeline-row">
                          <div className="attendance-timeline-consultant">
                            <div className="attendance-timeline-consultant-avatar">
                              {renderAvatar(leave.avatar, leave.consultantName)}
                            </div>
                            <div className="attendance-timeline-consultant-info">
                              <div className="attendance-timeline-consultant-name">{leave.consultantName}</div>
                              <div className="attendance-timeline-consultant-team">{leave.team}</div>
                            </div>
                          </div>
                          <div className="attendance-timeline-bars">
                            {timelineDates.map((date, idx) => {
                              const dateStr = formatDateKey(date);
                              const dayData = data?.calendar?.find(d => d.date === dateStr);
                              const wfhDetail = dayData?.on_wfh_details?.find(l => l.emp_id === leave.consultantId);
                              const inLeave = !!wfhDetail;
                              return (
                                <div
                                  key={idx}
                                  className={`attendance-timeline-cell${inLeave ? ' attendance-timeline-has-leave' : ''}`}
                                >
                                  {inLeave && (
                                    <div title={`WFH – ${leave.days} days`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                      <span className="attendance-timeline-leave-pill" style={{ color: '#06b6d4', border: '1px solid #06b6d4', backgroundColor: 'transparent', width: 'auto', padding: '2px 8px', height: 'auto', minHeight: '22px' }}>WFH</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {filteredOnWfhTimeline.length === 0 && (
              <div className="attendance-empty">
                <Briefcase size={48} className="attendance-empty-icon" />
                <p className="attendance-empty-text">No consultants on WFH</p>
              </div>
            )}
          </div>
        )}

        {/* On WFH — List */}
        {subTab === 'on-wfh' && viewMode === 'list' && (
          <div className="attendance-list">
            {wfhError && (
              <div className="attendance-inline-error">
                <AlertCircle size={16} />
                <span>Could not load today&apos;s WFH status.</span>
              </div>
            )}
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
                          {renderAvatar(c.photo_url_base64 || c.photo || allConsultants.find(x => x.id === c.emp_id)?.avatar, c.emp_name)}
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
            {/* Timeline Filters - Folder Tabs */}
            <div className="att-timeline-folder-tabs">
              <button
                className="att-folder-tab"
                data-active={onLeaveTimelineFilter === 'next30'}
                onClick={() => setOnLeaveTimelineFilter('next30')}
              >
                <span className="att-folder-tab-label">Next 30 Days</span>
                <span className="att-folder-tab-badge">{filteredOnLeaveTimelineNext30Count}</span>
              </button>
              <button
                className="att-folder-tab"
                data-active={onLeaveTimelineFilter === 'today'}
                onClick={() => setOnLeaveTimelineFilter('today')}
              >
                <span className="att-folder-tab-label">Today</span>
              </button>
              <button
                className="att-folder-tab"
                data-active={onLeaveTimelineFilter === 'tomorrow'}
                onClick={() => setOnLeaveTimelineFilter('tomorrow')}
              >
                <span className="att-folder-tab-label">Tomorrow</span>
              </button>
            </div>

            <div className="attendance-timeline">
              <div style={{ minWidth: 'max-content', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="attendance-timeline-header">
                  <div className="attendance-timeline-consultant-col">CONSULTANT</div>
                  <div className="attendance-timeline-dates">
                    {timelineDates.map((date, idx) => (
                      <div key={idx} className="attendance-timeline-date">
                        <div className="attendance-timeline-date-day">{date.getDate()}</div>
                        <div className="attendance-timeline-date-month">{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="attendance-timeline-body">
                  {Object.entries(
                    filteredOnLeaveTimeline.reduce((acc, curr) => {
                      const t = curr.team || 'Other';
                      if (!acc[t]) acc[t] = [];
                      acc[t].push(curr);
                      return acc;
                    }, {})
                  ).map(([teamName, members]) => (
                    <div key={teamName} className="attendance-timeline-team-group">
                      <div
                        className="attendance-timeline-team-header"
                        style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px' }}
                      >
                        <div className="att-team-header-icon" style={{ color: '#0ea5e9', display: 'flex', alignItems: 'center' }}><TeamIcon size={20} /></div>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{teamName}</span>
                      </div>
                      {members.map(leave => (
                        <div key={leave.consultantId} className="attendance-timeline-row">
                          <div className="attendance-timeline-consultant">
                            <div className="attendance-timeline-consultant-avatar">
                              {renderAvatar(leave.avatar, leave.consultantName)}
                            </div>
                            <div className="attendance-timeline-consultant-info">
                              <div className="attendance-timeline-consultant-name">{leave.consultantName}</div>
                              <div className="attendance-timeline-consultant-team">{leave.team}</div>
                            </div>
                          </div>
                          <div className="attendance-timeline-bars">
                            {timelineDates.map((date, idx) => {
                              const dateStr = formatDateKey(date);
                              const dayData = data?.calendar?.find(d => d.date === dateStr);
                              const leaveDetail = dayData?.on_leave_details?.find(l => l.emp_id === leave.consultantId);
                              const inLeave = !!leaveDetail;
                              const lType = leaveDetail?.leave_type || leave.leaveType;
                              return (
                                <div
                                  key={idx}
                                  className={`attendance-timeline-cell${inLeave ? ' attendance-timeline-has-leave' : ''}`}
                                >
                                  {inLeave && (
                                    <div title={`${lType} – ${leave.days} days`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                      <StatusBadge code={lType} variant="outline" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {filteredOnLeaveTimeline.length === 0 && (
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
            {leaveError && (
              <div className="attendance-inline-error">
                <AlertCircle size={16} />
                <span>Could not load today&apos;s live leave status; showing data from the attendance calendar instead.</span>
              </div>
            )}
            {filteredOnLeaveList.map(leave => (
              <div key={leave.consultantId} className="attendance-leave-card">
                <div className="attendance-leave-main">
                  <div className="attendance-consultant-avatar">
                    {renderAvatar(leave.avatar, leave.consultantName)}
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
            {filteredOnLeaveList.length === 0 && (
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
                  ? `${filterDateRange.from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${filterDateRange.to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
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
                            <span className="att-date-dow">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
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
                          <div className="attendance-consultant-avatar att-avatar-sm">{renderAvatar(consultant.avatar, consultant.name)}</div>
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
                    <div className="attendance-consultant-avatar">{renderAvatar(consultant.avatar, consultant.name)}</div>
                    <div className="attendance-card-info">
                      <div className="attendance-consultant-name">{consultant.name}</div>
                      <div className="attendance-consultant-team">{consultant.team}</div>
                    </div>
                    <div className="attendance-card-badge" style={{
                      backgroundColor: 'var(--surface-tertiary)',
                      color: 'var(--status-success)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '12px'
                    }}>
                      {percentage}%
                    </div>
                  </div>
                  
                  <div className="attendance-card-ring-wrapper">
                    <div className="attendance-card-ring">
                      <svg className="attendance-ring-svg" viewBox="0 0 100 100">
                        <circle className="attendance-ring-bg" cx="50" cy="50" r="42" fill="none" stroke="var(--surface-tertiary)" strokeWidth="6" />
                        <circle
                          className="attendance-ring-progress"
                          cx="50" cy="50" r="42" fill="none" stroke="url(#gradient-success)" strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 42}
                          strokeDashoffset={2 * Math.PI * 42 * (1 - percentage / 100)}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                        <defs>
                          <linearGradient id="gradient-success" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--status-success)" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="attendance-ring-text">
                        <div className="attendance-ring-percentage">{percentage}%</div>
                        <div className="attendance-ring-label">Present</div>
                      </div>
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
                  <div className="attendance-card-sparkline" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 500 }}>
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
