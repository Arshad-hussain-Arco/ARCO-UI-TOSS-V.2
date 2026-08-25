import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
  AlertTriangle
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { ExportButton } from '@components/ui/ExportButton';
import { useAsync } from '@hooks/useAsync';
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
  const [projectViewTimeframe, setProjectViewTimeframe] = useState(30);
  // SDLC (7-stage) vs Tech (17-stage) lifecycle — same toggle concept as
  // Gantt View / Project Monitoring, kept independent so switching one
  // tab's mode doesn't affect the other.
  const [projectViewLifecycleMode, setProjectViewLifecycleMode] = useState('business');

  // Gantt View — SDLC (7-stage) vs Tech (17-stage) lifecycle, same toggle
  // concept as Project Monitoring, reusing its actual PMStatusGroups/PMStatus
  // stage definitions rather than a separate guessed color mapping.
  const [ganttLifecycleMode, setGanttLifecycleMode] = useState('business');



  // Drill-down Modal State
  const [selectedDrillConsultant, setSelectedDrillConsultant] = useState(null);
  const [selectedDrillTimeframe, setSelectedDrillTimeframe] = useState(null);

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

  // Group every developer's assignments by Project — shared base data for
  // both Project View and Gantt View, each of which applies its own
  // independent search filter on top (see projectGroups / ganttData below).
  // Shows who's Primary vs Additional on a given project and each person's
  // own prorated MDs share for the selected timeframe, reusing the same
  // per-assignment `effort` share (already split by team percentage) that
  // backs the Summary/Team views and the drill-down modal.
  const allProjectGroups = useMemo(() => {
    const groups = new Map();

    processedConsultants.forEach(c => {
      c.assignments.forEach(a => {
        const groupKey = a.project ? a.project.trim() : `${a.summary}_${a.startDate}_${a.endDate}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            key: groupKey,
            project: a.project || '',
            summary: a.summary,
            status: a.status,
            startDate: a.startDate,
            endDate: a.endDate,
            developers: [],
          });
        }

        const proratedEffort = calculateProratedEffort(
          a.startDate, a.endDate, Number(a.effort) || 0,
          projectViewTimeframe, referenceDate, weekendIndices, holidaySet
        );

        groups.get(groupKey).developers.push({
          empId: c.id,
          name: c.name,
          teamName: c.teamName,
          isAssignedProgrammer: a.isAssignedProgrammer,
          isUnmatchedDeveloper: a.isUnmatchedDeveloper,
          effort: Number(a.effort) || 0,
          proratedEffort,
        });
      });
    });

    // Whether this project's own span overlaps a given N-day window at all
    // (calendar-day overlap, same formula as the drill-down modal's filter —
    // not a business-day count, just "is this project active in this window").
    const overlapsWindow = (startDate, endDate, windowDays) => {
      const s = parseDate(startDate);
      const e = parseDate(endDate);
      const ref = parseDate(referenceDate);
      if (!s || !e || !ref) return false;
      const windowEnd = new Date(ref);
      windowEnd.setDate(windowEnd.getDate() + windowDays - 1);
      const overlapStart = new Date(Math.max(ref.getTime(), s.getTime()));
      const overlapEnd = new Date(Math.min(e.getTime(), windowEnd.getTime()));
      return overlapStart <= overlapEnd;
    };

    const result = Array.from(groups.values()).map(g => ({
      ...g,
      // Primary developer(s) first, then additional, each group sorted by name
      developers: g.developers.sort((a, b) => {
        if (a.isAssignedProgrammer !== b.isAssignedProgrammer) return a.isAssignedProgrammer ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
      totalProratedEffort: g.developers.reduce((sum, d) => sum + d.proratedEffort, 0),
      overlaps7: overlapsWindow(g.startDate, g.endDate, 7),
      overlaps30: overlapsWindow(g.startDate, g.endDate, 30),
      overlaps90: overlapsWindow(g.startDate, g.endDate, 90),
    }));

    return result;
  }, [processedConsultants, projectViewTimeframe, referenceDate, weekendIndices, holidaySet]);

  // Project View's own filtered (by its own search box) + sorted list.
  const projectGroups = useMemo(() => {
    const q = debouncedProjectSearchQuery.toLowerCase().trim();
    const filtered = q
      ? allProjectGroups.filter(g =>
          g.project.toLowerCase().includes(q) ||
          g.summary.toLowerCase().includes(q) ||
          g.developers.some(d => d.name.toLowerCase().includes(q))
        )
      : allProjectGroups;

    const withStage = filtered.map(g => {
      const { statusId, statusGroup } = mapStatusToIds(g.status);
      const stage = projectViewLifecycleMode === 'development'
        ? PMStatus.find(s => s.id === statusId)
        : PMStatusGroups.find(sg => sg.id === statusGroup);
      return {
        ...g,
        stageName: stage ? stage.name : 'Unmapped',
        stageColor: stage ? stage.color : '#9ca3af',
      };
    });

    return withStage.sort((a, b) => b.totalProratedEffort - a.totalProratedEffort);
  }, [allProjectGroups, debouncedProjectSearchQuery, projectViewLifecycleMode]);

  // Count of distinct projects (from the currently searched/filtered set)
  // whose own span overlaps each window — independent of the 7/30/90 toggle,
  // so all three counts are visible together in the Project View stats strip.
  const projectCountsByWindow = useMemo(() => ({
    next7: projectGroups.filter(g => g.overlaps7).length,
    next30: projectGroups.filter(g => g.overlaps30).length,
    next90: projectGroups.filter(g => g.overlaps90).length,
  }), [projectGroups]);

  const toggleProjectCollapse = (key) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Gantt View — reuses the same base project grouping as Project View
  // (allProjectGroups), filtered by its OWN independent search box, laid
  // out on a shared timeline so each project's bar position/width reflects
  // its actual Start/End Date relative to every other visible project.
  const ganttData = useMemo(() => {
    const q = debouncedGanttSearchQuery.toLowerCase().trim();
    const searched = q
      ? allProjectGroups.filter(g =>
          g.project.toLowerCase().includes(q) ||
          g.summary.toLowerCase().includes(q) ||
          g.developers.some(d => d.name.toLowerCase().includes(q))
        )
      : allProjectGroups;

    const projects = searched
      .map(g => ({ ...g, startObj: parseDate(g.startDate), endObj: parseDate(g.endDate) }))
      .filter(g => g.startObj && g.endObj && g.endObj >= g.startObj)
      .sort((a, b) => a.startObj - b.startObj);

    if (projects.length === 0) {
      return { projects: [], todayPct: null, monthTicks: [] };
    }

    const ref = parseDate(referenceDate);
    const minStart = new Date(Math.min(...projects.map(p => p.startObj.getTime()), ref.getTime()));
    const maxEnd = new Date(Math.max(...projects.map(p => p.endObj.getTime()), ref.getTime()));

    const rangeStart = new Date(minStart);
    rangeStart.setDate(rangeStart.getDate() - 3);
    const rangeEnd = new Date(maxEnd);
    rangeEnd.setDate(rangeEnd.getDate() + 3);
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const pct = (d) => totalMs > 0 ? ((d.getTime() - rangeStart.getTime()) / totalMs) * 100 : 0;

    const projectsWithBars = projects.map(p => {
      const left = pct(p.startObj);
      const right = pct(p.endObj);
      const { statusId, statusGroup } = mapStatusToIds(p.status);
      const stage = ganttLifecycleMode === 'development'
        ? PMStatus.find(s => s.id === statusId)
        : PMStatusGroups.find(g => g.id === statusGroup);
      return {
        ...p,
        leftPct: Math.max(0, left),
        widthPct: Math.max(0.6, right - left),
        stageName: stage ? stage.name : 'Unmapped',
        stageColor: stage ? stage.color : '#9ca3af',
      };
    });

    const monthTicks = [];
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      monthTicks.push({
        label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        leftPct: pct(cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { projects: projectsWithBars, todayPct: pct(ref), monthTicks };
  }, [allProjectGroups, debouncedGanttSearchQuery, referenceDate, ganttLifecycleMode]);

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
      // window AND Status to be "Open"/"FAT Testing", which silently hid
      // assignments that ran past the window or had any other status even
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
                      onClick={() => setProjectViewLifecycleMode('business')}
                    >
                      SDLC View (7 Stages)
                    </button>
                    <button
                      type="button"
                      className={`switcher-btn ${projectViewLifecycleMode === 'development' ? 'active' : ''}`}
                      onClick={() => setProjectViewLifecycleMode('development')}
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
                      onClick={() => setGanttLifecycleMode('business')}
                    >
                      SDLC View (7 Stages)
                    </button>
                    <button
                      type="button"
                      className={`switcher-btn ${ganttLifecycleMode === 'development' ? 'active' : ''}`}
                      onClick={() => setGanttLifecycleMode('development')}
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
        )}

        {/* ── VIEW 3: Project View — Primary/Additional developers per project ── */}
        {viewMode === 'project' && (
          <div className="cp-table-card">
            <div style={{ display: 'flex', gap: '10px', padding: '14px 16px 0' }}>
              <span className="team-size-badge">Next 7 Days: {projectCountsByWindow.next7} project{projectCountsByWindow.next7 === 1 ? '' : 's'}</span>
              <span className="team-size-badge">Next 30 Days: {projectCountsByWindow.next30} project{projectCountsByWindow.next30 === 1 ? '' : 's'}</span>
              <span className="team-size-badge">Next 90 Days: {projectCountsByWindow.next90} project{projectCountsByWindow.next90 === 1 ? '' : 's'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px 16px 0' }}>
              {(projectViewLifecycleMode === 'development' ? PMStatus : PMStatusGroups).map(stage => (
                <span key={stage.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: stage.color, display: 'inline-block' }} />
                  {stage.name}
                </span>
              ))}
            </div>
            <div className="cp-table-wrapper">
              <table className="cp-data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Stage</th>
                    <th>Start / End Date</th>
                    <th className="text-center">{`Next ${projectViewTimeframe} Days (Total)`}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectGroups.flatMap(group => {
                    const isCollapsed = collapsedProjects.has(group.key);
                    const rows = [
                      <tr
                        key={`project-${group.key}`}
                        className="cp-team-subheader-row"
                        onClick={() => toggleProjectCollapse(group.key)}
                      >
                        <td className="cp-team-subheader-cell">
                          <div className="cp-team-subheader-content">
                            <div className="cp-team-subheader-left">
                              {isCollapsed ? <ChevronRight size={14} className="cp-team-chevron" /> : <ChevronDown size={14} className="cp-team-chevron" />}
                              <span className="team-name-label">
                                <ProjectText projectStr={group.project} /> — {group.summary}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                              fontSize: '11px', fontWeight: 600, color: '#fff', background: group.stageColor,
                            }}
                            title={`Status: ${group.status || 'N/A'}`}
                          >
                            {group.stageName}
                          </span>
                        </td>
                        <td>{formatDateDMY(group.startDate)} - {formatDateDMY(group.endDate)}</td>
                        <td className="text-center">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span className="team-size-badge">{group.developers.length} developer{group.developers.length === 1 ? '' : 's'}</span>
                            <span className="team-size-badge">{group.totalProratedEffort.toFixed(1)} MDs</span>
                          </div>
                        </td>
                      </tr>
                    ];

                    if (!isCollapsed) {
                      rows.push(
                        <tr key={`project-${group.key}-header`} className="cp-member-row" style={{ background: 'var(--surface-secondary)' }}>
                          <td style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>Developer</td>
                          <td style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>Role</td>
                          <td style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>Team</td>
                          <td className="text-center" style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>Effort (Raw → Prorated)</td>
                        </tr>
                      );
                      group.developers.forEach((d, idx) => (
                        rows.push(
                          <tr key={`${group.key}-dev-${d.empId}-${idx}`} className="cp-member-row">
                            <td className="member-name-cell">
                              {d.name}
                              {d.isUnmatchedDeveloper && (
                                <AlertTriangle
                                  size={12}
                                  style={{ color: '#d97706', marginLeft: '6px', cursor: 'help', verticalAlign: 'middle' }}
                                  title="This developer's name could not be matched to a known employee record."
                                />
                              )}
                            </td>
                            <td>
                              <div className={`dev-badge ${d.isAssignedProgrammer ? 'dev-primary' : 'dev-additional'}`} style={{ display: 'inline-flex' }}>
                                {d.isAssignedProgrammer ? <Star size={13} /> : <PlusCircle size={13} />}
                                <span>{d.isAssignedProgrammer ? 'Primary Developer' : 'Additional Developer'}</span>
                              </div>
                            </td>
                            <td>{d.teamName || 'Unassigned Team'}</td>
                            <td className="text-center">
                              {d.effort.toFixed(1)} → {d.proratedEffort.toFixed(1)} MDs
                            </td>
                          </tr>
                        )
                      ));
                    }
                    return rows;
                  })}
                  {projectGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="cp-empty-state">
                        No projects found matching the criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VIEW 4: Gantt View — project timeline ── */}
        {viewMode === 'gantt' && (
          <div className="cp-table-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '14px 16px 0' }}>
              {(ganttLifecycleMode === 'development' ? PMStatus : PMStatusGroups).map(stage => (
                <span key={stage.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: stage.color, display: 'inline-block' }} />
                  {stage.name}
                </span>
              ))}
            </div>
            {ganttData.projects.length === 0 ? (
              <div className="cp-empty-state">No projects found matching the criteria</div>
            ) : (
              <div className="cp-table-wrapper">
                <div style={{ minWidth: '900px' }}>
                  {/* Month axis header — sticky within cp-table-wrapper's own
                      scroll so it stays visible while scrolling through a
                      long project list, same as the other views' tables. */}
                  <div
                    style={{
                      display: 'flex', borderBottom: '2px solid var(--border-primary)',
                      position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)',
                    }}
                  >
                    <div style={{ width: '280px', flexShrink: 0, padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Project
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '34px' }}>
                      {ganttData.monthTicks.map((tick, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'absolute', left: `${tick.leftPct}%`, top: 0, bottom: 0,
                            borderLeft: '1px solid var(--border-primary)', paddingLeft: '4px',
                            fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)',
                            textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                          }}
                        >
                          {tick.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project rows */}
                  {ganttData.projects.map(p => (
                    <div key={p.key} className="cp-member-row" style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '280px', flexShrink: 0, padding: '10px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.summary}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {p.developers.length} developer{p.developers.length === 1 ? '' : 's'} · {p.totalProratedEffort.toFixed(1)} MDs
                        </div>
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: '32px' }}>
                        {ganttData.todayPct !== null && (
                          <div
                            style={{
                              position: 'absolute', left: `${ganttData.todayPct}%`, top: 0, bottom: 0,
                              width: '2px', background: '#ef4444', zIndex: 2,
                            }}
                            title="Today"
                          />
                        )}
                        <div
                          style={{
                            position: 'absolute', left: `${p.leftPct}%`, width: `${p.widthPct}%`, top: '8px', height: '16px',
                            borderRadius: '4px', background: p.stageColor, minWidth: '4px', zIndex: 1,
                          }}
                          title={`${p.summary} — ${p.status} (${p.stageName}) (${formatDateDMY(p.startDate)} - ${formatDateDMY(p.endDate)})`}
                        />
                        <div
                          style={{
                            position: 'absolute', left: `calc(${p.leftPct + p.widthPct}% + 8px)`, top: 0, bottom: 0,
                            display: 'flex', alignItems: 'center',
                            fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                          }}
                          title={`${p.status} → ${p.stageName}`}
                        >
                          {p.stageName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{Number(alloc.effort).toFixed(1)} MDs</span>
                                <span
                                  style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                                  title={`Only the portion of this assignment's ${Number(alloc.effort).toFixed(1)} MDs that falls within the next ${selectedDrillTimeframe} days counts toward the window total: ${Number(alloc.effort).toFixed(1)} x (${alloc.overlapBizDays}/${alloc.totalBizDays} business days) = ${alloc.proratedEffort.toFixed(1)}.`}
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
