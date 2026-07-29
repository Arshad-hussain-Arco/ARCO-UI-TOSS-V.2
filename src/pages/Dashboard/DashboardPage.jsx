import { useCallback, useState } from 'react';
import { Download, Filter } from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { DASHBOARD_DATE_FILTERS } from '@mocks/data/dashboard';
import { dashboardService } from '@services/dashboardService';
import { consultantService } from '@services/consultantService';

import { AlertsPanel } from './sections/AlertsPanel';
import { CapacitySection } from './sections/CapacitySection';
import { DocumentsActivitySection } from './sections/DocumentsActivitySection';
import { KpiStrip } from './sections/KpiStrip';
import { LeaveSnapshotSection } from './sections/LeaveSnapshotSection';
import { ProjectRiskSection } from './sections/ProjectRiskSection';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { TeamHeadcountSection } from './sections/TeamHeadcountSection';
import './DashboardPage.css';

/**
 * Operations dashboard.
 *
 * The page owns only the date filter and the fetch lifecycle; every panel is its
 * own presentational component that receives exactly the data it renders.
 */
export function DashboardPage() {
  useDocumentTitle('Operations Dashboard');

  const [dateFilter, setDateFilter] = useState('today');

  const fetchSummary = useCallback(() => dashboardService.getSummary({ dateFilter }), [dateFilter]);
  const { data: summary, isLoading, error, refetch } = useAsync(fetchSummary);

  const fetchHeadcount = useCallback(() => consultantService.getTeamHeadcount(), []);
  const { data: teamHeadcount } = useAsync(fetchHeadcount);

  return (
    <div className="dc-root">
      <div className="dc-page-header">
        <div>
          <h1 className="dc-page-title">Operations Dashboard</h1>
          <p className="dc-page-sub">Real-time overview of system health and team performance</p>
        </div>

        <div className="dc-header-actions">
          <div className="dc-filter-pill">
            <Filter size={12} />
            <Select value={dateFilter} onChange={setDateFilter} options={DASHBOARD_DATE_FILTERS} width="dateRange" />
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
            description={error.message}
            onRetry={refetch}
          />
        ) : isLoading || !summary ? (
          <Loader message="Loading dashboard…" />
        ) : (
          <>
            <div className="dc-main">
              <KpiStrip kpis={summary.kpis} />

              <SystemHealthSection
                systemHealth={summary.systemHealth}
                runtimeTrend={summary.runtimeTrend}
                insights={summary.runtimeInsights}
              />

              <LeaveSnapshotSection
                leaveDistribution={summary.leaveDistribution}
                upcomingLeaves={summary.upcomingLeaves}
                attendanceStatus={summary.attendanceStatus}
              />

              <CapacitySection capacityByTeam={summary.capacityByTeam} />

              {teamHeadcount && teamHeadcount.length > 0 && (
                <TeamHeadcountSection teams={teamHeadcount} />
              )}

              <ProjectRiskSection
                projectRisk={summary.projectRisk}
                projectsByStatus={summary.projectsByStatus}
              />

              <DocumentsActivitySection
                documents={summary.documents}
                recentActivity={summary.recentActivity}
              />
            </div>

            <AlertsPanel alerts={summary.alerts} quickStats={summary.quickStats} />
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
