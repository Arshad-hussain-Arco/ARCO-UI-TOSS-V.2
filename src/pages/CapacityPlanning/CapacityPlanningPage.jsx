import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { CAPACITY_TEAMS, CAPACITY_TIME_RANGES } from '@mocks/data/capacity';
import { capacityService } from '@services/capacityService';

import './CapacityPlanningPage.css';

/**
 * Capacity planning: occupied versus available hours per consultant, grouped by
 * team, over a selectable horizon.
 */
export function CapacityPlanningPage() {
  useDocumentTitle('Capacity Planning');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [timeRange, setTimeRange] = useState(30);
  const [expandedConsultant, setExpandedConsultant] = useState(null);
  const [showUnderutilized, setShowUnderutilized] = useState(false);
  const fetchPlan = useCallback(() => capacityService.getCapacityPlanning(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchPlan);

  const sources = data?.sources || { woFile: 'API', crFile: 'API' };

  const consultants = useMemo(() => {
    const apiResult = data?.result;
    if (!apiResult || !Array.isArray(apiResult)) return [];

    const devMap = new Map();

    apiResult.forEach((item) => {
      const devName = item.EmployeeName || item.Assigned_Developer || 'Unassigned';

      if (!devMap.has(devName)) {
        devMap.set(devName, {
          id: devName,
          name: devName,
          team: item.TeamName || 'Development',
          role: 'Developer',
          utilization: 'optimal',
          next7Days: { occupied: 0, available: 40 },
          next30Days: { occupied: 0, available: 160 },
          next90Days: { occupied: 0, available: 480 },
          trendData: [40, 50, 60, 45, 70, 80, 50],
          upcomingAllocations: [],
        });
      }

      const dev = devMap.get(devName);
      const effortMDs = item.Effort_in_MDs || 0;
      const effortHours = effortMDs * 8;

      dev.upcomingAllocations.push({
        project: item.Project || 'N/A',
        summary: item.Summary || 'N/A',
        status: item.Status || 'N/A',
        startDate: item.Start_Date || 'N/A',
        endDate: item.End_Date || 'N/A',
        effort: effortMDs,
        hours: effortHours,
        additionalDevs: item.Additional_Developers || 'None',
      });

      // Simple heuristic: distribute effort to Next 30 Days as a placeholder metric
      dev.next30Days.occupied += effortHours;
      if (dev.next30Days.occupied > dev.next30Days.available) {
        dev.utilization = 'overbooked';
      } else if (dev.next30Days.occupied < dev.next30Days.available * 0.5) {
        dev.utilization = 'low';
      }
    });

    return Array.from(devMap.values());
  }, [data]);

  /** Names of the teams whose row group is collapsed. */
  const [collapsedTeams, setCollapsedTeams] = useState(() => new Set());

  /** Consultants grouped into the fixed team order, with their collapsed flag. */
  const teams = useMemo(
    () =>
      CAPACITY_TEAMS.map((name) => ({
        name,
        consultants: consultants.filter((consultant) => consultant.team === name),
        collapsed: collapsedTeams.has(name),
      })),
    [consultants, collapsedTeams],
  );

  /** Occupied vs available hours for each offered range, computed once per load. */
  const metricsByRange = useMemo(() => {
    const fieldFor = (days) =>
      days === 7 ? 'next7Days' : days === 30 ? 'next30Days' : 'next90Days';

    return CAPACITY_TIME_RANGES.reduce((all, days) => {
      const field = fieldFor(days);
      const total = consultants.reduce(
        (sum, consultant) => ({
          occupied: sum.occupied + consultant[field].occupied,
          available: sum.available + consultant[field].available,
        }),
        { occupied: 0, available: 0 },
      );

      const totalHours = total.occupied + total.available;

      all[days] = {
        occupied: total.occupied,
        available: total.available,
        occupiedPercent: totalHours > 0 ? (total.occupied / totalHours) * 100 : 0,
        availablePercent: totalHours > 0 ? (total.available / totalHours) * 100 : 0,
      };
      return all;
    }, {});
  }, [consultants]);

  const metrics7 = metricsByRange[7];
  const metrics30 = metricsByRange[30];
  const metrics90 = metricsByRange[90];
  const toggleTeam = (teamName) => {
    setCollapsedTeams((current) => {
      const next = new Set(current);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
  };
  const toggleConsultant = (consultantId) => {
    setExpandedConsultant(expandedConsultant === consultantId ? null : consultantId);
  };
  const getUtilizationColor = (utilization) => {
    switch (utilization) {
      case 'low':
        return 'low';
      case 'optimal':
        return 'optimal';
      case 'overbooked':
        return 'overbooked';
      default:
        return 'optimal';
    }
  };
  const getUtilizationLabel = (utilization) => {
    switch (utilization) {
      case 'low':
        return 'Underutilized';
      case 'optimal':
        return 'Optimal';
      case 'overbooked':
        return 'Overbooked';
      default:
        return 'Optimal';
    }
  };
  const filteredTeams = teams
    .map((team) => ({
      ...team,
      consultants: team.consultants.filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTeam = selectedTeam === 'all' || c.team === selectedTeam;
        const matchesUtilization = !showUnderutilized || c.utilization === 'low';
        return matchesSearch && matchesTeam && matchesUtilization;
      }),
    }))
    .filter((team) => team.consultants.length > 0);

  if (error) {
    return (
      <ErrorState
        title="Capacity plan could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !sources) {
    return <Loader message="Loading capacity plan…" />;
  }

  return (
    <div className="capacity-planning-page">
      {/* Slim Header */}
      <div className="capacity-header">
        <div className="capacity-header-left">
          <h1 className="capacity-title">Capacity Planning</h1>
          <p className="capacity-subtitle">
            Last updated: WO File {sources.woFile} | CR File {sources.crFile}
          </p>
        </div>
        <div className="capacity-header-actions">
          <button className="capacity-action-btn">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="capacity-action-btn">
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="capacity-filter-bar">
        <div className="capacity-filter-group">
          <Select
            value={selectedTeam}
            onChange={setSelectedTeam}
            options={[
              { value: 'all', label: 'All Teams' },
              { value: 'Development', label: 'Development' },
              { value: 'QA', label: 'QA' },
              { value: 'Design', label: 'Design' },
              { value: 'Operations', label: 'Operations' },
            ]}
            width="team"
          />

          <div className="capacity-search-wrapper">
            <Search className="capacity-search-icon" size={14} />
            <input
              type="text"
              placeholder="Search consultant..."
              className="capacity-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="capacity-time-toggle">
            <button
              className={`capacity-time-btn ${timeRange === 7 ? 'active' : ''}`}
              onClick={() => setTimeRange(7)}
            >
              7 Days
            </button>
            <button
              className={`capacity-time-btn ${timeRange === 30 ? 'active' : ''}`}
              onClick={() => setTimeRange(30)}
            >
              30 Days
            </button>
            <button
              className={`capacity-time-btn ${timeRange === 90 ? 'active' : ''}`}
              onClick={() => setTimeRange(90)}
            >
              90 Days
            </button>
          </div>
        </div>

        <button
          className={`capacity-filter-toggle ${showUnderutilized ? 'active' : ''}`}
          onClick={() => setShowUnderutilized(!showUnderutilized)}
        >
          <Filter size={14} />
          <span>Underutilized Only</span>
        </button>
      </div>

      {/* Slim Horizontal Metric Tiles */}
      <div className="capacity-metrics">
        <div className="capacity-metric-tile">
          <div className="capacity-metric-header">
            <span className="capacity-metric-label">Next 7 Days</span>
            <span className="capacity-metric-values">
              {metrics7.occupied}h / {metrics7.occupied + metrics7.available}h
            </span>
          </div>
          <div className="capacity-metric-bar">
            <div
              className="capacity-metric-fill occupied"
              style={{ width: `${metrics7.occupiedPercent}%` }}
            />
            <div
              className="capacity-metric-fill available"
              style={{ width: `${metrics7.availablePercent}%` }}
            />
          </div>
          <div className="capacity-metric-legend">
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot occupied" />
              Occupied: {metrics7.occupied}h
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot available" />
              Available: {metrics7.available}h
            </span>
          </div>
        </div>

        <div className="capacity-metric-tile">
          <div className="capacity-metric-header">
            <span className="capacity-metric-label">Next 30 Days</span>
            <span className="capacity-metric-values">
              {metrics30.occupied}h / {metrics30.occupied + metrics30.available}h
            </span>
          </div>
          <div className="capacity-metric-bar">
            <div
              className="capacity-metric-fill occupied"
              style={{ width: `${metrics30.occupiedPercent}%` }}
            />
            <div
              className="capacity-metric-fill available"
              style={{ width: `${metrics30.availablePercent}%` }}
            />
          </div>
          <div className="capacity-metric-legend">
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot occupied" />
              Occupied: {metrics30.occupied}h
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot available" />
              Available: {metrics30.available}h
            </span>
          </div>
        </div>

        <div className="capacity-metric-tile">
          <div className="capacity-metric-header">
            <span className="capacity-metric-label">Next 90 Days</span>
            <span className="capacity-metric-values">
              {metrics90.occupied}h / {metrics90.occupied + metrics90.available}h
            </span>
          </div>
          <div className="capacity-metric-bar">
            <div
              className="capacity-metric-fill occupied"
              style={{ width: `${metrics90.occupiedPercent}%` }}
            />
            <div
              className="capacity-metric-fill available"
              style={{ width: `${metrics90.availablePercent}%` }}
            />
          </div>
          <div className="capacity-metric-legend">
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot occupied" />
              Occupied: {metrics90.occupied}h
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot available" />
              Available: {metrics90.available}h
            </span>
          </div>
        </div>
      </div>

      {/* High Density Table */}
      <div className="capacity-table-container">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
          <div className="capacity-metric-legend" style={{ margin: 0 }}>
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot occupied" />
              Occupied
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-dot available" />
              Available
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-badge low" />
              Underutilized
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-badge optimal" />
              Optimal
            </span>
            <span className="capacity-legend-item">
              <span className="capacity-legend-badge overbooked" />
              Overbooked
            </span>
          </div>
        </div>

        <table
          className="capacity-table"
          style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
        >
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead className="capacity-table-head">
            <tr>
              <th className="capacity-th consultant-col">Consultant</th>
              <th className="capacity-th role-col">Role</th>
              <th className="capacity-th status-col">Status</th>
              <th className="capacity-th capacity-col">Next 7 Days</th>
              <th className="capacity-th capacity-col">Next 30 Days</th>
              <th className="capacity-th capacity-col">Next 90 Days</th>
            </tr>
          </thead>
          <tbody className="capacity-table-body">
            {filteredTeams.flatMap((team) => {
              const rows = [
                <tr
                  key={`team-${team.name}`}
                  className="capacity-team-row"
                  onClick={() => toggleTeam(team.name)}
                >
                  <td colSpan={6} className="capacity-team-cell">
                    {team.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="capacity-team-name">{team.name}</span>
                    <span className="capacity-team-count">({team.consultants.length})</span>
                  </td>
                </tr>,
              ];
              if (!team.collapsed) {
                team.consultants.forEach((consultant, index) => {
                  rows.push(
                    <tr
                      key={`consultant-${consultant.id}`}
                      className={`capacity-row ${index % 2 === 0 ? 'even' : 'odd'}`}
                      onClick={() => toggleConsultant(consultant.id)}
                    >
                      <td className="capacity-td consultant-col">
                        <div className="capacity-consultant-cell">
                          {expandedConsultant === consultant.id ? (
                            <ChevronDown size={14} className="capacity-expand-icon" />
                          ) : (
                            <ChevronRight size={14} className="capacity-expand-icon" />
                          )}
                          <span>{consultant.name}</span>
                        </div>
                      </td>
                      <td className="capacity-td role-col">{consultant.role}</td>
                      <td className="capacity-td status-col">
                        <span
                          className={`capacity-status-badge ${getUtilizationColor(consultant.utilization)}`}
                        >
                          {consultant.utilization === 'low' && <TrendingUp size={12} />}
                          {consultant.utilization === 'optimal' && <CheckCircle size={12} />}
                          {consultant.utilization === 'overbooked' && <AlertCircle size={12} />}
                          {getUtilizationLabel(consultant.utilization)}
                        </span>
                      </td>
                      <td className="capacity-td capacity-col">
                        <div className="capacity-bar-cell">
                          <div className="capacity-mini-bar">
                            <div
                              className="capacity-mini-fill occupied"
                              style={{
                                width: `${(consultant.next7Days.occupied / (consultant.next7Days.occupied + consultant.next7Days.available)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="capacity-cell-text">
                            {consultant.next7Days.occupied}h /{' '}
                            {consultant.next7Days.occupied + consultant.next7Days.available}h
                          </span>
                        </div>
                      </td>
                      <td className="capacity-td capacity-col">
                        <div className="capacity-bar-cell">
                          <div className="capacity-mini-bar">
                            <div
                              className="capacity-mini-fill occupied"
                              style={{
                                width: `${(consultant.next30Days.occupied / (consultant.next30Days.occupied + consultant.next30Days.available)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="capacity-cell-text">
                            {consultant.next30Days.occupied}h /{' '}
                            {consultant.next30Days.occupied + consultant.next30Days.available}h
                          </span>
                        </div>
                      </td>
                      <td className="capacity-td capacity-col">
                        <div className="capacity-bar-cell">
                          <div className="capacity-mini-bar">
                            <div
                              className="capacity-mini-fill occupied"
                              style={{
                                width: `${(consultant.next90Days.occupied / (consultant.next90Days.occupied + consultant.next90Days.available)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="capacity-cell-text">
                            {consultant.next90Days.occupied}h /{' '}
                            {consultant.next90Days.occupied + consultant.next90Days.available}h
                          </span>
                        </div>
                      </td>
                    </tr>,
                  );
                  if (expandedConsultant === consultant.id) {
                    rows.push(
                      <tr key={`drill-${consultant.id}`} className="capacity-drill-row">
                        <td colSpan={6} className="capacity-drill-cell">
                          <div className="capacity-drill-panel">
                            <div className="capacity-drill-section">
                              <h4 className="capacity-drill-title">
                                <BarChart3 size={14} />
                                Capacity Trend
                              </h4>
                              <div className="capacity-sparkline">
                                {consultant.trendData.map((value, i) => (
                                  <div
                                    key={i}
                                    className="capacity-sparkline-bar"
                                    style={{
                                      height: `${value}%`,
                                      background:
                                        value > 100
                                          ? '#ef4444'
                                          : value < 50
                                            ? '#10b981'
                                            : '#3b82f6',
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="capacity-sparkline-labels">
                                <span>7 weeks ago</span>
                                <span>This week</span>
                              </div>
                            </div>

                            <div className="capacity-drill-section">
                              <h4 className="capacity-drill-title">
                                <Clock size={14} />
                                Assigned Projects & CRs
                              </h4>
                              <div className="capacity-allocations" style={{ overflowX: 'auto' }}>
                                <table className="capacity-alloc-table">
                                  <thead>
                                    <tr>
                                      <th>Project</th>
                                      <th>Summary</th>
                                      <th>Status</th>
                                      <th>Start Date</th>
                                      <th>End Date</th>
                                      <th>Effort (MDs)</th>
                                      <th>Additional Devs</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {consultant.upcomingAllocations.map((alloc, i) => (
                                      <tr key={i}>
                                        <td>{alloc.project}</td>
                                        <td>{alloc.summary}</td>
                                        <td>
                                          <span className={`capacity-status-badge optimal`} style={{ padding: '2px 6px', fontSize: '10px' }}>
                                            {alloc.status}
                                          </span>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{alloc.startDate}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{alloc.endDate}</td>
                                        <td>{alloc.effort}</td>
                                        <td>{alloc.additionalDevs}</td>
                                      </tr>
                                    ))}
                                    {consultant.upcomingAllocations.length === 0 && (
                                      <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-tertiary)' }}>
                                          No assigned projects
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="capacity-drill-section">
                              <h4 className="capacity-drill-title">
                                <AlertCircle size={14} />
                                Risk Indicator
                              </h4>
                              <div
                                className={`capacity-risk-indicator ${getUtilizationColor(consultant.utilization)}`}
                              >
                                {consultant.utilization === 'low' && (
                                  <>
                                    <TrendingUp size={16} />
                                    <span>
                                      Consultant is underutilized. Consider new project assignments.
                                    </span>
                                  </>
                                )}
                                {consultant.utilization === 'optimal' && (
                                  <>
                                    <CheckCircle size={16} />
                                    <span>Consultant workload is at optimal capacity.</span>
                                  </>
                                )}
                                {consultant.utilization === 'overbooked' && (
                                  <>
                                    <AlertCircle size={16} />
                                    <span>
                                      Consultant is overbooked. Risk of burnout and delivery delays.
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>,
                    );
                  }
                });
              }
              return rows;
            })}
          </tbody>
        </table>

        {filteredTeams.length === 0 && (
          <div className="capacity-empty-state">
            <Search size={32} />
            <h3>No consultants found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
export default CapacityPlanningPage;
