import { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Eye,
  Users,
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { CAPACITY_TEAMS } from '@mocks/data/capacity';
import { capacityService } from '@services/capacityService';

import './CapacityPlanningPage.css';

/**
 * Capacity planning: occupied versus available hours per consultant, grouped by
 * team, over a selectable horizon.
 */
export function CapacityPlanningPage() {
  useDocumentTitle('Capacity Planning');

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'teams'
  const [activeSubtab, setActiveSubtab] = useState('Frontend'); // 'Frontend', 'Backend', 'DevOps', 'QA', 'Design'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');

  // Drill-down Modal State
  const [selectedDrillConsultant, setSelectedDrillConsultant] = useState(null);
  const [selectedDrillTimeframe, setSelectedDrillTimeframe] = useState(null);

  const fetchPlan = useCallback(() => capacityService.getCapacityPlanning({ timeRange: 90 }), []);
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

  const filteredTeams = useMemo(() => {
    return teams
      .map((team) => ({
        ...team,
        consultants: team.consultants.filter((c) => {
          const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesTeam = selectedTeam === 'all' || c.team === selectedTeam;
          return matchesSearch && matchesTeam;
        }),
      }))
      .filter((team) => team.consultants.length > 0);
  }, [teams, searchQuery, selectedTeam]);

  // Subtabs list for the Teams tab view
  const subTabs = useMemo(() => ['Frontend', 'Backend', 'DevOps', 'QA', 'Design'], []);

  // Filter flat consultants for the active subtab
  const activeSubtabConsultants = useMemo(() => {
    return consultants.filter(c => {
      // Search query filter
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Subtab filter mapping
      switch (activeSubtab) {
        case 'Frontend':
          return c.team === 'Development' && (c.role.toLowerCase().includes('frontend') || c.role.toLowerCase().includes('full stack'));
        case 'Backend':
          return c.team === 'Development' && (c.role.toLowerCase().includes('developer') && !c.role.toLowerCase().includes('frontend'));
        case 'DevOps':
          return c.team === 'Operations' || c.role.toLowerCase().includes('devops');
        case 'QA':
          return c.team === 'QA';
        case 'Design':
          return c.team === 'Design';
        default:
          return true;
      }
    });
  }, [consultants, searchQuery, activeSubtab]);

  // Dynamic calculations for consultant allocations in the selected timeframe
  const drillAllocations = useMemo(() => {
    if (!selectedDrillConsultant || !selectedDrillConsultant.upcomingAllocations) return [];

    const baseDate = new Date('2026-02-03');
    return selectedDrillConsultant.upcomingAllocations.map((alloc, index) => {
      const endDate = new Date(alloc.endDate);
      const diffTime = endDate - baseDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysUntilEnd = diffDays > 0 ? `${diffDays} days` : 'Ended';

      const totalMDs = (alloc.hours / 8).toFixed(1);
      const limitMDs = selectedDrillTimeframe === 7 ? 5 : selectedDrillTimeframe === 30 ? 20 : 60;
      const timeframeMDs = Math.min(limitMDs, alloc.hours / 8).toFixed(1);

      const completedPercent = 60 + (index * 15) % 35; // mock values
      const remainingPercent = 100 - completedPercent;

      return {
        id: `alloc-${index}`,
        summary: alloc.project,
        status: alloc.hours > 60 ? 'In Progress' : 'Planned',
        effort: `${totalMDs} MDs`,
        role: selectedDrillConsultant.role,
        startDate: alloc.startDate,
        endDate: alloc.endDate,
        daysUntilEnd,
        completed: `${completedPercent}%`,
        remaining: `${remainingPercent}%`,
        timeframeMDs: `${timeframeMDs} MDs`,
        totalMDs: `${totalMDs} MDs`
      };
    });
  }, [selectedDrillConsultant, selectedDrillTimeframe]);

  // Export Data to CSV (Overview tab view only)
  const handleExport = () => {
    const headers = [
      'Consultant',
      'Team',
      'Role',
      'Next 7 Days Occupied',
      'Next 7 Days Available',
      'Next 30 Days Occupied',
      'Next 30 Days Available',
      'Next 90 Days Occupied',
      'Next 90 Days Available'
    ];

    const rows = [];
    filteredTeams.forEach(team => {
      team.consultants.forEach(c => {
        rows.push([
          c.name,
          team.name,
          c.role,
          c.next7Days.occupied,
          c.next7Days.available,
          c.next30Days.occupied,
          c.next30Days.available,
          c.next90Days.occupied,
          c.next90Days.available
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Capacity_Plan_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const teamOptions = useMemo(() => [
    { value: 'all', label: 'All Teams' },
    ...CAPACITY_TEAMS.map((team) => ({ value: team, label: team }))
  ], []);

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
      {/* Row 1: Page Title & Subtitle */}


      {/* Row 2: Main Tabs Navigation (Left-aligned folder style) */}
      <div className="capacity-tabs-container">
        <button
          className="capacity-tab"
          data-active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          <Eye size={15} className="capacity-tab-icon" />
          <span className="capacity-tab-label">Overview</span>
        </button>
        <button
          className="capacity-tab"
          data-active={activeTab === 'teams'}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={15} className="capacity-tab-icon" />
          <span className="capacity-tab-label">Teams</span>
        </button>
      </div>

      {/* Secondary Subtabs Bar (Visible only inside Teams Main Tab) */}
      {activeTab === 'teams' && (
        <div className="capacity-subtabs">
          {subTabs.map((tab) => (
            <button
              key={tab}
              className={`capacity-subtab-chip ${activeSubtab === tab ? 'active' : ''}`}
              onClick={() => setActiveSubtab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Filters & Action Bar */}
      <div className="capacity-filter-bar">
        <div className="capacity-filter-left">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search consultants..."
            classNames={{
              wrapper: 'capacity-search-wrapper',
              icon: 'capacity-search-icon',
              input: 'capacity-search-input'
            }}
          />

          {activeTab === 'overview' && (
            <Select
              value={selectedTeam}
              onChange={setSelectedTeam}
              options={teamOptions}
              placeholder="Filter by Team"
              width="team"
            />
          )}
        </div>
        {activeTab === 'overview' && (
          <div className="capacity-filter-right">
            <button className="capacity-export-btn" onClick={handleExport} title="Export current capacity planning report">
              <Download size={14} />
              <span>Export Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Row 4: Data View (Table) */}
      <div className="capacity-table-container">
        {activeTab === 'overview' ? (
          /* Tab 1: Overview Grid Table */
          <table className="capacity-table" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead className="capacity-table-head">
              <tr>
                <th rowSpan={2} className="capacity-th consultant-col">Consultant</th>
                <th colSpan={2} className="capacity-th text-center">Next 7 Days</th>
                <th colSpan={2} className="capacity-th text-center">Next 30 Days</th>
                <th colSpan={2} className="capacity-th text-center">Next 90 Days</th>
              </tr>
              <tr>
                <th className="capacity-th sub-th">Occupied</th>
                <th className="capacity-th sub-th">Available</th>
                <th className="capacity-th sub-th">Occupied</th>
                <th className="capacity-th sub-th">Available</th>
                <th className="capacity-th sub-th">Occupied</th>
                <th className="capacity-th sub-th">Available</th>
              </tr>
            </thead>
            <tbody className="capacity-table-body">
              {filteredTeams.flatMap((team) => {
                const rows = [
                  <tr
                    key={`team-group-${team.name}`}
                    className="capacity-team-row"
                    onClick={() => toggleTeam(team.name)}
                  >
                    <td colSpan={7} className="capacity-team-cell">
                      {team.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="capacity-team-name">{team.name}</span>
                      <span className="capacity-team-count">({team.consultants.length})</span>
                    </td>
                  </tr>
                ];

                if (!team.collapsed) {
                  team.consultants.forEach((c, index) => {
                    rows.push(
                      <tr
                        key={`c-row-${c.id}`}
                        className={`capacity-row ${index % 2 === 0 ? 'even' : 'odd'}`}
                      >
                        <td className="capacity-td consultant-col">
                          <span className="capacity-consultant-flat">{c.name}</span>
                        </td>
                        <td className="capacity-td numerical-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}>{c.next7Days.occupied}h</td>
                        <td className="capacity-td numerical-col available-cell clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}>{c.next7Days.available}h</td>
                        <td className="capacity-td numerical-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}>{c.next30Days.occupied}h</td>
                        <td className="capacity-td numerical-col available-cell clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}>{c.next30Days.available}h</td>
                        <td className="capacity-td numerical-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}>{c.next90Days.occupied}h</td>
                        <td className="capacity-td numerical-col available-cell clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}>{c.next90Days.available}h</td>
                      </tr>
                    );
                  });
                }
                return rows;
              })}
            </tbody>
          </table>
        ) : (
          /* Tab 2: Teams Performance Flat Table (No Accordions, No Arrows) */
          <table className="capacity-table" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead className="capacity-table-head">
              <tr>
                <th className="capacity-th consultant-col">Consultant</th>
                <th className="capacity-th capacity-col">Next 7 Days</th>
                <th className="capacity-th capacity-col">Next 30 Days</th>
                <th className="capacity-th capacity-col">Next 90 Days</th>
              </tr>
            </thead>
            <tbody className="capacity-table-body">
              {activeSubtabConsultants.map((c, index) => (
                <tr
                  key={`c-row-t2-flat-${c.id}`}
                  className={`capacity-row ${index % 2 === 0 ? 'even' : 'odd'}`}
                >
                  <td className="capacity-td consultant-col">
                    <span className="capacity-consultant-flat">{c.name}</span>
                  </td>
                  <td className="capacity-td capacity-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}>
                    <div className="capacity-bar-cell">
                      <div className="capacity-mini-bar">
                        <div
                          className="capacity-mini-fill occupied"
                          style={{
                            width: `${(c.next7Days.occupied / (c.next7Days.occupied + c.next7Days.available)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="capacity-cell-text">
                        {c.next7Days.occupied}h /{' '}
                        {c.next7Days.occupied + c.next7Days.available}h
                      </span>
                    </div>
                  </td>
                  <td className="capacity-td capacity-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}>
                    <div className="capacity-bar-cell">
                      <div className="capacity-mini-bar">
                        <div
                          className="capacity-mini-fill occupied"
                          style={{
                            width: `${(c.next30Days.occupied / (c.next30Days.occupied + c.next30Days.available)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="capacity-cell-text">
                        {c.next30Days.occupied}h /{' '}
                        {c.next30Days.occupied + c.next30Days.available}h
                      </span>
                    </div>
                  </td>
                  <td className="capacity-td capacity-col clickable-cell" title="Click to view detailed effort breakdown" onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}>
                    <div className="capacity-bar-cell">
                      <div className="capacity-mini-bar">
                        <div
                          className="capacity-mini-fill occupied"
                          style={{
                            width: `${(c.next90Days.occupied / (c.next90Days.occupied + c.next90Days.available)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="capacity-cell-text">
                        {c.next90Days.occupied}h /{' '}
                        {c.next90Days.occupied + c.next90Days.available}h
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {activeSubtabConsultants.length === 0 && (
                <tr>
                  <td colSpan={4} className="capacity-empty-row" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)' }}>
                    No consultants found for this team subtab
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Interactive Drill-Down Modal Overlay */}
      {selectedDrillConsultant && selectedDrillTimeframe && (
        <div className="capacity-modal-overlay">
          <div className="capacity-modal-container">
            {/* Modal Header */}
            <div className="capacity-modal-header">
              <h3 className="capacity-modal-title">
                {selectedDrillConsultant.name}'s MDs in Next {selectedDrillTimeframe} Days
              </h3>
              <button
                className="capacity-modal-close-icon"
                onClick={() => { setSelectedDrillConsultant(null); setSelectedDrillTimeframe(null); }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="capacity-modal-body">
              {drillAllocations.length === 0 ? (
                <div className="capacity-modal-empty">
                  <span>No available options</span>
                </div>
              ) : (
                <div className="capacity-modal-table-wrapper">
                  <table className="capacity-modal-table">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Summary</th>
                        <th rowSpan={2}>Status</th>
                        <th rowSpan={2}>Effort in MDs</th>
                        <th rowSpan={2}>Tester / Primary / Additional Developer</th>
                        <th rowSpan={2}>Start Date</th>
                        <th rowSpan={2}>End Date</th>
                        <th rowSpan={2}>Days Until End</th>
                        <th rowSpan={2}>Completed (%)</th>
                        <th rowSpan={2}>Remaining (%)</th>
                        <th colSpan={2} className="text-center">Efforts in Next {selectedDrillTimeframe} Days</th>
                      </tr>
                      <tr>
                        <th className="sub-th">MDs</th>
                        <th className="sub-th">Total MDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillAllocations.map((alloc) => (
                        <tr key={alloc.id}>
                          <td className="bold">{alloc.summary}</td>
                          <td>
                            <span className={`status-badge-drill ${alloc.status.toLowerCase().replace(' ', '-')}`}>
                              {alloc.status}
                            </span>
                          </td>
                          <td className="numerical">{alloc.effort}</td>
                          <td>{alloc.role}</td>
                          <td>{alloc.startDate}</td>
                          <td>{alloc.endDate}</td>
                          <td>{alloc.daysUntilEnd}</td>
                          <td>{alloc.completed}</td>
                          <td>{alloc.remaining}</td>
                          <td className="numerical bold color-primary">{alloc.timeframeMDs}</td>
                          <td className="numerical bold color-primary">{alloc.totalMDs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="capacity-modal-footer">
              <button
                className="capacity-modal-close-btn"
                onClick={() => { setSelectedDrillConsultant(null); setSelectedDrillTimeframe(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CapacityPlanningPage;
