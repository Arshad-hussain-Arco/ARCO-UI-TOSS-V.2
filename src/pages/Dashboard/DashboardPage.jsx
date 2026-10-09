import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Calendar, User, Search, Play } from 'lucide-react';
import { addDays, format } from 'date-fns';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
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
import { CardLoader } from './sections/CardLoader';
import { leaveService } from '@services/leaveService';
import { dashboardService } from '@services/dashboardService';
import { consultantService } from '@services/consultantService';
import { eodService } from '@services/eodService';
import { capacityService } from '@services/capacityService';
import { murexService } from '@services/murexService';
import { documentService } from '@services/documentService';
import { projectService } from '@services/projectService';
import { processCapacityData } from '../CapacityPlanning/capacityCalculations';
import './DashboardPage.css';

/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function DashboardSkeleton({ hasPermission, isManager }) {
  const hasEODView = hasPermission('EOD_OVERVIEW_VIEW');
  const hasMurexView = hasPermission('MUREX_RUNTIME_VIEW');
  const hasCapacityView = hasPermission('CAPACITY_PLANNING_VIEW');
  const hasAttendanceView = hasPermission('ATTENDANCE_VIEW');
  const hasTeamView = hasPermission('TEAMS_VIEW') || hasPermission('EMPLOYEE_VIEW');
  const hasDocumentsView = hasPermission('DOCUMENTS_VIEW');

  return (
    <>
      <div className="dc-main">
        <div className="dc-layout-grid">
          <div className="dc-main-col">
            {hasTeamView && (
              <div className="dc-span-12" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <Skeleton height={110} width="20%" style={{ borderRadius: '8px' }} />
                <Skeleton height={110} width="20%" style={{ borderRadius: '8px' }} />
                <Skeleton height={110} width="20%" style={{ borderRadius: '8px' }} />
                <Skeleton height={110} width="20%" style={{ borderRadius: '8px' }} />
                <Skeleton height={110} width="20%" style={{ borderRadius: '8px' }} />
              </div>
            )}
            {hasEODView && (
              <div className="dc-span-12" style={{ marginBottom: '16px' }}>
                <Skeleton height={140} width="100%" style={{ borderRadius: '8px' }} />
              </div>
            )}
            {hasTeamView && (
              <div className={isManager ? "dc-span-12" : "dc-span-8"} style={{ marginBottom: '16px' }}>
                <Skeleton height={260} width="100%" style={{ borderRadius: '8px' }} />
              </div>
            )}
            {hasMurexView && (
              <>
                <div className="dc-span-4" style={{ marginBottom: '16px' }}>
                  <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <Skeleton height={20} width={140} style={{ borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                      <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                      <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                      <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>
                <div className="dc-span-8" style={{ marginBottom: '16px' }}>
                  <Skeleton height={280} width="100%" style={{ borderRadius: '12px' }} />
                </div>
              </>
            )}
            {hasAttendanceView && (
              <div className="dc-span-12" style={{ marginBottom: '16px' }}>
                <Skeleton height={260} width="100%" style={{ borderRadius: '8px' }} />
              </div>
            )}
            {hasCapacityView && (
              <div className="dc-span-12" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <Skeleton height={200} width="50%" style={{ borderRadius: '8px' }} />
                <Skeleton height={200} width="50%" style={{ borderRadius: '8px' }} />
              </div>
            )}
          </div>

          {hasDocumentsView && (
            <div className="dc-span-6" style={{ marginBottom: '16px' }}>
              <Skeleton height={260} width="100%" style={{ borderRadius: '8px' }} />
            </div>
          )}
        </div>
      </div>
      {isManager && (
        <aside className="dc-right-rail">
          <Skeleton height={140} width="100%" style={{ borderRadius: '8px', marginBottom: '16px' }} />
          <Skeleton height={200} width="100%" style={{ borderRadius: '8px', marginBottom: '16px' }} />
          <Skeleton height={300} width="100%" style={{ borderRadius: '8px', marginBottom: '16px' }} />
        </aside>
      )}
    </>
  );
}

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
  const [projectData, setProjectData] = useState([]);

  // Per-section loading flags: each card shows its own loader until its
  // own endpoint(s) settle, instead of hiding blank or waiting on the rest.
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingEod, setLoadingEod] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingCapacity, setLoadingCapacity] = useState(true);
  const [loadingMurex, setLoadingMurex] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  // Non-managers see Upcoming Holidays as a card beside Team Availability
  // (managers get it in the right rail). Derived from the data so adding or
  // removing a holiday re-flows that row: with none, Team Availability takes
  // the full width instead of leaving an empty gap.
  const showHolidaysCard = !user?.isManager && (loadingHolidays || upcomingHolidays.length > 0);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Each endpoint is fired independently and updates its own state slice as
  // soon as it resolves, instead of the whole page waiting behind a single
  // Promise.allSettled - so sections render progressively as their data
  // arrives rather than all-or-nothing once every endpoint has responded.
  const fetchLiveDashboardData = useCallback(() => {
    setError(null);
    setLoading(true);

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

    const track = (promise, onSuccess, label, onDone) =>
      promise.then(onSuccess).catch((e) => console.error(`Dashboard: ${label} failed:`, e)).finally(onDone);

    setLoadingSummary(true);
    setLoadingAnnouncements(true);
    setLoadingHolidays(true);

    const inFlight = [
      track(dashboardService.getSummary(), setApiSummary, 'getSummary', () => setLoadingSummary(false)),
      track(dashboardService.getAnnouncements(), setAnnouncements, 'getAnnouncements', () => setLoadingAnnouncements(false)),
      track(leaveService.listHolidays(), (data) => {
        const holidaysArr = Array.isArray(data) ? data : data?.results || [];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const upcoming = holidaysArr
          .filter(h => {
            const dateStr = h.dates && h.dates.length > 0 ? h.dates[0] : (h.date || h.start_date || h.holiday_date);
            if (!dateStr) return false;
            return new Date(dateStr) >= todayStart;
          })
          .sort((a, b) => {
            const aDate = a.dates && a.dates.length > 0 ? a.dates[0] : (a.date || a.start_date || a.holiday_date);
            const bDate = b.dates && b.dates.length > 0 ? b.dates[0] : (b.date || b.start_date || b.holiday_date);
            return new Date(aDate) - new Date(bDate);
          })
          .slice(0, 4); // Take top 4
        setUpcomingHolidays(upcoming);
      }, 'listHolidays', () => setLoadingHolidays(false)),
    ];

    if (hasAttendanceView) {
      setLoadingAttendance(true);
      inFlight.push(
        Promise.allSettled([
          dashboardService.getLeaveUtilization().then(setLeaveUtilization).catch((e) => console.error('Dashboard: getLeaveUtilization failed:', e)),
          dashboardService.getOnLeave({ start_date: startStr, end_date: endStr }).then((data) => setOnLeaveRecords(Array.isArray(data) ? data : data?.results || [])).catch((e) => console.error('Dashboard: getOnLeave failed:', e)),
        ]).finally(() => setLoadingAttendance(false)),
      );
    } else {
      setLoadingAttendance(false);
    }

    if (hasEODView) {
      setLoadingEod(true);
      inFlight.push(
        track(eodService.getEodRecords(), (data) => setEodRecords(Array.isArray(data) ? data : data?.results || []), 'getEodRecords', () => setLoadingEod(false)),
      );
    } else {
      setLoadingEod(false);
    }

    if (hasTeamView) {
      setLoadingTeams(true);
      inFlight.push(
        Promise.allSettled([
          httpClient.get('/employees/teams/').then((res) => {
            const data = res.data;
            setTeams(Array.isArray(data) ? data : data?.results || []);
          }).catch((e) => console.error('Dashboard: teams failed:', e)),
          consultantService.getEmployeesList().then((data) => setEmployees(Array.isArray(data) ? data : data?.results || [])).catch((e) => console.error('Dashboard: getEmployeesList failed:', e)),
          consultantService.getEmployeePhotos({ includeInactive: true }).then((data) => setOrgPhotos(Array.isArray(data) ? data : data?.results || [])).catch((e) => console.error('Dashboard: getEmployeePhotos failed:', e)),
          dashboardService.getLeaveRequestsTrend({ days: 7 }).then(setTrendData).catch((e) => console.error('Dashboard: getLeaveRequestsTrend failed:', e)),
          dashboardService.getDepartmentStats().then((data) => setDepartmentStats(Array.isArray(data) ? data : data?.results || [])).catch((e) => console.error('Dashboard: getDepartmentStats failed:', e)),
        ]).finally(() => setLoadingTeams(false)),
      );
    } else {
      setLoadingTeams(false);
    }

    if (hasCapacityView) {
      setLoadingCapacity(true);
      inFlight.push(
        track(capacityService.getCapacityPlanning(), (data) => setCapacityRecords(Array.isArray(data) ? data : data?.result || data?.results || data?.consultants || data?.data || []), 'getCapacityPlanning', () => setLoadingCapacity(false)),
      );
    } else {
      setLoadingCapacity(false);
    }

    if (hasMurexView) {
      setLoadingMurex(true);
      inFlight.push(
        track(murexService.getRuntimeTrends(), setMurexData, 'getRuntimeTrends', () => setLoadingMurex(false)),
      );
    } else {
      setLoadingMurex(false);
    }

    if (hasDocumentsView) {
      setLoadingDocuments(true);
      inFlight.push(
        track(documentService.getDocuments(), (data) => setDocumentData(data || { files: [], folderTree: [] }), 'getDocuments', () => setLoadingDocuments(false)),
      );
    } else {
      setLoadingDocuments(false);
    }

    const hasProjectView = hasPermission('PROJECT_MONITORING_VIEW');

    if (hasProjectView) {
      setLoadingProjects(true);
      inFlight.push(
        track(projectService.getWorkOrderStatus(), (data) => setProjectData(Array.isArray(data) ? data : data?.results || []), 'getWorkOrderStatus', () => setLoadingProjects(false))
      );
    } else {
      setLoadingProjects(false);
    }

    if (empId) {
      setLoadingApprovals(true);
      inFlight.push(
        track(dashboardService.getPendingApprovals({ manager_id: empId }), (data) => setPendingApprovals(Array.isArray(data) ? data : data?.results || []), 'getPendingApprovals', () => setLoadingApprovals(false)),
      );
    } else {
      setLoadingApprovals(false);
    }

    // Don't block the page on every endpoint settling - each `track()` call
    // above already updates its own state (and thus renders its own section)
    // the moment it resolves. `loading` only covers the instant before the
    // very first response of this cycle arrives.
    setLoading(false);
    void Promise.allSettled(inFlight);
  }, [user?.employee_id, user?.emp_id, user?.id, hasPermission]);

  useEffect(() => {
    fetchLiveDashboardData();
  }, [fetchLiveDashboardData]);

  // ───────────────────────────────────────────────────────────────────────────
  // ADAPTER: Morph live API data into the exact shapes expected by the sections
  // ───────────────────────────────────────────────────────────────────────────

  const mappedSummary = useMemo(() => {
    // Never bail to null: sections should render with whatever's in yet
    // (zeros/empty lists) rather than the whole page waiting on this one
    // endpoint before anything appears.
    const summary = apiSummary || {};

    // Derived counts
    const totalEmps = summary.total_employees ?? 0;
    const activeEmps = summary.active_employees ?? 0;
    const presentEmps = summary.present_count ?? 0;
    const leaveEmps = summary.employees_on_leave_today ?? 0;
    const wfhEmps = summary.wfh_count ?? 0;

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
      
      const empCapacityMap = new Map();
      
      // 1. Pre-fill with all active employees
      employees.forEach(emp => {
        if (emp.status === 'Inactive' || emp.is_active === false) return;
        
        const eId = String(emp.id || emp.emp_id);
        const eName = emp.name || emp.full_name || emp.first_name || 'Unknown';
        const eTeam = emp.team_name || emp.team || 'Unassigned Team';
        
        empCapacityMap.set(eId, {
          id: eId,
          name: eName,
          teamName: eTeam,
          photo: emp.photo_url_base64 || emp.photo || null,
          next7Days: { occupied: 0, available: 5 },
          availableMDs: 5
        });
      });

      // 2. Merge processed assignments
      processed.forEach(c => {
        const id = String(c.id);
        let matched = empCapacityMap.get(id);
        
        // Fallback match by name
        if (!matched) {
          matched = Array.from(empCapacityMap.values()).find(
            e => e.name.toLowerCase() === c.name.toLowerCase()
          );
        }

        if (matched) {
          matched.next7Days = c.next7Days;
          matched.availableMDs = c.next7Days?.available || 0;
        } else {
          empCapacityMap.set(id, {
            ...c,
            availableMDs: c.next7Days?.available || 0
          });
        }
      });

      const availableConsultants = Array.from(empCapacityMap.values());
      
      // 3. Aggregate by Team
      const teamMap = {};
      availableConsultants.forEach(c => {
        const available = c.next7Days?.available || 0;
        const occupied = c.next7Days?.occupied || 0;
        
        const tName = c.teamName || 'Unassigned';
        if (!teamMap[tName]) teamMap[tName] = { team: tName, used: 0, available: 0 };
        teamMap[tName].used += occupied;
        teamMap[tName].available += available;
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

      // 4. Sort and get top 5 available consultants
      availableConsultants.sort((a, b) => b.availableMDs - a.availableMDs);
      topAvailableConsultants = availableConsultants.slice(0, 5);
    } catch (e) {
      console.error("Failed to process capacity planning data", e);
    }

    let active = 0;
    let atRisk = 0;
    let breached = 0;
    
    const projectsByStatus = projectData.map(p => {
      const status = p.status?.toLowerCase().replace(/\s+/g, '-') || 'on-track';
      if (status === 'at-risk') atRisk++;
      else if (status === 'breached') breached++;
      else active++;
      return {
        id: p.id || p.project_id || Math.random().toString(),
        name: p.name || p.project_name || 'Project',
        status
      };
    });

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
      projectRisk: { active, atRisk, breached, total: active + atRisk + breached },
      projectsByStatus,
      documents: { 
        folderTree: documentData.folderTree || [],
        files: documentData.files || [],
      },
      alerts,
    };
  }, [apiSummary, eodRecords, leaveUtilization, announcements, pendingApprovals, capacityRecords, onLeaveRecords, employees, orgPhotos, documentData, projectData]);

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
        ) : loading ? (
          <DashboardSkeleton hasPermission={hasPermission} isManager={user?.isManager} />
        ) : (
          <>
            <div className="dc-main">
              {/* EOD Environment Status Strip */}
              <div className="dc-layout-grid">
                {/* LEFT COLUMN / FULL WIDTH ITEMS */}
                <div className="dc-main-col">
                  {(hasPermission('EMPLOYEE_VIEW') || hasPermission('TEAMS_VIEW')) && (
                    <div className="dc-span-12">
                      {loadingSummary ? (
                        <CardLoader label="Loading consultant counts…" minHeight={110} />
                      ) : (
                        <KpiStrip kpis={mappedSummary.kpis} />
                      )}
                    </div>
                  )}

                  {hasPermission('EOD_OVERVIEW_VIEW') && (
                    <div className="dc-span-12">
                      {loadingEod ? (
                        <CardLoader label="Loading EOD batch jobs…" minHeight={140} />
                      ) : (
                        <EnvironmentStatusStrip eodRecords={eodRecords} />
                      )}
                    </div>
                  )}

                  {(hasPermission('TEAMS_VIEW') || hasPermission('EMPLOYEE_VIEW')) && (
                    <TeamAvailabilityOverview
                      departmentStats={departmentStats}
                      trendData={trendData}
                      isLoading={loadingTeams}
                      isManager={user?.isManager}
                      hasSideCard={showHolidaysCard}
                    />
                  )}

                  {/* Managers get Upcoming Holidays in the right rail; everyone
                      else gets it here, in the free slot beside Team
                      Availability, so every employee can see it. */}
                  {showHolidaysCard && (
                    <div className="dc-span-4">
                      {loadingHolidays ? (
                        <CardLoader label="Loading holidays…" minHeight={140} />
                      ) : (
                        upcomingHolidays.length > 0 && (
                          <div className="dc-card" style={{ padding: 0 }}>
                            <UpcomingHolidaysPanel holidays={upcomingHolidays} standalone />
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {hasPermission('MUREX_RUNTIME_VIEW') && (
                    loadingEod || loadingMurex ? (
                      <>
                        <div className="dc-span-4">
                          <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                            <div style={{ marginBottom: '16px' }}>
                              <Skeleton height={20} width={140} style={{ borderRadius: '4px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                              <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                              <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                              <Skeleton height={70} width="100%" style={{ borderRadius: '8px' }} />
                            </div>
                          </div>
                        </div>
                        <div className="dc-span-8">
                          <CardLoader label="Loading runtime trends…" minHeight={280} />
                        </div>
                      </>
                    ) : (
                      <SystemHealthSection
                        systemHealth={mappedSummary.systemHealth}
                        runtimeTrend={mappedSummary.runtimeTrend}
                        insights={mappedSummary.runtimeInsights}
                        isManager={user?.isManager}
                      />
                    )
                  )}



                  {hasPermission('ATTENDANCE_VIEW') && (
                    <div className="dc-span-12">
                      {loadingSummary || loadingAttendance ? (
                        <CardLoader label="Loading leave snapshot…" minHeight={260} />
                      ) : (
                        <LeaveSnapshotSection
                          leaveDistribution={mappedSummary.leaveDistribution}
                          upcomingLeaves={mappedSummary.upcomingLeaves}
                          attendanceStatus={mappedSummary.attendanceStatus}
                        />
                      )}
                    </div>
                  )}

                  {hasPermission('CAPACITY_PLANNING_VIEW') && (
                    loadingCapacity || loadingTeams ? (
                      <>
                        <div className="dc-span-6"><CardLoader label="Loading capacity…" /></div>
                        <div className="dc-span-6"><CardLoader label="Loading available consultants…" /></div>
                      </>
                    ) : mappedSummary.capacityByTeam.length > 0 && (
                      <>
                        <div className="dc-span-6">
                          <CapacitySection capacityByTeam={mappedSummary.capacityByTeam} />
                        </div>
                        <div className="dc-span-6">
                          <EmployeeCapacitySection consultants={mappedSummary.topAvailableConsultants} />
                        </div>
                      </>
                    )
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
                    {loadingDocuments ? (
                      <CardLoader label="Loading recent documents…" />
                    ) : (
                      <DocumentsActivitySection documents={mappedSummary.documents} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {user?.isManager && (
              <aside className="dc-right-rail">
                {hasPermission('ATTENDANCE_VIEW') && (
                  loadingAnnouncements || loadingApprovals ? (
                    <CardLoader label="Loading notifications…" minHeight={120} />
                  ) : (
                    <AlertsPanel alerts={mappedSummary.alerts} quickStats={mappedSummary.quickStats} />
                  )
                )}

                {loadingHolidays ? (
                  <CardLoader label="Loading holidays…" minHeight={140} />
                ) : (
                  <UpcomingHolidaysPanel holidays={upcomingHolidays} />
                )}

                {loadingApprovals ? (
                  <CardLoader label="Loading pending approvals…" minHeight={140} />
                ) : (
                  pendingApprovals && pendingApprovals.length > 0 && (
                    <PendingApprovalsActionSection
                      pendingApprovals={pendingApprovals}
                      onActionComplete={fetchLiveDashboardData}
                    />
                  )
                )}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
