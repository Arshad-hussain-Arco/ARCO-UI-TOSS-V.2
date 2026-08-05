import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Download, Filter } from 'lucide-react';
import { addDays, format } from 'date-fns';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAuth } from '@hooks/useAuth';
import httpClient from '@api/httpClient';

import { AlertsPanel } from './sections/AlertsPanel';
import { CapacitySection } from './sections/CapacitySection';
import { DocumentsActivitySection } from './sections/DocumentsActivitySection';
import { KpiStrip } from './sections/KpiStrip';
import { LeaveSnapshotSection } from './sections/LeaveSnapshotSection';
import { ProjectRiskSection } from './sections/ProjectRiskSection';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { RequestsTrendChart } from '@components/dashboard/charts/RequestsTrendChart';
import { EnvironmentStatusStrip } from './sections/EnvironmentStatusStrip';
import { DepartmentStatsSection } from './sections/DepartmentStatsSection';
import { TeamHeadcountSection } from './sections/TeamHeadcountSection';
import { PendingApprovalsActionSection } from './sections/PendingApprovalsActionSection';
import { UpcomingHolidaysPanel } from './sections/UpcomingHolidaysPanel';
import { leaveService } from '@services/leaveService';
import { dashboardService } from '@services/dashboardService';
import { consultantService } from '@services/consultantService';
import { eodService } from '@services/eodService';
import { capacityService } from '@services/capacityService';
import './DashboardPage.css';

/**
 * Operations dashboard.
 *
 * Modified to consume 9 live Django REST Framework endpoints instead of a mock service.
 * Adapter logic morphs the raw real-time data into the prop shapes expected by the layout.
 */
export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();

  const [dateFilter, setDateFilter] = useState('today');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw API states
  const [apiSummary, setApiSummary] = useState(null);
  const [eodRecords, setEodRecords] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveUtilization, setLeaveUtilization] = useState([]);
  const [announcements, setAnnouncements] = useState({ banner: [], feed: [] });
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [capacityRecords, setCapacityRecords] = useState([]);
  const [trendData, setTrendData] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [onLeaveRecords, setOnLeaveRecords] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);

  const fetchLiveDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const empId = user?.employee_id || user?.emp_id || user?.id;

      const today = new Date();
      const nextWeek = addDays(today, 7);
      const startStr = format(today, 'yyyy-MM-dd');
      const endStr = format(nextWeek, 'yyyy-MM-dd');

      const promises = [
        dashboardService.getSummary(),
        dashboardService.getLeaveUtilization(),
        eodService.getEodRecords(),
        httpClient.get('/employees/teams/'),
        consultantService.getEmployeesList(),
        dashboardService.getAnnouncements(),
        capacityService.getCapacityPlanning(),
        dashboardService.getLeaveRequestsTrend({ days: 7 }),
        dashboardService.getDepartmentStats(),
        dashboardService.getOnLeave({ start_date: startStr, end_date: endStr }),
        leaveService.listHolidays(),
      ];

      if (empId) {
        promises.push(dashboardService.getPendingApprovals({ manager_id: empId }));
      }

      const results = await Promise.allSettled(promises);

      // Extract results since service methods return response.data directly
      if (results[0]?.status === 'fulfilled') setApiSummary(results[0].value);
      if (results[1]?.status === 'fulfilled') setLeaveUtilization(results[1].value);
      if (results[2]?.status === 'fulfilled') {
        const data = results[2].value;
        setEodRecords(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[3]?.status === 'fulfilled') {
        const data = results[3].value.data; // Still using httpClient for teams
        setTeams(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[4]?.status === 'fulfilled') {
        const data = results[4].value;
        setEmployees(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[5]?.status === 'fulfilled') setAnnouncements(results[5].value);
      if (results[6]?.status === 'fulfilled') {
        const data = results[6].value;
        setCapacityRecords(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[7]?.status === 'fulfilled') setTrendData(results[7].value);
      if (results[8]?.status === 'fulfilled') {
        const data = results[8].value;
        setDepartmentStats(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[9]?.status === 'fulfilled') {
        const data = results[9].value;
        setOnLeaveRecords(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[10]?.status === 'fulfilled') {
        // listHolidays already returns response.data directly
        const data = results[10].value;
        const holidaysArr = Array.isArray(data) ? data : data?.results || [];

        // Filter and sort for upcoming holidays only
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = holidaysArr
          .filter(h => {
            const dateStr = h.dates && h.dates.length > 0 ? h.dates[0] : (h.date || h.start_date || h.holiday_date);
            if (!dateStr) return false;
            const hDate = new Date(dateStr);
            return hDate >= today;
          })
          .sort((a, b) => {
            const aDate = a.dates && a.dates.length > 0 ? a.dates[0] : (a.date || a.start_date || a.holiday_date);
            const bDate = b.dates && b.dates.length > 0 ? b.dates[0] : (b.date || b.start_date || b.holiday_date);
            return new Date(aDate) - new Date(bDate);
          })
          .slice(0, 4); // Take top 4

        setUpcomingHolidays(upcoming);
      }
      if (empId && results[11]?.status === 'fulfilled') {
        const data = results[11].value;
        setPendingApprovals(Array.isArray(data) ? data : data?.results || []);
      }
    } catch (e) {
      console.error('Live Dashboard API error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLiveDashboardData();
  }, [fetchLiveDashboardData]);

  // ───────────────────────────────────────────────────────────────────────────
  // ADAPTER: Morph live API data into the exact shapes expected by the sections
  // ───────────────────────────────────────────────────────────────────────────

  const mappedSummary = useMemo(() => {
    if (!apiSummary) return null;

    // Derived counts
    const totalEmps = apiSummary.total_employees ?? 0;
    const activeEmps = apiSummary.active_employees ?? 0;
    const presentEmps = apiSummary.present_count ?? 0;
    const leaveEmps = apiSummary.employees_on_leave_today ?? 0;
    const wfhEmps = apiSummary.wfh_count ?? 0;

    const eodActiveCount = eodRecords.filter(r => r.is_active === 'Yes' || r.is_active === 1 || r.is_active === true).length;
    const eodTotal = eodRecords.length;
    const eodRunning = Math.max(0, eodTotal - eodActiveCount);

    // 1. KPI Strip
    const kpis = [
      { id: 'k1', count: totalEmps, label: 'Total Consultants', subtext: 'Realtime Live Data', iconKey: 'users', color: 'blue' },
      { id: 'k2', count: presentEmps, label: 'Active Consultants', subtext: 'Realtime Live Data', iconKey: 'building', color: 'green', trend: 'up' },
      { id: 'k3', count: leaveEmps, label: 'On Leave', subtext: 'Realtime Live Data', iconKey: 'clock', color: 'amber' },
      { id: 'k4', count: wfhEmps, label: 'Work From Home', subtext: 'Realtime Live Data', iconKey: 'home', color: 'blue' },
      { id: 'k5', count: totalEmps - activeEmps, label: 'Inactive', subtext: 'Realtime Live Data', iconKey: 'userMinus', color: 'grey' },
    ];

    // 2. System Health
    const systemHealth = {
      murexJobs: { total: 0, failed: 0 },
      eodStatus: { completed: eodTotal > 0 ? (eodTotal - eodRunning) : 0, total: eodTotal, running: eodRunning },
      avgRuntime: { time: 'N/A', change: '0%' }
    };

    // 3. Runtime Trend (Fallback static for chart demo as we don't have historical runtime live yet)
    const runtimeTrend = [
      { day: 'Mon', runtime: 85, failed: 0 },
      { day: 'Tue', runtime: 90, failed: 2 },
      { day: 'Wed', runtime: 120, failed: 0 },
      { day: 'Thu', runtime: 110, failed: 1 },
      { day: 'Fri', runtime: 95, failed: 0 },
    ];
    const runtimeInsights = { longest: { script: 'EOD', duration: '120m' }, mostFailed: 'N/A', slaThreshold: 100 };

    // 4. Leave Snapshot
    const leaveDistribution = Array.isArray(leaveUtilization?.results) && leaveUtilization.results.length > 0
      ? leaveUtilization.results.map((item, idx) => ({
        type: item.leave_type_name || item.leave_type_code || 'Other',
        count: item.total_applications || item.total_days_used || 0,
        color: ['#1e40af', '#92400e', '#5b21b6', '#065f46'][idx % 4] || '#4f7cff',
      }))
      : [];

    const attendanceStatus = [
      { label: 'Present', percentage: activeEmps ? Math.round((presentEmps / activeEmps) * 100) : 0, count: presentEmps },
      { label: 'Work From Home', percentage: activeEmps ? Math.round((wfhEmps / activeEmps) * 100) : 0, count: wfhEmps },
      { label: 'On Leave', percentage: activeEmps ? Math.round((leaveEmps / activeEmps) * 100) : 0, count: leaveEmps }
    ];

    const upcomingLeaves = onLeaveRecords.map(r => {
      // Create a nice date string (e.g. Aug 05 - Aug 07 or just Aug 05)
      const isSameDate = r.start_date === r.end_date;
      const startFmt = r.start_date ? format(new Date(r.start_date), 'MMM dd') : '';
      const endFmt = r.end_date ? format(new Date(r.end_date), 'MMM dd') : '';
      const dateStr = isSameDate ? startFmt : `${startFmt} - ${endFmt}`;

      return {
        id: String(r.leave_id || r.id || Math.random()),
        name: r.emp_name || 'Unknown',
        date: dateStr,
        type: r.leave_type || 'Leave'
      };
    });

    // 5. Alerts
    const alerts = [
      ...announcements.banner.map(a => ({ id: `a-${a.id}`, severity: 'warning', text: a.title, iconKey: 'alertCircle' }))
    ];

    const quickStats = [
      { id: 'qs1', label: 'Pending Approvals', value: String(pendingApprovals.length), tone: 'amber' },
      { id: 'qs2', label: 'Open Issues', value: '0', tone: 'green' }
    ];

    // 6. Capacity By Team
    // Group records by TeamName, sum Effort_in_MDs
    const capacityMap = {};
    capacityRecords.forEach(record => {
      const team = record.TeamName || 'Unassigned';
      if (!capacityMap[team]) {
        capacityMap[team] = { team, used: 0, available: 100 }; // Mock available capacity to 100 MDs for demo
      }
      const effort = parseFloat(record.Effort_in_MDs) || 0;
      capacityMap[team].used += effort;
    });

    // Convert map to array and compute percentage
    const capacityByTeam = Object.values(capacityMap).map(c => ({
      team: c.team,
      used: Math.round(c.used),
      available: c.available,
      percentage: Math.min(100, Math.round((c.used / c.available) * 100))
    }));

    return {
      kpis,
      systemHealth,
      runtimeTrend,
      runtimeInsights,
      leaveDistribution,
      upcomingLeaves,
      attendanceStatus,
      capacityByTeam,
      projectRisk: { total: 0, atRisk: 0, offTrack: 0 },
      projectsByStatus: [],
      documents: { total: 0, updated: 0, mostViewed: [] },
      recentActivity: [],
      alerts,
      quickStats,
    };
  }, [apiSummary, eodRecords, leaveUtilization, announcements, pendingApprovals, capacityRecords, onLeaveRecords]);

  // 6. Team Headcount
  const mappedTeams = useMemo(() => {
    if (!teams.length || !employees.length) return [];
    return teams.map(t => {
      const teamEmps = employees.filter(e => e.team_id === t.id || e.team_name === t.name);
      const total = teamEmps.length;
      const wfh = teamEmps.filter(e => String(e.location).toUpperCase().includes('WFH')).length;
      const active = total - wfh; // Simplified logic for demo
      return {
        team_id: t.id,
        team_name: t.name || 'Team',
        total,
        active,
        on_leave: 0,
        wfh
      };
    });
  }, [teams, employees]);


  const userName = user?.name || user?.username || 'User';

  return (
    <div className="dc-root">
      <div className="dc-page-header">
        <div>
          <h1 className="dc-page-title">Welcome, {userName}!</h1>
          <p className="dc-page-sub">Here is your real-time overview of system health, team performance, and key operational metrics.</p>
        </div>

        <div className="dc-header-actions">
          <div className="dc-filter-pill">
            <Filter size={12} />
            <Select value={dateFilter} onChange={setDateFilter} options={[{ label: 'Today', value: 'today' }]} width="dateRange" />
          </div>
          <button type="button" className="dc-export-btn">
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      <div className="dc-body">
        {error ? (
          <ErrorState
            title="The dashboard could not be loaded"
            description={error.message || String(error)}
            onRetry={fetchLiveDashboardData}
          />
        ) : loading || !mappedSummary ? (
          <Loader message="Loading live dashboard…" />
        ) : (
          <>
            <div className="dc-main">
              {/* EOD Environment Status Strip */}
              <div className="dc-layout-grid">
                {/* LEFT COLUMN / FULL WIDTH ITEMS */}
                <div className="dc-main-col">
                  <div className="dc-span-12">
                    <KpiStrip kpis={mappedSummary.kpis} />
                  </div>

                  <div className="dc-span-12">
                    <EnvironmentStatusStrip eodRecords={eodRecords} />
                  </div>

                  <SystemHealthSection
                    systemHealth={mappedSummary.systemHealth}
                    runtimeTrend={mappedSummary.runtimeTrend}
                    insights={mappedSummary.runtimeInsights}
                  />



                  <div className="dc-span-12">
                    <LeaveSnapshotSection
                      leaveDistribution={mappedSummary.leaveDistribution}
                      upcomingLeaves={mappedSummary.upcomingLeaves}
                      attendanceStatus={mappedSummary.attendanceStatus}
                    />
                  </div>

                  {mappedSummary.capacityByTeam.length > 0 && (
                    <div className="dc-span-6">
                      <CapacitySection capacityByTeam={mappedSummary.capacityByTeam} />
                    </div>
                  )}

                  {mappedTeams && mappedTeams.length > 0 && (
                    <div className="dc-span-6">
                      <TeamHeadcountSection teams={mappedTeams} />
                    </div>
                  )}
                </div>

                {mappedSummary.projectsByStatus.length > 0 && (
                  <div className="dc-span-6">
                    <ProjectRiskSection
                      projectRisk={mappedSummary.projectRisk}
                      projectsByStatus={mappedSummary.projectsByStatus}
                    />
                  </div>
                )}

                {mappedSummary.documents.total > 0 && (
                  <div className="dc-span-6">
                    <DocumentsActivitySection
                      documents={mappedSummary.documents}
                      recentActivity={mappedSummary.recentActivity}
                    />
                  </div>
                )}
              </div>
            </div>

            <aside className="dc-right-rail">
              <AlertsPanel alerts={mappedSummary.alerts} quickStats={mappedSummary.quickStats} />

              <UpcomingHolidaysPanel holidays={upcomingHolidays} />

              {pendingApprovals && pendingApprovals.length > 0 && (
                <PendingApprovalsActionSection
                  pendingApprovals={pendingApprovals}
                  onActionComplete={fetchLiveDashboardData}
                />
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
