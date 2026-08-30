import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Calendar, User, Search, Play } from 'lucide-react';
import { addDays, format } from 'date-fns';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAuth } from '@hooks/useAuth';
import httpClient from '@api/httpClient';

import { AlertsPanel } from './sections/AlertsPanel';
import { CapacitySection } from './sections/CapacitySection';
import { DocumentsActivitySection } from './sections/DocumentsActivitySection';
import { KpiStrip } from './sections/KpiStrip';
import { LeaveSnapshotSection } from './sections/LeaveSnapshotSection';
import { ProjectRiskSection } from './sections/ProjectRiskSection';
import { TeamAvailabilityOverview } from './sections/TeamAvailabilityOverview';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { RequestsTrendChart } from '@components/dashboard/charts/RequestsTrendChart';
import { EnvironmentStatusStrip } from './sections/EnvironmentStatusStrip';
import { DepartmentStatsSection } from './sections/DepartmentStatsSection';
import { PendingApprovalsActionSection } from './sections/PendingApprovalsActionSection';
import { UpcomingHolidaysPanel } from './sections/UpcomingHolidaysPanel';
import { EmployeeCapacitySection } from './sections/EmployeeCapacitySection';
import { leaveService } from '@services/leaveService';
import { dashboardService } from '@services/dashboardService';
import { consultantService } from '@services/consultantService';
import { eodService } from '@services/eodService';
import { capacityService } from '@services/capacityService';
import { murexService } from '@services/murexService';
import { documentService } from '@services/documentService';
import { processCapacityData } from '../CapacityPlanning/capacityCalculations';
import './DashboardPage.css';

/**
 * Operations dashboard.
 *
 * Modified to consume 9 live Django REST Framework endpoints instead of a mock service.
 * Adapter logic morphs the raw real-time data into the prop shapes expected by the layout.
 */
export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, hasPermission } = useAuth();

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
  const [murexData, setMurexData] = useState(null);
  const [orgPhotos, setOrgPhotos] = useState([]);
  const [documentData, setDocumentData] = useState({ files: [], folderTree: [] });

  const fetchLiveDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const empId = user?.employee_id || user?.emp_id || user?.id;

      const today = new Date();
      const nextWeek = addDays(today, 7);
      const startStr = format(today, 'yyyy-MM-dd');
      const endStr = format(nextWeek, 'yyyy-MM-dd');

      const hasEODView = hasPermission('EOD_OVERVIEW_VIEW');
      const hasMurexView = hasPermission('MUREX_RUNTIME_VIEW');
      const hasCapacityView = hasPermission('CAPACITY_PLANNING_VIEW');
      const hasAttendanceView = hasPermission('ATTENDANCE_VIEW');
      const hasTeamView = hasPermission('TEAMS_VIEW') || hasPermission('EMPLOYEE_VIEW');
      const hasDocumentsView = hasPermission('DOCUMENTS_VIEW');

      const promises = [
        dashboardService.getSummary(),
        hasAttendanceView ? dashboardService.getLeaveUtilization() : Promise.resolve(null),
        hasEODView ? eodService.getEodRecords() : Promise.resolve([]),
        hasTeamView ? httpClient.get('/employees/teams/') : Promise.resolve({ data: [] }),
        hasTeamView ? consultantService.getEmployeesList() : Promise.resolve([]),
        dashboardService.getAnnouncements(),
        hasCapacityView ? capacityService.getCapacityPlanning() : Promise.resolve([]),
        hasAttendanceView ? dashboardService.getLeaveRequestsTrend({ days: 7 }) : Promise.resolve(null),
        hasAttendanceView ? dashboardService.getDepartmentStats() : Promise.resolve([]),
        hasAttendanceView ? dashboardService.getOnLeave({ start_date: startStr, end_date: endStr }) : Promise.resolve([]),
        leaveService.listHolidays(),
        hasMurexView ? murexService.getRuntimeTrends() : Promise.resolve(null),
        hasTeamView ? consultantService.getEmployeePhotos({ includeInactive: true }) : Promise.resolve([]),
        hasDocumentsView ? documentService.getDocuments() : Promise.resolve({ files: [], folderTree: [] }),
      ];

      if (empId) {
        promises.push(dashboardService.getPendingApprovals({ manager_id: empId }));
      } else {
        promises.push(Promise.resolve([]));
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
        setCapacityRecords(Array.isArray(data) ? data : data?.result || data?.results || data?.consultants || data?.data || []);
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
      if (results[11]?.status === 'fulfilled') {
        setMurexData(results[11].value);
      }
      if (results[12]?.status === 'fulfilled') {
        const data = results[12].value;
        setOrgPhotos(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[13]?.status === 'fulfilled') {
        setDocumentData(results[13].value || { files: [], folderTree: [] });
      }
      if (empId && results[14]?.status === 'fulfilled') {
        const data = results[14].value;
        setPendingApprovals(Array.isArray(data) ? data : data?.results || []);
      }
    } catch (e) {
      console.error('Live Dashboard API error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id, user?.emp_id, user?.id, hasPermission]);

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

    const murexJobsTotal = murexData?.scripts?.length || 0;
    const murexJobsFailed = murexData?.scripts?.reduce((sum, script) => sum + (script.failedRuns || 0), 0) || 0;

    // 2. System Health
    const systemHealth = {
      murexJobs: { total: murexJobsTotal, failed: murexJobsFailed },
      eodStatus: { completed: eodTotal > 0 ? (eodTotal - eodRunning) : 0, total: eodTotal, running: eodRunning },
      avgRuntime: { time: murexData?.summary?.avg || 'N/A', change: '0%' }
    };

    // 3. Runtime Trend
    let runtimeTrend = [];
    if (murexData && murexData.trend && murexData.trend.length > 0) {
      runtimeTrend = murexData.trend.map(t => {
        const d = new Date(t.date);
        const dayStr = isNaN(d.getTime()) ? t.date : d.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          day: dayStr,
          runtime: t.runtime,
          failed: 0 // Simplification since trend array doesn't include global failures
        };
      });
      // Keep only last 7 items for the chart if it's too long
      if (runtimeTrend.length > 7) {
        runtimeTrend = runtimeTrend.slice(-7);
      }
    }

    // If no data is available, populate with 7 days of zero data
    if (runtimeTrend.length === 0) {
      const todayDate = new Date();
      runtimeTrend = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - (6 - i));
        return {
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          runtime: 0,
          failed: 0
        };
      });
    }
    const allScripts = murexData?.scripts || [];

    let longestScript = { script: 'N/A', duration: '0m' };
    if (allScripts.length > 0) {
      const sortedByRuntime = [...allScripts].sort((a, b) => b.maxRuntime - a.maxRuntime);
      longestScript = {
        script: sortedByRuntime[0].name,
        duration: `${sortedByRuntime[0].maxRuntime}m`
      };
    }

    let mostFailedScript = 'N/A';
    if (allScripts.length > 0) {
      const sortedByFailures = [...allScripts].sort((a, b) => (b.failedRuns || 0) - (a.failedRuns || 0));
      const topFails = sortedByFailures[0].failedRuns || 0;
      if (topFails > 0) {
        mostFailedScript = `${sortedByFailures[0].name} (${topFails})`;
      }
    }

    // Default SLA threshold if we don't have a specific one per script
    const slaThreshold = 100;
    const runtimeInsights = {
      longest: longestScript,
      mostFailed: mostFailedScript,
      slaThreshold
    };

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

      const orgPhotoMatch = orgPhotos.find(p => String(p.id || p.emp_id) === String(r.emp_id));
      const employeeMatch = employees.find(e => String(e.id || e.emp_id) === String(r.emp_id));

      let photoUrl = orgPhotoMatch?.photo_url_base64 || orgPhotoMatch?.photo || r.photo_url_base64 || r.photo || employeeMatch?.photo_url_base64 || employeeMatch?.photo || null;
      if (photoUrl) {
        if (photoUrl.startsWith('ZGF0Y')) {
          try { photoUrl = atob(photoUrl); } catch (e) {}
        }
        if (!photoUrl.startsWith('data:image') && !photoUrl.startsWith('http')) {
          photoUrl = `data:image/jpeg;base64,${photoUrl}`;
        }
      }

      return {
        id: String(r.leave_id || r.id || Math.random()),
        name: r.emp_name || 'Unknown',
        date: dateStr,
        type: r.leave_type || 'Leave',
        photo_url_base64: photoUrl
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

    // 6. Capacity By Team & Top 5 Available Consultants (Next 7 days)
    let capacityByTeam = [];
    let topAvailableConsultants = [];
    try {
      const processed = processCapacityData(capacityRecords, [5, 6], new Date(), new Set(), new Map());
      
      const teamMap = {};
      const availableConsultants = processed.map(c => {
        const available = c.next7Days?.available || 0;
        const occupied = c.next7Days?.occupied || 0;
        
        // Aggregate per team
        const tName = c.teamName || 'Unassigned';
        if (!teamMap[tName]) teamMap[tName] = { team: tName, used: 0, available: 0 };
        teamMap[tName].used += occupied;
        teamMap[tName].available += available;

        return {
          ...c,
          availableMDs: available
        };
      });

      capacityByTeam = Object.values(teamMap).map(t => {
        const total = t.used + t.available;
        const util = total > 0 ? Math.min(100, Math.round((t.used / total) * 100)) : 0;
        return {
          team: t.team,
          used: Math.round(t.used),
          available: Math.round(t.available),
          percentage: util,
          utilization: util
        };
      });

      availableConsultants.sort((a, b) => b.availableMDs - a.availableMDs);
      topAvailableConsultants = availableConsultants.slice(0, 5);
    } catch (e) {
      console.error("Failed to process capacity planning data", e);
    }

    return {
      kpis,
      systemHealth,
      runtimeTrend,
      runtimeInsights,
      leaveDistribution,
      upcomingLeaves,
      attendanceStatus,
      capacityByTeam,
      topAvailableConsultants,
      projectRisk: { total: 0, atRisk: 0, offTrack: 0 },
      projectsByStatus: [],
      documents: { 
        folderTree: documentData.folderTree || [],
        files: documentData.files || [],
      },
      alerts,
      quickStats,
    };
  }, [apiSummary, eodRecords, leaveUtilization, announcements, pendingApprovals, capacityRecords, onLeaveRecords, employees, orgPhotos, documentData]);

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


  const userName = user?.name || user?.username || user?.full_name || user?.first_name || 'User';

  return (
    <div className="dc-root">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      <div className="dc-page-header">
        <div className="dc-welcome-group">
          <h1 className="dc-page-title">
            Welcome back, <span className="dc-welcome-username">{userName}</span>
          </h1>
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
                  {(hasPermission('EMPLOYEE_VIEW') || hasPermission('TEAMS_VIEW')) && (
                    <div className="dc-span-12">
                      <KpiStrip kpis={mappedSummary.kpis} />
                    </div>
                  )}

                  {hasPermission('EOD_OVERVIEW_VIEW') && (
                    <div className="dc-span-12">
                      <EnvironmentStatusStrip eodRecords={eodRecords} />
                    </div>
                  )}

                  {(hasPermission('TEAMS_VIEW') || hasPermission('EMPLOYEE_VIEW')) && (
                    <TeamAvailabilityOverview
                      departmentStats={departmentStats}
                    />
                  )}

                  {hasPermission('MUREX_RUNTIME_VIEW') && (
                    <SystemHealthSection
                      systemHealth={mappedSummary.systemHealth}
                      runtimeTrend={mappedSummary.runtimeTrend}
                      insights={mappedSummary.runtimeInsights}
                    />
                  )}



                  {hasPermission('ATTENDANCE_VIEW') && (
                    <div className="dc-span-12">
                      <LeaveSnapshotSection
                        leaveDistribution={mappedSummary.leaveDistribution}
                        upcomingLeaves={mappedSummary.upcomingLeaves}
                        attendanceStatus={mappedSummary.attendanceStatus}
                      />
                    </div>
                  )}

                  {hasPermission('CAPACITY_PLANNING_VIEW') && mappedSummary.capacityByTeam.length > 0 && (
                    <>
                      <div className="dc-span-6">
                        <CapacitySection capacityByTeam={mappedSummary.capacityByTeam} />
                      </div>
                      <div className="dc-span-6">
                        <EmployeeCapacitySection consultants={mappedSummary.topAvailableConsultants} />
                      </div>
                    </>
                  )}

                </div>

                {hasPermission('PROJECT_MONITORING_VIEW') && mappedSummary.projectsByStatus.length > 0 && (
                  <div className="dc-span-6">
                    <ProjectRiskSection
                      projectRisk={mappedSummary.projectRisk}
                      projectsByStatus={mappedSummary.projectsByStatus}
                    />
                  </div>
                )}

                {hasPermission('DOCUMENTS_VIEW') && (
                  <div className="dc-span-6">
                    <DocumentsActivitySection documents={mappedSummary.documents} />
                  </div>
                )}
              </div>
            </div>

            <aside className="dc-right-rail">
              {hasPermission('ATTENDANCE_VIEW') && (
                <AlertsPanel alerts={mappedSummary.alerts} quickStats={mappedSummary.quickStats} />
              )}

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
