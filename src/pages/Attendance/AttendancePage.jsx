import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Home,
  Clock,
  AlertCircle,
  Percent,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { StatsRowSkeleton, TableSkeleton } from '@components/feedback/Skeleton';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Tabs } from '@components/common';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { format } from 'date-fns';
import { attendanceService } from '@services/attendanceService';
import { leaveService } from '@services/leaveService';
import { activatable } from '@utils/interactive';

import { MONTH_NAMES, MONTH_OPTIONS, YEAR_OPTIONS, ATTENDANCE_CODE_MAP } from './constants';
import { generateDates, getMonthDates, formatDateKey, calcStats, exportToCSV } from './utils';
import { OnDutyToday } from './components/OnDutyToday';
import { OnWfhToday } from './components/OnWfhToday';
import { OnLeave } from './components/OnLeave';
import { AttendanceReport } from './components/AttendanceReport';

import './AttendancePage.css';

const SUB_TABS = ['on-duty', 'on-wfh', 'on-leave', 'report'];
const SUB_TAB_LABELS = {
  'on-duty': 'On Duty Today',
  'on-wfh': 'On WFH Today',
  'on-leave': 'On Leave',
  report: 'Attendance Report',
};

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
  if (isLoading || !data) {
    return (
      <div className="attendance-page">
        <StatsRowSkeleton count={6} />
        <TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="attendance-page">

      {/* ── Sub-tabs ── */}
      <Tabs
        tabs={SUB_TABS.map((id) => ({ id, label: SUB_TAB_LABELS[id] }))}
        activeTab={subTab}
        onChange={setSubTab}
      />

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
          />
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
            { key: 'total',      icon: <Users size={20} />,        color: 'blue',  count: onDutyConsultants.length + onLeaveConsultants.length, label: 'Total Consultants' },
            { key: 'present',    icon: <Building2 size={20} />,    color: 'green', count: onDutyConsultants.filter(c => c.status === 'present').length, label: 'Present (Office)' },
            { key: 'wfh',        icon: <Home size={20} />,         color: 'blue',  count: onDutyConsultants.filter(c => c.status === 'remote').length, label: 'Work From Home' },
            { key: 'leave',      icon: <Clock size={20} />,        color: 'amber', count: onLeaveConsultants.length, label: 'On Leave' },
            { key: 'absent',     icon: <AlertCircle size={20} />,  color: 'red',   count: 0, label: 'Absent / Not Marked' },
            { key: 'attendance', icon: <Percent size={20} />,      color: 'green', count: `${Math.round(onDutyConsultants.length / Math.max(onDutyConsultants.length + onLeaveConsultants.length, 1) * 100)}%`, label: 'Attendance %' },
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
        {subTab === 'on-duty' && (
          <OnDutyToday
            groupedOnDuty={groupedOnDuty}
            expandedTeams={expandedTeams}
            toggleTeam={toggleTeam}
            getStatusBadgeClass={getStatusBadgeClass}
            isEmpty={filteredOnDuty.length === 0}
          />
        )}

        {subTab === 'on-wfh' && (
          <OnWfhToday isWfhLoading={isWfhLoading} wfhData={wfhData} />
        )}

        {subTab === 'on-leave' && (
          <OnLeave
            viewMode={viewMode}
            timelineDates={timelineDates}
            filteredOnLeave={filteredOnLeave}
            calendar={data?.calendar}
            getLeaveTypeColor={getLeaveTypeColor}
          />
        )}

        {subTab === 'report' && (
          <AttendanceReport
            viewMode={viewMode}
            filterDateRange={filterDateRange}
            filterMonth={filterMonth}
            filterYear={filterYear}
            handleClearDateRange={handleClearDateRange}
            filteredReportRows={filteredReportRows}
            reportDates={reportDates}
            isWeekend={isWeekend}
            codesUsed={codesUsed}
          />
        )}
      </div>
    </div>
  );
}

export default AttendancePage;
