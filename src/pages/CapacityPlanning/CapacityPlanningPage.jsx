import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Users,
  Eye,
  Star,
  UserCheck,
  PlusCircle,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  X,
  Info,
  AlertTriangle
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { ExportButton } from '@components/ui/ExportButton';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { capacityService } from '@services/capacityService';
import { settingsService } from '@services/settingsService';
import toast from 'react-hot-toast';

import {
  processCapacityData,
  countBusinessDays,
  parseDate,
  calculateProratedEffort
} from './capacityCalculations';
import {
  exportToExcel,
  exportToPDF
} from './capacityExportUtils';

import './CapacityPlanningPage.css';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

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
  const [teamViewSubMode, setTeamViewSubMode] = useState('utilization');


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

  const formatDateDMY = (dateStr) => {
    const parsed = parseDate(dateStr);
    if (!parsed) return dateStr || 'N/A';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getDerivedRole = (alloc) => {
    const statusLower = (alloc.status || '').toLowerCase().trim();
    if (statusLower === 'fat testing') {
      return {
        label: 'Tester',
        icon: <CheckSquare size={14} className="role-icon tester-dev" />,
        class: 'dev-badge dev-tester',
        tooltip: 'FAT Testing Role'
      };
    }
    if (alloc.isAssignedProgrammer) {
      return {
        label: 'Primary Developer',
        icon: <Star size={14} className="role-icon primary-dev" />,
        class: 'dev-badge dev-primary',
        tooltip: 'Primary Assigned Developer'
      };
    }
    return {
      label: 'Additional Developer',
      icon: <PlusCircle size={14} className="role-icon add-dev" />,
      class: 'dev-badge dev-additional',
      tooltip: 'Supporting Additional Developer'
    };
  };

  // Dynamic status-based color class
  const getCardColorClass = (available) => {
    if (available <= 0) return 'color-danger';
    if (available <= 5) return 'color-warning';
    return 'color-success';
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Primary':
        return <Star className="role-icon primary-dev" size={14} />;
      case 'Additional':
        return <PlusCircle className="role-icon add-dev" size={14} />;
      default:
        return <CheckSquare className="role-icon tester-dev" size={14} />;
    }
  };

  if (error) {
    return <ErrorState title="Capacity planning could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading) {
    return <Loader message="Loading capacity planning report..." />;
  }

  return (
    <div className="leave-management">
      <div className="leave-management-tabs">
        <button
          onClick={() => setViewMode('summary')}
          className="leave-management-tab"
          data-active={viewMode === 'summary'}
        >
          <FileText className="leave-management-tab-icon" />
          <span className="leave-management-tab-label">Summary View</span>
        </button>
        <button
          onClick={() => setViewMode('team')}
          className="leave-management-tab"
          data-active={viewMode === 'team'}
        >
          <Users className="leave-management-tab-icon" />
          <span className="leave-management-tab-label">Team View</span>
        </button>
      </div>

      <div className="leave-management-content">


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

            {viewMode === 'team' && (
              <div className="team-view-switcher">
                <button
                  type="button"
                  className={`switcher-btn ${teamViewSubMode === 'utilization' ? 'active' : ''}`}
                  onClick={() => setTeamViewSubMode('utilization')}
                >
                  Utilization View
                </button>
                <button
                  type="button"
                  className={`switcher-btn ${teamViewSubMode === 'compact' ? 'active' : ''}`}
                  onClick={() => setTeamViewSubMode('compact')}
                >
                  Compact View
                </button>
              </div>
            )}

            <ExportButton
              excel
              pdf
              onExcelExport={handleExportExcel}
              onPdfExport={handleExportPDF}
            />
          </div>
        </div>

        {/* ── VIEW 1: Summary View Grouped Table ── */}
        {viewMode === 'summary' && (
          <div className="cp-table-card">
            <div className="cp-table-wrapper">
              <table className="cp-data-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Consultant</th>
                    <th colSpan={2} className="text-center group-header">Next 7 Days</th>
                    <th colSpan={2} className="text-center group-header">Next 30 Days</th>
                    <th colSpan={2} className="text-center group-header">Next 90 Days</th>
                  </tr>
                  <tr>
                    <th className="sub-header">Occupied</th>
                    <th className="sub-header">Available</th>
                    <th className="sub-header">Occupied</th>
                    <th className="sub-header">Available</th>
                    <th className="sub-header">Occupied</th>
                    <th className="sub-header">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTeams.flatMap(team => {
                    const isCollapsed = collapsedTeams.has(team.name);
                    const rows = [
                      <tr
                        key={`team-${team.name}`}
                        className="cp-team-subheader-row"
                        onClick={() => toggleTeamCollapse(team.name)}
                      >
                        <td colSpan={7} className="cp-team-subheader-cell">
                          <div className="cp-team-subheader-content">
                            <div className="cp-team-subheader-left">
                              {isCollapsed ? <ChevronRight size={14} className="cp-team-chevron" /> : <ChevronDown size={14} className="cp-team-chevron" />}
                              <span className="team-name-label">{team.name}</span>
                            </div>
                            <span className="team-size-badge">{team.consultants.length} members</span>
                          </div>
                        </td>
                      </tr>
                    ];

                    if (!isCollapsed) {
                      team.consultants.forEach((c) => {
                        rows.push(
                          <tr key={c.id} className="cp-member-row">
                            <td className="member-name-cell">{c.name}</td>
                            <td
                              className="drilldown-cell occupied-cell"
                              onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}
                            >
                              {c.next7Days.occupied.toFixed(1)} MDs
                            </td>
                            <td
                              className={`available-cell ${getCardColorClass(c.next7Days.available)}`}
                            >
                              {c.next7Days.available.toFixed(1)} MDs
                            </td>
                            <td
                              className="drilldown-cell occupied-cell"
                              onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}
                            >
                              {c.next30Days.occupied.toFixed(1)} MDs
                            </td>
                            <td
                              className={`available-cell ${getCardColorClass(c.next30Days.available)}`}
                            >
                              {c.next30Days.available.toFixed(1)} MDs
                            </td>
                            <td
                              className="drilldown-cell occupied-cell"
                              onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}
                            >
                              {c.next90Days.occupied.toFixed(1)} MDs
                            </td>
                            <td
                              className={`available-cell ${getCardColorClass(c.next90Days.available)}`}
                            >
                              {c.next90Days.available.toFixed(1)} MDs
                            </td>
                          </tr>
                        );
                      });
                    }
                    return rows;
                  })}
                  {groupedTeams.length === 0 && (
                    <tr>
                      <td colSpan={7} className="cp-empty-state">
                        No consultants found matching the criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VIEW 2: Team View Tabs & KPI Cards ── */}
        {viewMode === 'team' && (
          <div className="cp-team-layout">
            {/* Vertical/Horizontal Navigation Rail for Teams */}
            <div className="cp-team-tabs">
              {allTeams.map(tName => (
                <button
                  key={tName}
                  className={`team-tab-btn ${activeTeamTab === tName ? 'active' : ''}`}
                  onClick={() => setActiveTeamTab(tName)}
                >
                  <Users size={14} className="tab-icon" />
                  <span>{tName}</span>
                </button>
              ))}
            </div>

            {/* Tab Content Panels */}
            <div className={`cp-team-panel ${teamViewSubMode === 'compact' ? 'grid-view' : 'list-view'}`}>
              {activeSubtabConsultants.map(c => {
                const total7 = c.next7Days.occupied + c.next7Days.available;
                const total30 = c.next30Days.occupied + c.next30Days.available;
                const total90 = c.next90Days.occupied + c.next90Days.available;

                const pct7 = total7 > 0 ? Math.round((c.next7Days.occupied / total7) * 100) : 0;
                const pct30 = total30 > 0 ? Math.round((c.next30Days.occupied / total30) * 100) : 0;
                const pct90 = total90 > 0 ? Math.round((c.next90Days.occupied / total90) * 100) : 0;

                const totalAvailable = c.next7Days.available + c.next30Days.available + c.next90Days.available;

                if (teamViewSubMode === 'compact') {
                  return (
                    <div key={c.id} className="consultant-card compact">
                      <div className="consultant-info-header">
                        <div className="consultant-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                          {c.photo ? (
                            <img
                              src={c.photo}
                              alt={c.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span
                            style={{
                              display: c.photo ? 'none' : 'flex',
                              width: '100%',
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '14px',
                              color: 'inherit'
                            }}
                          >
                            {c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="consultant-name">{c.name}</h3>
                          <p className="consultant-role">{c.role}</p>
                        </div>
                      </div>

                      <div className="compact-kpi-grid">
                        <div
                          className="compact-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}
                        >
                          <div className="compact-kpi-header">Next 7 Days</div>
                          <div className="compact-kpi-row">
                            <div>
                              <span className="lbl">Occupied</span>
                              <span className="val">{c.next7Days.occupied.toFixed(1)} MDs</span>
                            </div>
                            <div>
                              <span className="lbl">Available</span>
                              <span className={`val ${getCardColorClass(c.next7Days.available)}`}>
                                {c.next7Days.available.toFixed(1)} MDs
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="compact-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}
                        >
                          <div className="compact-kpi-header">Next 30 Days</div>
                          <div className="compact-kpi-row">
                            <div>
                              <span className="lbl">Occupied</span>
                              <span className="val">{c.next30Days.occupied.toFixed(1)} MDs</span>
                            </div>
                            <div>
                              <span className="lbl">Available</span>
                              <span className={`val ${getCardColorClass(c.next30Days.available)}`}>
                                {c.next30Days.available.toFixed(1)} MDs
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="compact-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}
                        >
                          <div className="compact-kpi-header">Next 90 Days</div>
                          <div className="compact-kpi-row">
                            <div>
                              <span className="lbl">Occupied</span>
                              <span className="val">{c.next90Days.occupied.toFixed(1)} MDs</span>
                            </div>
                            <div>
                              <span className="lbl">Available</span>
                              <span className={`val ${getCardColorClass(c.next90Days.available)}`}>
                                {c.next90Days.available.toFixed(1)} MDs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={c.id} className="consultant-card utilization">
                      <div className="consultant-info-left">
                        <div className="consultant-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                          {c.photo ? (
                            <img
                              src={c.photo}
                              alt={c.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span
                            style={{
                              display: c.photo ? 'none' : 'flex',
                              width: '100%',
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '14px',
                              color: 'inherit'
                            }}
                          >
                            {c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="consultant-text">
                          <h3 className="consultant-name">{c.name}</h3>
                          <p className="consultant-role">{c.role}</p>
                        </div>
                      </div>

                      <div className="consultant-kpi-middle">
                        <div
                          className="row-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(7); }}
                        >
                          <div className="row-kpi-header">
                            <span className="lbl">Next 7 Days</span>
                            <span className="row-kpi-percent">{pct7}%</span>
                          </div>
                          <div className="row-kpi-sub">
                            {c.next7Days.occupied.toFixed(1)} / {total7.toFixed(1)} MDs
                          </div>
                          <div className="row-progress-bar">
                            <div className="row-progress-fill" style={{ width: `${pct7}%` }} />
                          </div>
                        </div>

                        <div
                          className="row-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(30); }}
                        >
                          <div className="row-kpi-header">
                            <span className="lbl">Next 30 Days</span>
                            <span className="row-kpi-percent">{pct30}%</span>
                          </div>
                          <div className="row-kpi-sub">
                            {c.next30Days.occupied.toFixed(1)} / {total30.toFixed(1)} MDs
                          </div>
                          <div className="row-progress-bar">
                            <div className="row-progress-fill" style={{ width: `${pct30}%` }} />
                          </div>
                        </div>

                        <div
                          className="row-kpi-section"
                          onClick={() => { setSelectedDrillConsultant(c); setSelectedDrillTimeframe(90); }}
                        >
                          <div className="row-kpi-header">
                            <span className="lbl">Next 90 Days</span>
                            <span className="row-kpi-percent">{pct90}%</span>
                          </div>
                          <div className="row-kpi-sub">
                            {c.next90Days.occupied.toFixed(1)} / {total90.toFixed(1)} MDs
                          </div>
                          <div className="row-progress-bar">
                            <div className="row-progress-fill" style={{ width: `${pct90}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="consultant-total-right">
                        <span className="total-lbl">Total Available</span>
                        <span className="total-val">{totalAvailable.toFixed(1)} MDs</span>
                      </div>
                    </div>
                  );
                }
              })}
              {activeSubtabConsultants.length === 0 && (
                <div className="cp-empty-state">
                  No consultants found for this team tab
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Drill-down Assignments Modal Dialog ── */}
      {selectedDrillConsultant && selectedDrillTimeframe && (
        <div className="cp-modal-backdrop">
          <div className={`cp-modal-card accent-${selectedDrillTimeframe}`} role="dialog" aria-modal="true">
            <div className="cp-modal-header">
              <div>
                <h2 className="cp-modal-title">
                  {selectedDrillConsultant.name}'s MDs in Next {selectedDrillTimeframe} Days
                </h2>
              </div>
              <button
                type="button"
                className="cp-modal-close"
                onClick={() => { setSelectedDrillConsultant(null); setSelectedDrillTimeframe(null); }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="cp-modal-body">
              {hasUnmatchedDeveloper && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#b45309',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>Some records could not be matched to a team member and may affect totals.</span>
                </div>
              )}

              {drillAllocations.length === 0 ? (
                <div className="cp-modal-empty">
                  <Info size={24} />
                  <p>No assignments found for the next {selectedDrillTimeframe} days.</p>
                </div>
              ) : (
                <div className="cp-modal-table-wrapper">
                  <table className="cp-modal-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Summary</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th>Start Date / End Date</th>
                        <th>Effort (MDs)</th>
                        <th>Total MDs in this window</th>
                        {hasUnmatchedDeveloper && <th>Data flag</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {drillAllocations.map((alloc, idx) => {
                        const devRole = getDerivedRole(alloc);
                        return (
                          <tr key={alloc.id}>
                            <td className="bold-cell" style={{ maxWidth: '250px' }}>
                              <ProjectText projectStr={alloc.project} />
                            </td>
                            <td style={{ maxWidth: '250px' }}>
                              <SummaryText text={alloc.summary} />
                            </td>
                            <td>
                              <span className={`status-badge ${alloc.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                {alloc.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div className={devRole.class} title={devRole.tooltip} style={{ cursor: 'help' }}>
                                  {devRole.icon}
                                  <span>{devRole.label}</span>
                                </div>
                                {devRole.label === 'Additional Developer' && alloc.assignedDeveloper && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Supporting: {alloc.assignedDeveloper}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {formatDateDMY(alloc.startDate)} - {formatDateDMY(alloc.endDate)}
                                {alloc.isInvalidRange && (
                                  <AlertTriangle
                                    size={14}
                                    style={{ color: '#d97706', cursor: 'help' }}
                                    title="Invalid date range in source data"
                                  />
                                )}
                              </span>
                            </td>
                            <td>{Number(alloc.effort).toFixed(1)} MDs</td>
                            {idx === 0 && (
                              <td rowSpan={drillAllocations.length} className="total-window-cell">
                                {totalWindowMDs.toFixed(1)} MDs
                              </td>
                            )}
                            {hasUnmatchedDeveloper && (
                              <td>
                                {alloc.isUnmatchedDeveloper ? (
                                  <span
                                    className="dev-badge dev-tester"
                                    style={{ display: 'inline-flex', gap: '4px', cursor: 'help' }}
                                    title="This developer's name could not be matched to a known employee record, so these numbers may be unreliable."
                                  >
                                    <AlertTriangle size={12} style={{ color: '#d97706' }} />
                                    Unmatched developer
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {drillAllocations.length > 0 && (
                <p className="cp-modal-footnote" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
                  * Note: "Total MDs in this window" reflects the pro-rated upcoming effort allocated strictly within the {selectedDrillTimeframe}-day window for all active assignments, which may not equal the simple sum of total raw effort values.
                </p>
              )}
            </div>

            <div className="cp-modal-footer">
              <button
                type="button"
                className="cp-modal-close-btn"
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

function ProjectText({ projectStr }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!projectStr) return <span>N/A</span>;

  const parts = projectStr.split(':');
  let ref = '';
  let title = projectStr;

  if (parts.length >= 2) {
    ref = parts[0].trim();
    title = parts.slice(1).join(':').trim();
  }

  const displayRef = ref ? (ref.startsWith('#') ? ref : `#${ref}`) : '';

  if (title.length <= 30) {
    return (
      <span>
        {displayRef && <strong style={{ color: 'var(--text-secondary)' }}>{displayRef} · </strong>}
        {title}
      </span>
    );
  }

  return (
    <span>
      {displayRef && <strong style={{ color: 'var(--text-secondary)' }}>{displayRef} · </strong>}
      {isExpanded ? title : `${title.slice(0, 30)}...`}{' '}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--c-primary)',
          padding: '0',
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'underline',
          display: 'inline'
        }}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  );
}

function SummaryText({ text }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return <span>N/A</span>;
  if (text.length <= 30) return <span>{text}</span>;

  return (
    <span>
      {isExpanded ? text : `${text.slice(0, 30)}...`}{' '}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--c-primary)',
          padding: '0',
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'underline',
          display: 'inline'
        }}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  );
}

export default CapacityPlanningPage;
