import React, { useCallback, useMemo, useState, useEffect, useRef, Fragment } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Users,
  Eye,
  Star,
  PlusCircle,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  GanttChart,
  X,
  Info,
  AlertTriangle,
  CalendarDays,
  BarChart3,
  EyeOff,
  ChevronsUpDown,
  ChevronsDownUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

import { useEmployeePhotos } from '@hooks/useEmployeePhotos';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
import { Select } from '@components/forms/Select/Select';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { ExportButton } from '@components/ui/ExportButton';
import { useAsync } from '@hooks/useAsync';
import ProgressTooltip from '@pages/ProjectMonitoring/components/ProgressTooltip';
import { useAuth } from '@hooks/useAuth';
import { useDebounce } from '@hooks/useDebounce';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { capacityService } from '@services/capacityService';
import { settingsService } from '@services/settingsService';
import { leaveService } from '@services/leaveService';
import { consultantService } from '@services/consultantService';
import toast from 'react-hot-toast';

import {
  processCapacityData,
  countBusinessDays,
  parseDate,
  calculateProratedEffort
} from './capacityCalculations';
import {
  buildProjectModel,
  filterProjectModel,
  buildGanttLayout,
  getZeroEffortReason
} from './projectModel.js';
import { PMStatusGroups, PMStatus, mapStatusToIds } from '../ProjectMonitoring/utils/staticData';
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
  const { hasPermission } = useAuth();
  const canExport = hasPermission('CAPACITY_PLANNING_EXPORT');

  // Load viewMode from localStorage or default to 'summary'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('capacity_view_mode') || 'summary';
  });

  // Each tab keeps its own independent search text — switching tabs must
  // not clear or share what was typed in another tab's search box.
  const [summarySearchQuery, setSummarySearchQuery] = useState('');
  const debouncedSummarySearchQuery = useDebounce(summarySearchQuery, 500);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const debouncedTeamSearchQuery = useDebounce(teamSearchQuery, 500);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const debouncedProjectSearchQuery = useDebounce(projectSearchQuery, 500);
  const [ganttSearchQuery, setGanttSearchQuery] = useState('');
  const debouncedGanttSearchQuery = useDebounce(ganttSearchQuery, 500);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [activeTeamTab, setActiveTeamTab] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState(new Set());
  const [weekendIndices, setWeekendIndices] = useState([5, 6]); // Default to Friday/Saturday
  const [holidaySet, setHolidaySet] = useState(() => new Set());
  const [teamPercentMap, setTeamPercentMap] = useState(() => new Map());
  const [teamViewSubMode, setTeamViewSubMode] = useState('utilization');

  // Project View state
  const [collapsedProjects, setCollapsedProjects] = useState(new Set());
  // CRs whose developer table is open (default closed).
  const [expandedCrs, setExpandedCrs] = useState(new Set());
  // Per-CR developer table sort: { [crKey]: { col, dir } }
  const [devSort, setDevSort] = useState({});
  const [projectViewTimeframe, setProjectViewTimeframe] = useState(30);
  // SDLC (7-stage) vs Tech (17-stage) lifecycle — same toggle concept as
  // Gantt View / Project Monitoring, kept independent so switching one
  // tab's mode doesn't affect the other.
  const [projectViewLifecycleMode, setProjectViewLifecycleMode] = useState('business');
  // Clicking a legend chip filters the table to that stage; clicking the
  // same chip again clears it. Reset whenever the lifecycle mode toggles
  // since the stage id set (7-stage vs 17-stage) changes underneath it.
  const [projectStageFilter, setProjectStageFilter] = useState(null);

  // Gantt View — SDLC (7-stage) vs Tech (17-stage) lifecycle, same toggle
  // concept as Project Monitoring, reusing its actual PMStatusGroups/PMStatus
  // stage definitions rather than a separate guessed color mapping.
  const [ganttLifecycleMode, setGanttLifecycleMode] = useState('business');
  const [ganttStageFilter, setGanttStageFilter] = useState(null);
  const [collapsedGanttProjects, setCollapsedGanttProjects] = useState(new Set());



  // Drill-down Modal State
  const [selectedDrillConsultant, setSelectedDrillConsultant] = useState(null);
  const [selectedDrillTimeframe, setSelectedDrillTimeframe] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Fetch the org's actual weekend days from employee work schedules, rather
  // than the standalone System Settings weekend config — employees can be on
  // a CUSTOM schedule with their own weekend days, and that's what actually
  // governs availability. Falls back to Friday/Saturday if nobody is on a
  // CUSTOM schedule (custom_weekend_days is only populated for that group).
  useEffect(() => {
    const loadWeekendDays = async () => {
      try {
        const res = await leaveService.getWorkScheduleSummary();
        const groups = res?.results || [];
        const customGroups = groups.filter(g => Array.isArray(g.custom_weekend_days) && g.custom_weekend_days.length > 0);
        if (customGroups.length > 0) {
          const largest = customGroups.reduce((a, b) => (b.employee_count > a.employee_count ? b : a));
          setWeekendIndices(largest.custom_weekend_days);
        }
      } catch (err) {
        console.error('Failed to load employee work schedules, using Friday/Saturday defaults', err);
      }
    };
    loadWeekendDays();
  }, []);

  // Fetch public holidays so they're excluded from business-day counts the
  // same way weekends are — a holiday inside an assignment's window
  // shouldn't count as available/occupied capacity.
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidays = await leaveService.listHolidays();
        const dates = new Set();
        (Array.isArray(holidays) ? holidays : []).forEach(h => {
          if (!h.is_active) return;
          (h.dates || []).forEach(d => dates.add(d));
        });
        setHolidaySet(dates);
      } catch (err) {
        console.error('Failed to load holidays, proceeding without holiday exclusions', err);
      }
    };
    loadHolidays();
  }, []);

  // Fetch each team's configured primary/additional developer contribution
  // split (Teams screen) so the 70/30 split isn't a fixed constant — teams
  // with no percentages configured fall back to 70/30 inside calculateDeveloperMDs.
  useEffect(() => {
    const loadTeamPercentages = async () => {
      try {
        const teams = await consultantService.getTeams();
        const map = new Map();
        (Array.isArray(teams) ? teams : teams?.results || []).forEach(t => {
          // Number(null) === 0 in JS, which Number.isFinite would wrongly
          // accept as "configured to 0%" — an unconfigured team (Engineering
          // has pri/add === null) must fall back to the 70/30 default, not
          // silently zero out everyone's effort. Reject null/undefined first.
          if (t.pri_dev_contr_per == null || t.add_dev_contr_per == null) return;
          const pri = Number(t.pri_dev_contr_per);
          const add = Number(t.add_dev_contr_per);
          if (Number.isFinite(pri) && Number.isFinite(add)) {
            map.set(t.id, { pri: pri / 100, add: add / 100 });
          }
        });
        setTeamPercentMap(map);
      } catch (err) {
        console.error('Failed to load team contribution percentages, using 70/30 defaults', err);
      }
    };
    loadTeamPercentages();
  }, []);


  // Fetch capacity data
  const fetchPlan = useCallback(() => capacityService.getCapacityPlanning({ timeRange: 90 }), []);
  const { data, isLoading, error, refetch } = useAsync(fetchPlan);

  // Same employee photo directory the Consultants page uses; falls back to an
  // initials avatar when an employee has no photo or the lookup fails.
  const { getPhoto } = useEmployeePhotos({ includeInactive: true });

  // Persist viewMode changes
  useEffect(() => {
    localStorage.setItem('capacity_view_mode', viewMode);
  }, [viewMode]);

  // Determine baseline reference date dynamically (from mock data in Feb 2026 or real-time Today)
  // Next 7/30/90 Days is always measured from today, full stop — there is
  // no fallback to an "earliest start date" anchor. If every project in the
  // dataset is dated entirely in the past, that correctly means zero
  // occupied MDs (nothing overlaps a future window), not a silently
  // rewound "today" that would make stale data look active.
  const referenceDate = useMemo(() => new Date(), [data]);

  // Run calculation helpers to process and aggregate data
  const processedConsultants = useMemo(() => {
    const apiResult = data?.result || data || [];
    if (!Array.isArray(apiResult)) return [];
    return processCapacityData(apiResult, weekendIndices, referenceDate, holidaySet, teamPercentMap);
  }, [data, weekendIndices, referenceDate, holidaySet, teamPercentMap]);

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
      const matchesSearch = c.name.toLowerCase().includes(debouncedSummarySearchQuery.toLowerCase()) ||
        c.teamName.toLowerCase().includes(debouncedSummarySearchQuery.toLowerCase());
      const matchesTeam = selectedTeamFilter === 'all' || c.teamName === selectedTeamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [processedConsultants, debouncedSummarySearchQuery, selectedTeamFilter]);

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

  // Shared Project -> CR -> Developer model (see projectModel.js). Both Project
  // View and Gantt View read this one structure; each applies its own search /
  // stage filters on top. Every CR keeps its own summary, status, dates and
  // effort — nothing is taken from "the first CR" of a project.
  const projectModel = useMemo(
    () => buildProjectModel(processedConsultants, {
      timeframe: projectViewTimeframe,
      referenceDate,
      weekendDays: weekendIndices,
      holidaySet,
    }),
    [processedConsultants, projectViewTimeframe, referenceDate, weekendIndices, holidaySet]
  );

  const stageForStatus = (status, mode) => {
    const { statusId, statusGroup } = mapStatusToIds(status);
    return mode === 'development'
      ? PMStatus.find(s => s.id === statusId)
      : PMStatusGroups.find(sg => sg.id === statusGroup);
  };
  const withStage = (cr, mode) => {
    const stage = stageForStatus(cr.status, mode);
    return {
      ...cr,
      stageKey: stage ? stage.id : null,
      stageName: stage ? stage.name : 'Unmapped',
      stageColor: stage ? stage.color : '#9ca3af',
    };
  };

  // Project View: CR-level stage + Next-N-Days window filters. A CR with no
  // valid dates has no span to test, so it is never excluded by the window.
  const projectCrFilter = (windowDays) => (cr) => {
    if (projectStageFilter && withStage(cr, projectViewLifecycleMode).stageKey !== projectStageFilter) return false;
    if (cr.scheduleState !== 'ok') return true;
    return cr[`overlaps${windowDays}`];
  };

  const projectGroups = useMemo(() => {
    const filtered = filterProjectModel(projectModel, {
      query: debouncedProjectSearchQuery,
      crFilter: projectCrFilter(projectViewTimeframe),
    });
    return filtered
      .map(g => ({ ...g, crs: g.crs.map(cr => withStage(cr, projectViewLifecycleMode)) }))
      .sort((a, b) => b.totalProratedEffort - a.totalProratedEffort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectModel, debouncedProjectSearchQuery, projectViewLifecycleMode, projectStageFilter, projectViewTimeframe]);

  // Distinct projects / CRs per window (search + stage applied, independent of
  // the 7/30/90 toggle) for the stats strip.
  const projectCountsByWindow = useMemo(() => {
    const countFor = (w) => {
      const filtered = filterProjectModel(projectModel, {
        query: debouncedProjectSearchQuery,
        crFilter: projectCrFilter(w),
      });
      return { projects: filtered.length, crs: filtered.reduce((n, p) => n + p.crs.length, 0) };
    };
    return { next7: countFor(7), next30: countFor(30), next90: countFor(90) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectModel, debouncedProjectSearchQuery, projectStageFilter, projectViewLifecycleMode]);

  const toggleProjectCollapse = (key) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDevSort = (crKey, col) => {
    setDevSort(prev => {
      const cur = prev[crKey];
      const dir = cur && cur.col === col && cur.dir === 'asc' ? 'desc' : 'asc';
      return { ...prev, [crKey]: { col, dir } };
    });
  };

  // Expand / collapse every project currently listed (after search and filters).
  const allProjectsExpanded = projectGroups.length > 0 && projectGroups.every(g => !collapsedProjects.has(g.key));
  const toggleAllProjects = () => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      projectGroups.forEach(g => {
        if (allProjectsExpanded) next.add(g.key);
        else next.delete(g.key);
      });
      return next;
    });
  };

  const toggleCrExpand = (key) => {
    setExpandedCrs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGanttProject = (key) => {
    setCollapsedGanttProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Gantt View — same model, its OWN search + stage filter. One bar per CR on
  // a shared timeline, positioned from that CR's own Start/End Date.
  const ganttData = useMemo(() => {
    const filtered = filterProjectModel(projectModel, {
      query: debouncedGanttSearchQuery,
      crFilter: ganttStageFilter
        ? (cr) => withStage(cr, ganttLifecycleMode).stageKey === ganttStageFilter
        : null,
    });
    const layout = buildGanttLayout(filtered, referenceDate);
    return {
      ...layout,
      projects: layout.projects.map(p => ({
        ...p,
        crs: p.crs.map(cr => withStage(cr, ganttLifecycleMode)),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectModel, debouncedGanttSearchQuery, referenceDate, ganttLifecycleMode, ganttStageFilter]);

  const allGanttExpanded = ganttData.projects.length > 0 && ganttData.projects.every(g => !collapsedGanttProjects.has(g.key));
  const toggleAllGanttProjects = () => {
    setCollapsedGanttProjects(prev => {
      const next = new Set(prev);
      ganttData.projects.forEach(g => {
        if (allGanttExpanded) next.add(g.key);
        else next.delete(g.key);
      });
      return next;
    });
  };

  // Team tab data filter
  const activeSubtabConsultants = useMemo(() => {
    return processedConsultants.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(debouncedTeamSearchQuery.toLowerCase());
      const matchesActiveTab = c.teamName === activeTeamTab;
      return matchesSearch && matchesActiveTab;
    });
  }, [processedConsultants, debouncedTeamSearchQuery, activeTeamTab]);

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
    const biz7 = countBusinessDays(ref, end7, weekendIndices, holidaySet);

    const end30 = new Date(ref);
    end30.setDate(end30.getDate() + 29);
    const biz30 = countBusinessDays(ref, end30, weekendIndices, holidaySet);

    const end90 = new Date(ref);
    end90.setDate(end90.getDate() + 89);
    const biz90 = countBusinessDays(ref, end90, weekendIndices, holidaySet);

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
  }, [filteredConsultants, referenceDate, weekendIndices, holidaySet]);

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
    windowEnd.setDate(windowEnd.getDate() + windowDays - 1); // matches calculateProratedEffort's window

    // 1. Filter assignments first
    const filtered = selectedDrillConsultant.assignments.map((alloc, idx) => {
      const start = parseDate(alloc.startDate);
      const end = parseDate(alloc.endDate);

      if (!start || !end) return null;

      // Show any assignment that overlaps this window at all, using the
      // same overlap math as calculateProratedEffort — so the modal always
      // shows exactly the assignments that contributed to the Occupied MDs
      // figure. Previously this required End_Date to fall inside the
      // window AND Status to be one of a fixed set of values, which silently
      // hid assignments that ran past the window or had any other status even
      // though they were counted in the Occupied total.
      const overlapStart = new Date(Math.max(ref.getTime(), start.getTime()));
      const overlapEnd = new Date(Math.min(end.getTime(), windowEnd.getTime()));
      if (overlapStart > overlapEnd) return null;

      // The portion of this assignment's own effort that actually falls
      // inside this window — same math that produced the Occupied MDs
      // figure the user clicked, so the modal can show why the two numbers
      // differ instead of just asserting a total.
      const proratedEffort = calculateProratedEffort(
        alloc.startDate, alloc.endDate, Number(alloc.effort) || 0,
        windowDays, referenceDate, weekendIndices, holidaySet
      );

      // Expose the actual business-day ratio behind that proration (e.g.
      // "4/72 biz days") so the modal shows the math, not just the result.
      const totalBizDays = countBusinessDays(start, end, weekendIndices, holidaySet);
      const overlapBizDays = countBusinessDays(overlapStart, overlapEnd, weekendIndices, holidaySet);

      return {
        ...alloc,
        startDateObj: start,
        endDateObj: end,
        proratedEffort,
        totalBizDays,
        overlapBizDays,
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
          proratedEffort: alloc.proratedEffort,
          totalBizDays: alloc.totalBizDays,
          overlapBizDays: alloc.overlapBizDays,
          isInvalidRange
        });
      } else {
        const existing = grouped.get(groupKey);
        existing.effort += (Number(alloc.effort) || 0);
        existing.proratedEffort += alloc.proratedEffort;
        existing.totalBizDays += alloc.totalBizDays;
        existing.overlapBizDays += alloc.overlapBizDays;
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
        proratedEffort: alloc.proratedEffort,
        totalBizDays: alloc.totalBizDays,
        overlapBizDays: alloc.overlapBizDays,
        project: alloc.project,
        assignedDeveloper: alloc.assignedDeveloper,
        additionalDevelopers: alloc.additionalDevelopers,
        isAssignedProgrammer: alloc.isAssignedProgrammer,
        isUnmatchedDeveloper: alloc.isUnmatchedDeveloper,
        isInvalidRange: alloc.isInvalidRange
      };
    });
  }, [selectedDrillConsultant, selectedDrillTimeframe, referenceDate, weekendIndices, holidaySet]);

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

  function CapacityPlanningSkeleton() {
    if (viewMode === 'team') {
      return (
        <div className="cp-team-layout">
          {/* Horizontal Team Tabs Skeleton */}
          <div className="cp-team-tabs" style={{ display: 'flex', gap: '12px', padding: '16px 0', overflowX: 'auto' }}>
            {[
              { width: 60 }, { width: 100 }, { width: 50 }, { width: 80 }, { width: 70 }, { width: 90 }, { width: 110 }
            ].map((tab, i) => (
              <div 
                key={i}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 16px', 
                  borderRadius: '16px', 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-primary)',
                  flexShrink: 0,
                  height: '32px'
                }}
              >
                <Skeleton height={14} width={14} style={{ borderRadius: '2px' }} />
                <Skeleton height={12} width={tab.width} style={{ borderRadius: '2px' }} />
              </div>
            ))}
          </div>
          {/* Cards Panel Skeleton */}
          <div className={`cp-team-panel ${teamViewSubMode === 'compact' ? 'grid-view' : 'list-view'}`} style={teamViewSubMode === 'compact' ? {} : { display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {teamViewSubMode === 'compact' ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="consultant-card compact" style={{ padding: '16px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                  <div className="consultant-info-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Skeleton height={40} width={40} style={{ borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <Skeleton height={14} width="70%" style={{ borderRadius: '2px' }} />
                      <Skeleton height={12} width="50%" style={{ borderRadius: '2px' }} />
                    </div>
                  </div>
                  <div className="compact-kpi-grid">
                    {[...Array(3)].map((_, colIdx) => (
                      <div key={colIdx} className="compact-kpi-section" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px' }}>
                        <div className="compact-kpi-header" style={{ marginBottom: '10px' }}>
                          <Skeleton height={12} width="80px" style={{ borderRadius: '2px' }} />
                        </div>
                        <div className="compact-kpi-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Skeleton height={10} width="50px" style={{ borderRadius: '2px' }} />
                            <Skeleton height={14} width="40px" style={{ borderRadius: '2px' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <Skeleton height={10} width="60px" style={{ borderRadius: '2px' }} />
                            <Skeleton height={14} width="50px" style={{ borderRadius: '2px' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="consultant-card list-card" style={{
                  padding: '16px 24px',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  background: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px'
                }}>
                  {/* Left: Avatar & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '250px', flexShrink: 0 }}>
                    <Skeleton height={40} width={40} style={{ borderRadius: '50%' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <Skeleton height={14} width="80%" style={{ borderRadius: '4px' }} />
                      <Skeleton height={12} width="50%" style={{ borderRadius: '4px' }} />
                    </div>
                  </div>
  
                  {/* Middle: 3 KPI Columns */}
                  <div style={{ display: 'flex', flex: 1, gap: '32px' }}>
                    {[...Array(3)].map((_, colIdx) => (
                      <div key={colIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Skeleton height={12} width="60px" style={{ borderRadius: '2px' }} />
                          <Skeleton height={12} width="30px" style={{ borderRadius: '2px' }} />
                        </div>
                        <Skeleton height={12} width="80px" style={{ borderRadius: '2px' }} />
                        <Skeleton height={4} width="100%" style={{ borderRadius: '2px', marginTop: '4px' }} />
                      </div>
                    ))}
                  </div>
  
                  {/* Right: Total Available */}
                  <div style={{
                    width: '120px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '8px',
                    borderLeft: '1px solid var(--border-primary)',
                    paddingLeft: '24px'
                  }}>
                    <Skeleton height={12} width="80px" style={{ borderRadius: '2px' }} />
                    <Skeleton height={16} width="60px" style={{ borderRadius: '2px' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (viewMode === 'summary') {
      return (
        <div className="cp-table-card">
          <div className="cp-table-wrapper">
            <table className="cp-data-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '22%' }}><Skeleton height={16} width="80px" style={{ borderRadius: '4px' }} /></th>
                  <th colSpan={2} className="text-center group-header"><Skeleton height={16} width="100px" style={{ borderRadius: '4px', margin: '0 auto' }} /></th>
                  <th colSpan={2} className="text-center group-header"><Skeleton height={16} width="100px" style={{ borderRadius: '4px', margin: '0 auto' }} /></th>
                  <th colSpan={2} className="text-center group-header"><Skeleton height={16} width="100px" style={{ borderRadius: '4px', margin: '0 auto' }} /></th>
                </tr>
                <tr>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                  <th className="sub-header"><Skeleton height={12} width="60px" style={{ borderRadius: '4px' }} /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((groupIndex) => (
                  <Fragment key={`group-${groupIndex}`}>
                    <tr className="cp-team-subheader-row">
                      <td colSpan={7} className="cp-team-subheader-cell">
                        <div className="cp-team-subheader-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div className="cp-team-subheader-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Skeleton height={14} width={14} style={{ borderRadius: '2px' }} />
                            <Skeleton height={16} width={100 + (groupIndex * 20)} style={{ borderRadius: '4px' }} />
                          </div>
                          <Skeleton height={20} width={70} style={{ borderRadius: '10px' }} />
                        </div>
                      </td>
                    </tr>
                    {[1, 2, 3].map((rowIndex) => (
                      <tr key={`row-${groupIndex}-${rowIndex}`} className="cp-member-row">
                        <td className="member-name-cell"><Skeleton height={14} width={120 + ((rowIndex * 30) % 60)} style={{ borderRadius: '4px' }} /></td>
                        <td className="drilldown-cell occupied-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                        <td className="available-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                        <td className="drilldown-cell occupied-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                        <td className="available-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                        <td className="drilldown-cell occupied-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                        <td className="available-cell"><Skeleton height={14} width={40} style={{ borderRadius: '4px' }} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="cp-table-card">
        {/* Table Top Badges/Legend Skeleton (for Project/Gantt) */}
        <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {viewMode === 'project' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <Skeleton height={26} width={120} style={{ borderRadius: '14px' }} />
              <Skeleton height={26} width={120} style={{ borderRadius: '14px' }} />
              <Skeleton height={26} width={120} style={{ borderRadius: '14px' }} />
            </div>
          )}
          <div className="cp-legend-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { color: '#5ebcf6', width: 60 }, // Inception
              { color: '#3b5ee6', width: 55 }, // Planning
              { color: '#f5b027', width: 55 }, // Building
              { color: '#9d5ce5', width: 50 }, // Testing
              { color: '#32968a', width: 90 }, // Release Process
              { color: '#44c256', width: 55 }, // Deployed
              { color: '#27743d', width: 60 }  // Completed
            ].map((stage, i) => (
              <div
                key={i}
                className="cp-legend-item"
                style={{ cursor: 'default', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span className="cp-legend-indicator" style={{ background: stage.color }} />
                <Skeleton height={12} width={stage.width} style={{ borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Table Structure Skeleton */}
        <div className="cp-table-wrapper" style={{ padding: '16px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '6px'
          }}>
            <Skeleton height={16} width="25%" style={{ borderRadius: '4px' }} />
            <Skeleton height={16} width="15%" style={{ borderRadius: '4px' }} />
            <Skeleton height={16} width="15%" style={{ borderRadius: '4px' }} />
            <Skeleton height={16} width="20%" style={{ borderRadius: '4px' }} />
            <Skeleton height={16} width="20%" style={{ borderRadius: '4px' }} />
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '16px',
                padding: '16px',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                alignItems: 'center'
              }}>
                <div style={{ width: '25%', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {viewMode === 'summary' && <Skeleton height={32} width={32} style={{ borderRadius: '50%' }} />}
                  <Skeleton height={18} width={i % 2 === 0 ? '80%' : '60%'} style={{ borderRadius: '4px' }} />
                </div>
                <div style={{ width: '15%' }}>
                  <Skeleton height={22} width="70%" style={{ borderRadius: '12px' }} />
                </div>
                <div style={{ width: '15%' }}>
                  <Skeleton height={16} width="80%" style={{ borderRadius: '4px' }} />
                </div>
                <div style={{ width: '20%' }}>
                  <Skeleton height={16} width="90%" style={{ borderRadius: '4px' }} />
                </div>
                <div style={{ width: '20%', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Skeleton height={24} width={40} style={{ borderRadius: '12px' }} />
                  <Skeleton height={24} width={60} style={{ borderRadius: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="capacity-planning">
      <div className="capacity-planning-tabs">
        <button
          onClick={() => setViewMode('summary')}
          className="capacity-planning-tab"
          data-active={viewMode === 'summary'}
        >
          <FileText className="capacity-planning-tab-icon" />
          <span className="capacity-planning-tab-label">Summary View</span>
        </button>
        <button
          onClick={() => setViewMode('team')}
          className="capacity-planning-tab"
          data-active={viewMode === 'team'}
        >
          <Users className="capacity-planning-tab-icon" />
          <span className="capacity-planning-tab-label">Team View</span>
        </button>
        <button
          onClick={() => setViewMode('project')}
          className="capacity-planning-tab"
          data-active={viewMode === 'project'}
        >
          <FolderKanban className="capacity-planning-tab-icon" />
          <span className="capacity-planning-tab-label">Project View</span>
        </button>
        <button
          onClick={() => setViewMode('gantt')}
          className="capacity-planning-tab"
          data-active={viewMode === 'gantt'}
        >
          <GanttChart className="capacity-planning-tab-icon" />
          <span className="capacity-planning-tab-label">Gantt View</span>
        </button>
      </div>

      <div className="capacity-planning-content">


        {/* Filter Options */}
        <div className="cp-filter-panel">
          <div className="filter-row">
            {viewMode === 'summary' ? (
              <>
                <SearchInput
                  value={summarySearchQuery}
                  onChange={setSummarySearchQuery}
                  placeholder="Search consultants..."
                  classNames={{
                    wrapper: 'cp-search-wrapper',
                    icon: 'cp-search-icon',
                    input: 'cp-search-input'
                  }}
                />
                <Select
                  value={selectedTeamFilter}
                  onChange={setSelectedTeamFilter}
                  options={teamOptions}
                  width="team"
                />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  {canExport && (
                    <ExportButton
                      excel
                      pdf
                      onExcelExport={handleExportExcel}
                      onPdfExport={handleExportPDF}
                    />
                  )}
                </div>
              </>
            ) : viewMode === 'team' ? (
              <>
                <SearchInput
                  value={teamSearchQuery}
                  onChange={setTeamSearchQuery}
                  placeholder="Search consultants..."
                  classNames={{
                    wrapper: 'cp-search-wrapper',
                    icon: 'cp-search-icon',
                    input: 'cp-search-input'
                  }}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                  {canExport && (
                    <ExportButton
                      excel
                      pdf
                      onExcelExport={handleExportExcel}
                      onPdfExport={handleExportPDF}
                    />
                  )}
                </div>
              </>
            ) : viewMode === 'project' ? (
              <>
                <SearchInput
                  value={projectSearchQuery}
                  onChange={setProjectSearchQuery}
                  placeholder="Search projects, summary, or developer..."
                  classNames={{
                    wrapper: 'cp-search-wrapper',
                    icon: 'cp-search-icon',
                    input: 'cp-search-input'
                  }}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="team-view-switcher">
                    {[7, 30, 90].map(days => (
                      <button
                        key={days}
                        type="button"
                        className={`switcher-btn ${projectViewTimeframe === days ? 'active' : ''}`}
                        onClick={() => setProjectViewTimeframe(days)}
                      >
                        Next {days} Days
                      </button>
                    ))}
                  </div>
                  <div className="team-view-switcher">
                    <button
                      type="button"
                      className={`switcher-btn ${projectViewLifecycleMode === 'business' ? 'active' : ''}`}
                      onClick={() => { setProjectViewLifecycleMode('business'); setProjectStageFilter(null); }}
                    >
                      SDLC View (7 Stages)
                    </button>
                    <button
                      type="button"
                      className={`switcher-btn ${projectViewLifecycleMode === 'development' ? 'active' : ''}`}
                      onClick={() => { setProjectViewLifecycleMode('development'); setProjectStageFilter(null); }}
                    >
                      Tech View (17 Stages)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <SearchInput
                  value={ganttSearchQuery}
                  onChange={setGanttSearchQuery}
                  placeholder="Search projects, summary, or developer..."
                  classNames={{
                    wrapper: 'cp-search-wrapper',
                    icon: 'cp-search-icon',
                    input: 'cp-search-input'
                  }}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="team-view-switcher">
                    <button
                      type="button"
                      className={`switcher-btn ${ganttLifecycleMode === 'business' ? 'active' : ''}`}
                      onClick={() => { setGanttLifecycleMode('business'); setGanttStageFilter(null); }}
                    >
                      SDLC View (7 Stages)
                    </button>
                    <button
                      type="button"
                      className={`switcher-btn ${ganttLifecycleMode === 'development' ? 'active' : ''}`}
                      onClick={() => { setGanttLifecycleMode('development'); setGanttStageFilter(null); }}
                    >
                      Tech View (17 Stages)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── VIEW 1: Summary View Grouped Table ── */}
        {viewMode === 'summary' && (isLoading ? (
          <CapacityPlanningSkeleton />
        ) : (
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
        ))}

        {/* ── VIEW 2: Team View Tabs & KPI Cards ── */}
        {viewMode === 'team' && (isLoading ? (
          <CapacityPlanningSkeleton />
        ) : (
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
                    <div key={c.id} className="consultant-card list-card">
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
        ))}

        {/* ── VIEW 3: Project View — Primary/Additional developers per project ── */}
        {viewMode === 'project' && (isLoading ? (
          <CapacityPlanningSkeleton />
        ) : (
          <div className="cp-table-card">
            <div style={{ display: 'flex', gap: '10px', padding: '14px 16px 0' }}>
              <span className="team-size-badge cp-window-badge">Next 7 Days: {projectCountsByWindow.next7.projects} project{projectCountsByWindow.next7.projects === 1 ? '' : 's'} / {projectCountsByWindow.next7.crs} CR{projectCountsByWindow.next7.crs === 1 ? '' : 's'}</span>
              <span className="team-size-badge cp-window-badge">Next 30 Days: {projectCountsByWindow.next30.projects} project{projectCountsByWindow.next30.projects === 1 ? '' : 's'} / {projectCountsByWindow.next30.crs} CR{projectCountsByWindow.next30.crs === 1 ? '' : 's'}</span>
              <span className="team-size-badge cp-window-badge">Next 90 Days: {projectCountsByWindow.next90.projects} project{projectCountsByWindow.next90.projects === 1 ? '' : 's'} / {projectCountsByWindow.next90.crs} CR{projectCountsByWindow.next90.crs === 1 ? '' : 's'}</span>
              <button
                type="button"
                className="cp-expand-all-btn"
                onClick={toggleAllProjects}
                disabled={projectGroups.length === 0}
              >
                {allProjectsExpanded ? <ChevronsDownUp size={14} aria-hidden="true" /> : <ChevronsUpDown size={14} aria-hidden="true" />}
                {allProjectsExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            <div className="cp-legend-container" style={{ paddingTop: '10px' }}>
              {(projectViewLifecycleMode === 'development' ? PMStatus : PMStatusGroups).map(stage => (
                <button
                  key={stage.id}
                  type="button"
                  className={`cp-legend-item cp-legend-filter ${projectStageFilter === stage.id ? 'active' : ''}`}
                  onClick={() => setProjectStageFilter(prev => prev === stage.id ? null : stage.id)}
                >
                  <span className="cp-legend-indicator" style={{ background: stage.color }} />
                  {stage.name}
                </button>
              ))}
              {projectStageFilter && (
                <button type="button" className="cp-legend-clear" onClick={() => setProjectStageFilter(null)}>
                  Show All
                </button>
              )}
            </div>
            <div className="cp-table-wrapper">
              <table className="cp-data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th className="cp-project-th-stats">{`Next ${projectViewTimeframe} Days (Total)`}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectGroups.flatMap(group => {
                    const isCollapsed = collapsedProjects.has(group.key);
                    const rows = [
                      <tr
                        key={`project-${group.key}`}
                        className="cp-team-subheader-row cp-project-row"
                        onClick={() => toggleProjectCollapse(group.key)}
                      >
                        <td className="cp-team-subheader-cell cp-project-cell">
                          <div className="cp-project-main">
                            <span className="cp-project-chevron" aria-hidden="true">
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </span>
                            <span className="cp-project-name">
                              <ProjectText projectStr={group.project} />
                            </span>
                          </div>
                        </td>
                        <td className="cp-team-subheader-cell cp-project-cell">
                          <div className="cp-project-stats">
                            <span className="cp-project-stat">
                              <strong>{group.crs.length}</strong> CR{group.crs.length === 1 ? '' : 's'}
                            </span>
                            <span
                              className="cp-project-stat"
                              role="button"
                              tabIndex={0}
                              style={{ cursor: 'help' }}
                              onMouseEnter={(e) => setActiveTooltip({
                                title: `${group.developerCount} unique developer${group.developerCount === 1 ? '' : 's'}`,
                                description: group.developers.map(d => d.name || 'Unknown').join(', '),
                                state: 'none',
                                targetRect: e.currentTarget.getBoundingClientRect()
                              })}
                              onMouseLeave={() => setActiveTooltip(null)}
                              onFocus={(e) => setActiveTooltip({
                                title: `${group.developerCount} unique developer${group.developerCount === 1 ? '' : 's'}`,
                                description: group.developers.map(d => d.name || 'Unknown').join(', '),
                                state: 'none',
                                targetRect: e.currentTarget.getBoundingClientRect()
                              })}
                              onBlur={() => setActiveTooltip(null)}
                            >
                              <span className="cp-avatar-stack" aria-hidden="true">
                                {group.developers.slice(0, 4).map(d => (
                                  <DevAvatar key={d.empId} name={d.name} photo={getPhoto(d.empId) || d.photo} />
                                ))}
                                {group.developers.length > 4 && <span className="cp-avatar cp-avatar-more">+{group.developers.length - 4}</span>}
                              </span>
                              <strong>{group.developerCount}</strong> unique developer{group.developerCount === 1 ? '' : 's'}
                            </span>
                            <span className="cp-project-stat cp-project-stat--effort">
                              <strong>{group.totalProratedEffort.toFixed(1)}</strong> MDs
                            </span>
                          </div>
                        </td>
                      </tr>
                    ];

                    if (!isCollapsed) {
                      rows.push(
                        <tr key={`project-${group.key}-expanded`} className="cp-team-expanded-row">
                          <td colSpan={2} style={{ padding: 0 }}>
                            <div className="cp-cr-list">
                              {group.crs.map(cr => {
                                const crOpen = expandedCrs.has(cr.key);
                                const crLabel = cr.crId != null ? `CR ${cr.crId}` : 'CR (no ID)';
                                // Any zero-effort reason (no dates, ended, outside the window, ...) marks the CR as inactive for this window
                                const crZeroReason = getZeroEffortReason(cr.startDate, cr.endDate, cr.totalProratedEffort, referenceDate, projectViewTimeframe, cr.totalEffort);
                                const panelId = `cr-devs-${cr.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                                const crTip = (e) => setActiveTooltip({
                                  title: cr.crId != null ? `CR ID ${cr.crId}` : 'CR ID not available',
                                  description: cr.summary || 'No Summary',
                                  state: 'none',
                                  targetRect: e.currentTarget.getBoundingClientRect()
                                });
                                return (
                                  <section
                                    key={cr.key}
                                    className={`cp-cr-card${crOpen ? ' is-open' : ''}${crZeroReason ? ' is-inactive' : ''}`}
                                    aria-label={`${crLabel}: ${cr.summary || 'No Summary'}`}
                                  >
                                    <header className="cp-cr-head">
                                      <div className="cp-cr-title">
                                        <span
                                          className="cp-cr-id"
                                          role="button"
                                          tabIndex={0}
                                          onMouseEnter={crTip}
                                          onFocus={crTip}
                                          onBlur={() => setActiveTooltip(null)}
                                          onMouseLeave={() => setActiveTooltip(null)}
                                          onKeyDown={(e) => { if (e.key === 'Escape') setActiveTooltip(null); }}
                                        >
                                          {crLabel}
                                        </span>
                                        <h3 className="cp-cr-summary" title={cr.summary || ''}>
                                          {cr.summary || 'No Summary'}
                                        </h3>
                                        <span
                                          className="cp-cr-stage"
                                          style={{ background: cr.stageColor }}
                                          title={`Status: ${cr.status || 'N/A'}`}
                                        >
                                          {cr.stageName}
                                        </span>
                                      </div>

                                      <div className="cp-cr-facts">
                                        <div className="cp-cr-fact">
                                          <span className="cp-cr-fact-icon"><CalendarDays size={15} aria-hidden="true" /></span>
                                          <div>
                                            <div className="cp-cr-fact-label">Timeline</div>
                                            <div className="cp-cr-fact-value">
                                              {cr.startObj ? formatDateDMY(cr.startDate) : <em>Not scheduled</em>}
                                              <span className="cp-cr-arrow" aria-hidden="true">→</span>
                                              {cr.endObj ? formatDateDMY(cr.endDate) : <em>Not scheduled</em>}
                                              {cr.scheduleState === 'invalid' && (
                                                <span className="cp-flag" title="End date is before start date in the source data">Invalid range</span>
                                              )}
                                            </div>
                                            {cr.scheduleState === 'ok' && (
                                              <div className="cp-cr-fact-sub">({formatDuration(cr.startObj, cr.endObj)})</div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="cp-cr-fact">
                                          <span className="cp-cr-fact-icon"><Users size={15} aria-hidden="true" /></span>
                                          <div>
                                            <div className="cp-cr-fact-label">Developers</div>
                                            <div className="cp-cr-fact-value cp-cr-fact-strong">{cr.developers.length}</div>
                                          </div>
                                        </div>

                                        <div className="cp-cr-fact">
                                          <span className="cp-cr-fact-icon"><BarChart3 size={15} aria-hidden="true" /></span>
                                          <div>
                                            <div className="cp-cr-fact-label">Effort (Raw → Prorated)</div>
                                            <div className="cp-cr-fact-value cp-cr-fact-strong">
                                              {cr.totalEffort.toFixed(1)}<span className="cp-cr-arrow" aria-hidden="true">→</span>{cr.totalProratedEffort.toFixed(1)} MDs
                                              <ZeroEffortInfo
                                                reason={crZeroReason}
                                                proratedEffort={cr.totalProratedEffort}
                                                setActiveTooltip={setActiveTooltip}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {cr.totalEffort > 0 && (
                                          <div className="cp-cr-progress" title="Prorated effort as a share of raw effort for the selected window">
                                            <div className="cp-progress-track">
                                              <div className="cp-progress-fill" style={{ width: `${Math.min(100, (cr.totalProratedEffort / cr.totalEffort) * 100)}%` }} />
                                            </div>
                                            <span className="cp-cr-progress-text">
                                              {cr.totalProratedEffort.toFixed(1)} / {cr.totalEffort.toFixed(1)} MDs ({Math.round((cr.totalProratedEffort / cr.totalEffort) * 100)}%)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </header>

                                    <div className="cp-team-panel">
                                      <div
                                        className="cp-team-panel-head"
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={crOpen}
                                        aria-controls={panelId}
                                        onClick={() => toggleCrExpand(cr.key)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleCrExpand(cr.key);
                                          }
                                        }}
                                      >
                                        <div className="cp-team-panel-title">
                                          <Users size={14} aria-hidden="true" />
                                          <h4>Developers</h4>
                                          <span className="cp-team-count">{cr.developers.length} Developer{cr.developers.length === 1 ? '' : 's'}</span>
                                        </div>
                                        <span className="cp-cr-toggle">
                                          {crOpen ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                                          {crOpen ? 'Hide developers' : 'Show developers'}
                                          {crOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                                        </span>
                                      </div>

                                      {crOpen && (
                                        <div id={panelId}>
                                          {cr.developers.length === 0 ? (
                                            <div className="cp-cr-dev-empty">No developers assigned</div>
                                          ) : (
                                            <div className="cp-team-table-wrap">
                                              <table className="cp-cr-dev-table">
                                                <thead>
                                                  <tr>
                                                    <th style={{ width: '4%' }}>#</th>
                                                    <SortTh col="developer" label="Developer" sort={devSort[cr.key]} onSort={(col) => toggleDevSort(cr.key, col)} width="26%" />
                                                    <SortTh col="role" label="Role" sort={devSort[cr.key]} onSort={(col) => toggleDevSort(cr.key, col)} width="20%" />
                                                    <SortTh col="designation" label="Designation" sort={devSort[cr.key]} onSort={(col) => toggleDevSort(cr.key, col)} width="20%" />
                                                    <SortTh col="effort" label="Effort (Raw → Prorated)" sort={devSort[cr.key]} onSort={(col) => toggleDevSort(cr.key, col)} width="20%" />
                                                    <SortTh col="allocation" label="Allocation" sort={devSort[cr.key]} onSort={(col) => toggleDevSort(cr.key, col)} width="10%" />
                                                                                                      </tr>
                                                </thead>
                                                <tbody>
                                                  {sortDevelopers(cr.developers, devSort[cr.key], cr.totalEffort).map((d, idx) => {
                                                    const share = cr.totalEffort > 0 ? Math.round((d.effort / cr.totalEffort) * 100) : null;
                                                    return (
                                                      <tr key={`${cr.key}-dev-${d.empId}-${idx}`}>
                                                        <td className="cp-dev-index">{idx + 1}</td>
                                                        <td>
                                                          <div className="cp-dev-person">
                                                            <DevAvatar name={d.name} photo={getPhoto(d.empId) || d.photo} />
                                                            <span className="cp-cr-dev-name">{d.name || 'Unknown developer'}</span>
                                                            {d.isUnmatchedDeveloper && (
                                                              <span
                                                                className="cp-flag"
                                                                title="This developer's name could not be matched to a known employee record."
                                                              >
                                                                <AlertTriangle size={11} aria-hidden="true" /> Unmatched
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        <td>
                                                          <div className={`dev-badge ${d.isAssignedProgrammer ? 'dev-primary' : 'dev-additional'}`} style={{ display: 'inline-flex' }}>
                                                            {d.isAssignedProgrammer ? <Star size={13} aria-hidden="true" /> : <PlusCircle size={13} aria-hidden="true" />}
                                                            <span>{d.isAssignedProgrammer ? 'Primary Developer' : 'Additional Developer'}</span>
                                                          </div>
                                                        </td>
                                                        <td>
                                                          {d.teamName && d.teamName !== 'Unassigned Team'
                                                            ? d.teamName
                                                            : <span className="cp-muted">Unassigned</span>}
                                                        </td>
                                                        <td>
                                                          <span className="cp-cr-dev-effort">
                                                            <EffortPair raw={d.effort} prorated={d.proratedEffort} />
                                                            <ZeroEffortInfo
                                                              reason={getZeroEffortReason(cr.startDate, cr.endDate, d.proratedEffort, referenceDate, projectViewTimeframe, d.effort)}
                                                              proratedEffort={d.proratedEffort}
                                                              setActiveTooltip={setActiveTooltip}
                                                            />
                                                          </span>
                                                        </td>
                                                        <td title="Share of this CR's raw effort">{share !== null ? `${share}%` : '—'}</td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </section>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })}
                  {projectGroups.length === 0 && (
                    <tr>
                      <td colSpan={2} className="cp-empty-state">
                        No projects found matching the criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* ── VIEW 4: Gantt View — project timeline ── */}
        {viewMode === 'gantt' && (isLoading ? (
          <CapacityPlanningSkeleton />
        ) : (
          <div className="cp-table-card">
            <div className="cp-legend-container">
              {(ganttLifecycleMode === 'development' ? PMStatus : PMStatusGroups).map(stage => (
                <button
                  key={stage.id}
                  type="button"
                  className={`cp-legend-item cp-legend-filter ${ganttStageFilter === stage.id ? 'active' : ''}`}
                  onClick={() => setGanttStageFilter(prev => prev === stage.id ? null : stage.id)}
                >
                  <span className="cp-legend-indicator" style={{ background: stage.color }} />
                  {stage.name}
                </button>
              ))}
              {ganttStageFilter && (
                <button type="button" className="cp-legend-clear" onClick={() => setGanttStageFilter(null)}>
                  Clear filter ×
                </button>
              )}
              <button
                type="button"
                className="cp-expand-all-btn"
                onClick={toggleAllGanttProjects}
                disabled={ganttData.projects.length === 0}
              >
                {allGanttExpanded ? <ChevronsDownUp size={14} aria-hidden="true" /> : <ChevronsUpDown size={14} aria-hidden="true" />}
                {allGanttExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            {ganttData.projects.length === 0 ? (
              <div className="cp-empty-state">No projects found matching the criteria</div>
            ) : (
              <div className="cp-table-wrapper" style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                <div style={{ minWidth: '1200px', position: 'relative' }}>

                  {/* Global Trackbar overlay for Gantt View */}
                  {ganttData.todayPct !== null && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '380px',
                        right: 0,
                        pointerEvents: 'none',
                        zIndex: 11,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: `${ganttData.todayPct}%`,
                          top: 0,
                          bottom: 0,
                          width: '2px',
                          background: '#ef4444',
                        }}
                        title="Today"
                      />
                    </div>
                  )}

                  {/* Month axis header — sticky so it stays visible while scrolling a long list */}
                  <div className="cp-gantt-axis">
                    <div className="cp-gantt-axis-label">Project / CR</div>
                    <div className="cp-gantt-axis-months">
                      {ganttData.monthTicks.map((tick, idx) => (
                        <div key={idx} className="cp-gantt-axis-tick" style={{ left: `${tick.leftPct}%` }}>
                          {tick.label}
                        </div>
                      ))}
                      {ganttData.todayPct !== null && (
                        <span className="cp-gantt-today-pill" style={{ left: `${ganttData.todayPct}%` }}>Today</span>
                      )}
                    </div>
                  </div>

                  {/* Project group rows + one timeline row per CR */}
                  {ganttData.projects.flatMap(p => {
                    const collapsed = collapsedGanttProjects.has(p.key);
                    const devCount = new Set(p.crs.flatMap(cr => cr.developers.map(d => d.empId))).size;
                    const totalMDs = p.crs.reduce((s, cr) => s + cr.totalProratedEffort, 0);
                    // Alternating month bands + month lines behind the bars
                    const grid = ganttData.monthTicks.map((tick, idx) => {
                      const next = ganttData.monthTicks[idx + 1];
                      return (
                        <div
                          key={`grid-${idx}`}
                          className={`cp-gantt-month${idx % 2 ? ' is-alt' : ''}`}
                          style={{ left: `${tick.leftPct}%`, width: `${(next ? next.leftPct : 100) - tick.leftPct}%` }}
                        />
                      );
                    });
                    const barTip = (cr) => (e) => setActiveTooltip({
                      title: `${cr.crId != null ? `CR ${cr.crId}` : 'CR'}: ${cr.summary || 'No Summary'}`,
                      description: `Project: ${p.project || 'N/A'} | ${formatDateDMY(cr.startDate)} - ${formatDateDMY(cr.endDate)} | ${cr.status || 'N/A'} (${cr.stageName}) | ${cr.developers.length} developer${cr.developers.length === 1 ? '' : 's'}, ${cr.totalProratedEffort.toFixed(1)} MDs`,
                      state: 'none',
                      targetRect: e.currentTarget.getBoundingClientRect()
                    });
                    const out = [
                      <div
                        key={p.key}
                        className="cp-gantt-row cp-gantt-project-row"
                        role="button"
                        tabIndex={0}
                        aria-expanded={!collapsed}
                        onClick={() => toggleGanttProject(p.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleGanttProject(p.key);
                          }
                        }}
                      >
                        <div className="cp-gantt-label">
                          <div className="cp-gantt-project-title">
                            <span className="cp-project-chevron" aria-hidden="true">
                              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </span>
                            <span className="cp-gantt-project-name"><ProjectText projectStr={p.project} /></span>
                          </div>
                          <div className="cp-gantt-meta cp-gantt-meta--project">
                            {p.crs.length} CR{p.crs.length === 1 ? '' : 's'} · {devCount} developer{devCount === 1 ? '' : 's'} · {totalMDs.toFixed(1)} MDs
                          </div>
                        </div>
                        <div className="cp-gantt-track">
                          {grid}
                          {/* Collapsed: each CR's own faint bar in one row (no project-level dates) */}
                          {collapsed && p.crs.filter(cr => cr.bar).map(cr => (
                            <div
                              key={`mini-${cr.key}`}
                              className="cp-gantt-mini"
                              style={{ left: `${cr.bar.leftPct}%`, width: `${cr.bar.widthPct}%`, background: cr.stageColor }}
                              onMouseEnter={barTip(cr)}
                              onMouseLeave={() => setActiveTooltip(null)}
                            />
                          ))}
                        </div>
                      </div>
                    ];
                    if (!collapsed) {
                      p.crs.forEach(cr => {
                        const labelInside = cr.bar && cr.bar.widthPct >= 9;
                        out.push(
                          <div key={cr.key} className="cp-gantt-row cp-gantt-cr-row">
                            <div className="cp-gantt-label cp-gantt-label--cr">
                              <div className="cp-gantt-cr-title" title={cr.summary || ''}>
                                <strong>{cr.crId != null ? `CR ${cr.crId}` : 'CR —'}</strong>
                                <span>{cr.summary || 'No Summary'}</span>
                              </div>
                              <div className="cp-gantt-meta">
                                {cr.scheduleState === 'ok'
                                  ? `${formatDateDMY(cr.startDate)} → ${formatDateDMY(cr.endDate)}`
                                  : cr.scheduleState === 'invalid' ? 'Invalid date range in source data' : 'Not scheduled'}
                                {' · '}{cr.developers.length} developer{cr.developers.length === 1 ? '' : 's'} · {cr.totalProratedEffort.toFixed(1)} MDs
                              </div>
                            </div>
                            <div className="cp-gantt-track">
                              {grid}
                              {cr.bar ? (
                                <>
                                  <div
                                    className="cp-gantt-bar"
                                    role="img"
                                    aria-label={`${cr.crId != null ? `CR ${cr.crId}` : 'CR'}: ${cr.stageName}, ${formatDateDMY(cr.startDate)} to ${formatDateDMY(cr.endDate)}`}
                                    style={{ left: `${cr.bar.leftPct}%`, width: `${cr.bar.widthPct}%`, background: cr.stageColor }}
                                    onMouseEnter={barTip(cr)}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  >
                                    {labelInside && <span className="cp-gantt-bar-text">{cr.stageName}</span>}
                                  </div>
                                  {!labelInside && (
                                    <div
                                      className="cp-gantt-bar-outside"
                                      style={{ left: `calc(${cr.bar.leftPct + cr.bar.widthPct}% + 8px)` }}
                                      title={`${cr.status} → ${cr.stageName}`}
                                    >
                                      {cr.stageName}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="cp-gantt-unscheduled">
                                  {cr.scheduleState === 'invalid' ? 'Invalid date range' : 'Not scheduled'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    }
                    return out;
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
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
                                <div
                                  className={devRole.class}
                                  style={{ cursor: 'help' }}
                                  onMouseEnter={(e) => setActiveTooltip({
                                    title: devRole.tooltip,
                                    state: 'current',
                                    targetRect: e.currentTarget.getBoundingClientRect()
                                  })}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                >
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
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{Number(alloc.effort).toFixed(1)} MDs</span>
                                <span
                                  style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'default' }}
                                  onMouseEnter={(e) => setActiveTooltip({
                                    title: 'Prorated Calculation',
                                    description: `Only the portion of this assignment's ${Number(alloc.effort).toFixed(1)} MDs that falls within the next ${selectedDrillTimeframe} days counts toward the window total: ${Number(alloc.effort).toFixed(1)} x (${alloc.overlapBizDays}/${alloc.totalBizDays} business days) = ${alloc.proratedEffort.toFixed(1)}.`,
                                    targetRect: e.currentTarget.getBoundingClientRect()
                                  })}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                >
                                  → {alloc.proratedEffort.toFixed(1)} MDs in window ({alloc.overlapBizDays}/{alloc.totalBizDays} biz days)
                                </span>
                              </div>
                            </td>
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
                                    onMouseEnter={(e) => setActiveTooltip({
                                      title: 'Unmatched Developer',
                                      description: "This developer's name could not be matched to a known employee record, so these numbers may be unreliable.",
                                      state: 'current',
                                      targetRect: e.currentTarget.getBoundingClientRect()
                                    })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  >
                                    <AlertTriangle size={14} style={{ color: '#d97706' }} />
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
      <ProgressTooltip
        title={activeTooltip?.title}
        description={activeTooltip?.description}
        state={activeTooltip?.state}
        targetRect={activeTooltip?.targetRect}
        visible={!!activeTooltip}
        placement="bottom"
      />
    </div>
  );
}

// Duration label for a CR's timeline, e.g. "16 weeks" or "9 days".
function formatDuration(startObj, endObj) {
  const days = Math.round((endObj.getTime() - startObj.getTime()) / 86400000) + 1;
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  return `${Math.round(days / 7)} weeks`;
}

// Sorts a CR's developers by the clicked column; no sort keeps the model order
// (primary first, then by name).
function sortDevelopers(devs, sort, crTotalEffort) {
  if (!sort) return devs;
  const val = {
    developer: d => (d.name || '').toLowerCase(),
    role: d => (d.isAssignedProgrammer ? 0 : 1),
    designation: d => (d.teamName || '').toLowerCase(),
    effort: d => d.proratedEffort,
    allocation: d => (crTotalEffort > 0 ? d.effort / crTotalEffort : 0),
  }[sort.col];
  if (!val) return devs;
  const sign = sort.dir === 'desc' ? -1 : 1;
  return [...devs].sort((x, y) => {
    const a = val(x);
    const b = val(y);
    if (a < b) return -1 * sign;
    if (a > b) return 1 * sign;
    return 0;
  });
}

function SortTh({ col, label, sort, onSort, width }) {
  const active = sort && sort.col === col;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th style={{ width }} aria-sort={!active ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending'}>
      <button type="button" className={`cp-sort-btn${active ? ' is-active' : ''}`} onClick={() => onSort(col)}>
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

const AVATAR_COLORS = ['#16a34a', '#2563eb', '#9333ea', '#d97706', '#db2777', '#0891b2'];

function DevAvatar({ name, photo }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  if (photo && !broken) {
    return <img className="cp-avatar" src={photo} alt="" onError={() => setBroken(true)} />;
  }
  return (
    <span className="cp-avatar" style={{ background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }} aria-hidden="true">
      {initial}
    </span>
  );
}

function EffortPair({ raw, prorated }) {
  return (
    <span className="cp-effort" title="Raw effort → effort prorated to the selected window">
      <span className="cp-effort-raw">{raw.toFixed(1)}</span>
      <span className="cp-effort-arrow" aria-hidden="true">→</span>
      <strong className="cp-effort-pro">{prorated.toFixed(1)}</strong>
      <span className="cp-effort-unit">MDs</span>
    </span>
  );
}

function ZeroEffortInfo({ reason, proratedEffort, setActiveTooltip }) {
  if (!reason) return null;
  const show = (e) => setActiveTooltip({
    title: reason,
    description: proratedEffort > 0 ? `Exact prorated effort: ${Number(proratedEffort.toPrecision(3))} MDs` : undefined,
    state: 'none',
    targetRect: e.currentTarget.getBoundingClientRect()
  });
  return (
    <Info
      size={13}
      role="button"
      tabIndex={0}
      style={{ marginLeft: '6px', flexShrink: 0, cursor: 'help', color: 'var(--text-secondary)' }}
      onMouseEnter={show}
      onClick={show}
      onFocus={show}
      onBlur={() => setActiveTooltip(null)}
      onMouseLeave={() => setActiveTooltip(null)}
      onKeyDown={(e) => { if (e.key === 'Escape') setActiveTooltip(null); }}
    />
  );
}

function ProjectText({ projectStr, summary }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const timeoutRef = useRef(null);

  if (!projectStr) return <span>N/A</span>;

  const handleMouseEnter = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTargetRect(e.currentTarget.getBoundingClientRect());
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
    setShowTooltip(false);
  };

  const parts = projectStr.split(':');
  let ref = '';
  let title = projectStr;

  if (parts.length >= 2) {
    ref = parts[0].trim();
    title = parts.slice(1).join(':').trim();
  }

  const displayRef = ref ? (ref.startsWith('#') ? ref : `#${ref}`) : '';
  const fullText = summary ? `${title} — ${summary}` : title;

  if (fullText.length <= 40) {
    return (
      <span>
        {displayRef && <strong style={{ color: 'var(--text-secondary)' }}>{displayRef} · </strong>}
        {fullText}
      </span>
    );
  }

  return (
    <span
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayRef && <strong style={{ color: 'var(--text-secondary)' }}>{displayRef} · </strong>}
      {`${fullText.slice(0, 40)}...`}
      <ProgressTooltip
        title={displayRef ? `${displayRef} Details` : "Project Details"}
        description={fullText}
        targetRect={targetRect}
        visible={showTooltip}
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      />
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
