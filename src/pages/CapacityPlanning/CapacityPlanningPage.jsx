import { useCallback, useMemo, useState, useEffect } from 'react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { StatsRowSkeleton, TableSkeleton } from '@components/feedback/Skeleton';
import { Select } from '@components/forms/Select/Select';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { ExportButton, Tabs } from '@components/common';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { capacityService } from '@services/capacityService';
import { settingsService } from '@services/settingsService';
import toast from 'react-hot-toast';

import { processCapacityData, countBusinessDays, parseDate } from './capacityCalculations';
import { exportToExcel, exportToPDF } from './capacityExportUtils';
import { SummaryView } from './components/SummaryView';
import { TeamView } from './components/TeamView';
import { DrillDownModal } from './components/DrillDownModal';

import './CapacityPlanningPage.css';

export function CapacityPlanningPage() {
  useDocumentTitle('Capacity Planning');

  // Load viewMode from localStorage or default to 'summary'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('capacity_view_mode') || 'summary';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [activeTeamTab, setActiveTeamTab] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState(new Set());
  const [weekendIndices, setWeekendIndices] = useState([5, 6]); // Default to Friday/Saturday

  // Drill-down Modal State
  const [selectedDrillConsultant, setSelectedDrillConsultant] = useState(null);
  const [selectedDrillTimeframe, setSelectedDrillTimeframe] = useState(null);

  // Fetch weekend configuration
  useEffect(() => {
    const loadWeekendConfig = async () => {
      try {
        const res = await settingsService.getWeekendConfig();
        if (res && res.weekendDays) {
          setWeekendIndices(res.weekendDays);
        }
      } catch (err) {
        console.error('Failed to load weekend configuration, using Friday/Saturday defaults', err);
      }
    };
    loadWeekendConfig();
  }, []);

  // Fetch capacity data
  const fetchPlan = useCallback(() => capacityService.getCapacityPlanning({ timeRange: 90 }), []);
  const { data, isLoading, error, refetch } = useAsync(fetchPlan);

  // Persist viewMode changes
  useEffect(() => {
    localStorage.setItem('capacity_view_mode', viewMode);
  }, [viewMode]);

  // Determine baseline reference date dynamically (from mock data in Feb 2026 or real-time Today)
  const referenceDate = useMemo(() => {
    const apiResult = data?.result || data || [];
    if (!Array.isArray(apiResult) || apiResult.length === 0) return new Date();

    const today = new Date();
    const hasFutureDates = apiResult.some(item => {
      if (!item.End_Date) return false;
      const end = new Date(item.End_Date);
      return !isNaN(end.getTime()) && end >= today;
    });

    if (hasFutureDates) {
      return today;
    } else {
      const startDates = apiResult
        .map(item => item.Start_Date ? new Date(item.Start_Date) : null)
        .filter(d => d && !isNaN(d.getTime()));
      if (startDates.length > 0) {
        return new Date(Math.min(...startDates.map(d => d.getTime())));
      }
      return new Date('2026-02-03'); // Fallback to mock base date
    }
  }, [data]);

  // Run calculation helpers to process and aggregate data
  const processedConsultants = useMemo(() => {
    const apiResult = data?.result || data || [];
    if (!Array.isArray(apiResult)) return [];
    return processCapacityData(apiResult, weekendIndices, referenceDate);
  }, [data, weekendIndices, referenceDate]);

  // Retrieve unique team names for team filter and team tabs
  const allTeams = useMemo(() => {
    const teams = new Set();
    processedConsultants.forEach(c => {
      if (c.teamName) teams.add(c.teamName);
    });
    return Array.from(teams).sort();
  }, [processedConsultants]);

  // Auto-select first team tab when switching to Team View
  useEffect(() => {
    if (viewMode === 'team' && allTeams.length > 0 && !activeTeamTab) {
      setActiveTeamTab(allTeams[0]);
    }
  }, [viewMode, allTeams, activeTeamTab]);

  // Filters application
  const filteredConsultants = useMemo(() => {
    return processedConsultants.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.teamName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = selectedTeamFilter === 'all' || c.teamName === selectedTeamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [processedConsultants, searchQuery, selectedTeamFilter]);

  // Group consultants by team for Summary View
  const groupedTeams = useMemo(() => {
    const groups = {};
    filteredConsultants.forEach(c => {
      const tName = c.teamName || 'Unassigned';
      if (!groups[tName]) {
        groups[tName] = {
          name: tName,
          consultants: []
        };
      }
      groups[tName].consultants.push(c);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredConsultants]);

  // Team tab data filter
  const activeSubtabConsultants = useMemo(() => {
    return processedConsultants.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesActiveTab = c.teamName === activeTeamTab;
      return matchesSearch && matchesActiveTab;
    });
  }, [processedConsultants, searchQuery, activeTeamTab]);

  // Collapsing handlers
  const toggleTeamCollapse = (teamName) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
  };

  // Helper values for current filter scope statistics
  const statsSummary = useMemo(() => {
    const ref = parseDate(referenceDate);
    
    const end7 = new Date(ref);
    end7.setDate(end7.getDate() + 6);
    const biz7 = countBusinessDays(ref, end7, weekendIndices);
    
    const end30 = new Date(ref);
    end30.setDate(end30.getDate() + 29);
    const biz30 = countBusinessDays(ref, end30, weekendIndices);
    
    const end90 = new Date(ref);
    end90.setDate(end90.getDate() + 89);
    const biz90 = countBusinessDays(ref, end90, weekendIndices);

    let totalOccupied7 = 0;
    let totalAvailable7 = 0;
    let totalOccupied30 = 0;
    let totalAvailable30 = 0;
    let totalOccupied90 = 0;
    let totalAvailable90 = 0;

    filteredConsultants.forEach(c => {
      totalOccupied7 += c.next7Days.occupied;
      totalAvailable7 += c.next7Days.available;
      totalOccupied30 += c.next30Days.occupied;
      totalAvailable30 += c.next30Days.available;
      totalOccupied90 += c.next90Days.occupied;
      totalAvailable90 += c.next90Days.available;
    });

    return {
      memberCount: filteredConsultants.length,
      biz7,
      biz30,
      biz90,
      totalOccupied7,
      totalAvailable7,
      totalOccupied30,
      totalAvailable30,
      totalOccupied90,
      totalAvailable90
    };
  }, [filteredConsultants, referenceDate, weekendIndices]);

  // Export handlers
  const handleExportExcel = () => {
    try {
      exportToExcel(groupedTeams, `Capacity_Planning_Report_${referenceDate.toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel report');
    }
  };

  const handleExportPDF = () => {
    try {
      exportToPDF(groupedTeams, `Capacity_Planning_Report_${referenceDate.toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF report');
    }
  };

  // Team selector choices
  const teamOptions = useMemo(() => [
    { value: 'all', label: 'All Teams' },
    ...allTeams.map(t => ({ value: t, label: t }))
  ], [allTeams]);

  // Drill-down calculations for the selected timeframe modal
  const drillAllocations = useMemo(() => {
    if (!selectedDrillConsultant) return [];
    
    const ref = parseDate(referenceDate);
    const windowDays = selectedDrillTimeframe || 30;
    const windowEnd = new Date(ref);
    windowEnd.setDate(windowEnd.getDate() + windowDays); // [today, today + N days] inclusive
    
    // 1. Filter assignments first
    const filtered = selectedDrillConsultant.assignments.map((alloc, idx) => {
      const start = parseDate(alloc.startDate);
      const end = parseDate(alloc.endDate);
      
      if (!start || !end) return null;
      
      // Filter status: in status "Open" or "FAT Testing"
      const statusLower = (alloc.status || '').toLowerCase().trim();
      const isStatusMatch = statusLower === 'open' || statusLower === 'fat testing';
      if (!isStatusMatch) return null;
      
      // Filter End_Date falling within [today, today + N days]
      const isEndInRange = end >= ref && end <= windowEnd;
      if (!isEndInRange) return null;
      
      return {
        ...alloc,
        startDateObj: start,
        endDateObj: end,
      };
    }).filter(Boolean);

    // 2. Group assignments by Project (or Summary + Start + End if Project is missing)
    const grouped = new Map();
    filtered.forEach(alloc => {
      const groupKey = alloc.project
        ? alloc.project.trim()
        : `${alloc.summary}_${alloc.startDate}_${alloc.endDate}`;
      
      const isInvalidRange = alloc.startDateObj && alloc.endDateObj && alloc.endDateObj < alloc.startDateObj;
        
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          ...alloc,
          effort: Number(alloc.effort) || 0,
          isInvalidRange
        });
      } else {
        const existing = grouped.get(groupKey);
        existing.effort += (Number(alloc.effort) || 0);
        if (alloc.isUnmatchedDeveloper) {
          existing.isUnmatchedDeveloper = true;
        }
        if (isInvalidRange) {
          existing.isInvalidRange = true;
        }
      }
    });

    return Array.from(grouped.values()).map((alloc, idx) => {
      const diffTime = alloc.endDateObj - ref;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysUntilEnd = diffDays > 0 ? `${diffDays} days` : 'Ended';
      
      return {
        id: `drill-${idx}`,
        summary: alloc.summary,
        status: alloc.status,
        startDate: alloc.startDate,
        endDate: alloc.endDate,
        daysUntilEnd,
        role: alloc.role,
        roleIcon: alloc.roleIcon,
        completedPercent: Math.round((1 - alloc.remainingPercent) * 100),
        remainingPercent: Math.round(alloc.remainingPercent * 100),
        effort: alloc.effort,
        project: alloc.project,
        assignedDeveloper: alloc.assignedDeveloper,
        additionalDevelopers: alloc.additionalDevelopers,
        isAssignedProgrammer: alloc.isAssignedProgrammer,
        isUnmatchedDeveloper: alloc.isUnmatchedDeveloper,
        isInvalidRange: alloc.isInvalidRange
      };
    });
  }, [selectedDrillConsultant, selectedDrillTimeframe, referenceDate]);

  const totalWindowMDs = useMemo(() => {
    if (!selectedDrillConsultant) return 0;
    if (selectedDrillTimeframe === 7) return selectedDrillConsultant.next7Days.occupied;
    if (selectedDrillTimeframe === 30) return selectedDrillConsultant.next30Days.occupied;
    if (selectedDrillTimeframe === 90) return selectedDrillConsultant.next90Days.occupied;
    return 0;
  }, [selectedDrillConsultant, selectedDrillTimeframe]);

  const hasUnmatchedDeveloper = useMemo(() => {
    return drillAllocations.some(alloc => alloc.isUnmatchedDeveloper);
  }, [drillAllocations]);

  // Dynamic status-based color class
  const getCardColorClass = (available) => {
    if (available <= 0) return 'color-danger';
    if (available <= 5) return 'color-warning';
    return 'color-success';
  };

  const openDrillDown = (consultant, timeframe) => {
    setSelectedDrillConsultant(consultant);
    setSelectedDrillTimeframe(timeframe);
  };

  const closeDrillDown = () => {
    setSelectedDrillConsultant(null);
    setSelectedDrillTimeframe(null);
  };

  if (error) {
    return <ErrorState title="Capacity planning could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading) {
    return (
      <div className="cp-container">
        <StatsRowSkeleton count={4} />
        <TableSkeleton rows={8} columns={7} />
      </div>
    );
  }

  return (
    <div className="cp-container">
      <Tabs
        tabs={[
          { id: 'summary', label: 'Summary View' },
          { id: 'team', label: 'Team View' },
        ]}
        activeTab={viewMode}
        onChange={setViewMode}
      />

      {/* Statistics and Details Strip */}
      <div className="cp-stats-strip">
        <div className="stat-card">
          <span className="stat-label">Team Members</span>
          <span className="stat-value">{statsSummary.memberCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Next 7 Days Business Days</span>
          <span className="stat-value">{statsSummary.biz7} days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Next 30 Days Business Days</span>
          <span className="stat-value">{statsSummary.biz30} days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Next 90 Days Business Days</span>
          <span className="stat-value">{statsSummary.biz90} days</span>
        </div>
      </div>

      {/* Filter Options */}
      <div className="cp-filter-panel">
        <div className="filter-row">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search consultants..."
            classNames={{
              wrapper: 'cp-search-wrapper',
              icon: 'cp-search-icon',
              input: 'cp-search-input'
            }}
          />

          {viewMode === 'summary' && (
            <Select
              value={selectedTeamFilter}
              onChange={setSelectedTeamFilter}
              options={teamOptions}
              width="team"
            />
          )}

          <div className="export-actions">
            <ExportButton onExportExcel={handleExportExcel} onExportPdf={handleExportPDF} />
          </div>
        </div>
      </div>

      {/* ── VIEW 1: Summary View Grouped Table ── */}

      {viewMode === 'summary' && (
        <SummaryView
          groupedTeams={groupedTeams}
          collapsedTeams={collapsedTeams}
          toggleTeamCollapse={toggleTeamCollapse}
          getCardColorClass={getCardColorClass}
          onDrillDown={openDrillDown}
        />
      )}

      {viewMode === 'team' && (
        <TeamView
          allTeams={allTeams}
          activeTeamTab={activeTeamTab}
          setActiveTeamTab={setActiveTeamTab}
          activeSubtabConsultants={activeSubtabConsultants}
          getCardColorClass={getCardColorClass}
          onDrillDown={openDrillDown}
        />
      )}

      <DrillDownModal
        consultant={selectedDrillConsultant}
        timeframe={selectedDrillTimeframe}
        allocations={drillAllocations}
        totalWindowMDs={totalWindowMDs}
        hasUnmatchedDeveloper={hasUnmatchedDeveloper}
        parseDate={parseDate}
        onClose={closeDrillDown}
      />
    </div>
  );
}

export default CapacityPlanningPage;
