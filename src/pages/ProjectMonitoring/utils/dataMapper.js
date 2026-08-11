import { getBusinessStageInfo } from './businessLifecycleMap';

/**
 * Dynamic calculation and data mapping utilities for Project Monitoring
 */

const NOT_AVAILABLE_LABEL = 'Not Available';

/**
 * Returns the raw Depends_On value for a project.
 * If Depends_On is empty/null in the API, it is treated as 'Not Available'.
 * Every project is always included in Project Monitoring.
 */
export function getCategoryKey(p) {
  const dep = (p.dependsOn || '').trim();
  return dep || NOT_AVAILABLE_LABEL;
}

/**
 * Builds pill tab chips dynamically from projectsList.
 * Empty Depends_On → counted under 'Not Available'.
 * The 'All Projects' chip = total of all projects.
 * No hardcoded categories — fully driven by API data.
 *
 * Returns: Array<{ id: string, label: string, count: number }>
 */
export function calculateCategoryCounts(projectsList = []) {
  const countMap = new Map();

  projectsList.forEach((p) => {
    const key = getCategoryKey(p);
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  // Sort chips: descending by count, then alphabetically
  const sorted = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ id, label: id, count }));

  return [
    { id: 'all', label: 'All Projects', count: projectsList.length },
    ...sorted,
  ];
}

/**
 * Filter projects by selected category chip.
 * All projects are shown — empty Depends_On maps to 'Not Available'.
 */
export function filterByCategory(project, categoryId) {
  if (!categoryId || categoryId === 'all') return true;
  return getCategoryKey(project) === categoryId;
}

/**
 * SINGLE AUTHORITATIVE Count By Calculation Engine
 * Strictly follows team_breakdown_cards_reverse_engineering.md:
 * - Cards 1-5 (itdl, po, backupItdl, sitLead, uatLead): Evaluate Work Orders payload (result1)
 * - Cards 6-7 (developer, additionalDev): Evaluate Change Requests payload (result2)
 * - Legacy Reduction Formula (myFunc):
 *   grouped[key] = grouped[key] || []
 *   grouped[key].push(item)
 *   count = grouped[key].length
 */
export function calculateTeamRoleCounts(projectsList = [], changeRequestsList = [], roleField = 'itdl') {
  // Support both 2-arg and 3-arg signatures
  let actualWO = projectsList;
  let actualCR = changeRequestsList;
  let targetField = roleField;

  if (typeof changeRequestsList === 'string') {
    targetField = changeRequestsList;
    actualCR = [];
  }

  const isCRCard = targetField === 'developer' || targetField === 'additionalDev';
  const targetCollection = isCRCard ? (Array.isArray(actualCR) ? actualCR : []) : (Array.isArray(actualWO) ? actualWO : []);

  const grouped = new Map(); // key: display name string, value: array of matching records

  targetCollection.forEach((item) => {
    let rawVal = null;
    if (targetField === 'itdl') rawVal = item.itdl || item.IT_Delivery_Lead;
    else if (targetField === 'po') rawVal = item.po || item.Product_Owner;
    else if (targetField === 'backupItdl') rawVal = item.backupItdl || item.Backup_IT_Delivery_Lead;
    else if (targetField === 'sitLead') rawVal = item.sitLead || item.SIT_Lead;
    else if (targetField === 'uatLead') rawVal = item.uatLead || item.UAT_Lead;
    else if (targetField === 'developer') rawVal = item.assignedDeveloper || item.developer || item.Assigned_Developer;
    else if (targetField === 'additionalDev') {
      rawVal =
        item.additionalDevelopers ||
        item.additionalDev ||
        item.Additional_Developers ||
        item.Additional_Developer ||
        item.Additional_Dev ||
        item.Additional_Devs ||
        item.AdditionalDevelopers ||
        item.additional_developers ||
        item.additional_developer;
    }

    let namesToGroup = [];
    if (targetField === 'additionalDev') {
      if (rawVal && typeof rawVal === 'string') {
        const parts = rawVal
          .split(/[,/]/)
          .map((s) => s.trim())
          .filter((s) => s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined' && s !== '—' && s.toLowerCase() !== 'none' && s.toLowerCase() !== 'n/a');
        if (parts.length > 0) {
          namesToGroup = parts;
        }
      }
      if (namesToGroup.length === 0) {
        namesToGroup = ['unassigned'];
      }
    } else {
      let keyName = 'unassigned';
      if (rawVal && typeof rawVal === 'string') {
        const trimmed = rawVal.trim();
        if (trimmed && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'undefined' && trimmed !== '—') {
          keyName = trimmed;
        }
      }
      namesToGroup = [keyName];
    }

    namesToGroup.forEach((keyName) => {
      if (!grouped.has(keyName)) {
        grouped.set(keyName, []);
      }
      grouped.get(keyName).push(item);
    });
  });

  const result = [];
  grouped.forEach((records, name) => {
    result.push({
      name,
      count: records.length,
      records,
    });
  });

  // Sort descending by count, then alphabetically by name
  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Helper: Extract latest comment date from Last_Comment string log
 */
export function extractLatestCommentDate(commentStr) {
  if (!commentStr || typeof commentStr !== 'string') return null;
  const datePatterns = [
    /([A-Z][a-z]{2} \d{1,2}, \d{4})/g,
    /(\d{1,2}-[A-Z][a-z]{2}-\d{4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
    /([A-Z][a-z]{2} \d{1,2} \d{4})/g,
  ];
  const dates = [];
  for (const pattern of datePatterns) {
    const matches = commentStr.match(pattern);
    if (matches) {
      matches.forEach((m) => {
        const d = new Date(m);
        if (!isNaN(d.getTime())) dates.push(d);
      });
    }
  }
  if (dates.length === 0) return null;
  dates.sort((a, b) => b.getTime() - a.getTime());
  return dates[0];
}

/**
 * Calculates dynamic breach metrics for governance cards based on legacy specification (project_breaches_engineering.md)
 */
export function calculateBreachMetrics(projectsList = [], changeRequestsList = []) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // SLA & Phase Breaches
  const sla1Records = [];
  const sla2Records = [];
  const sla3Records = []; // Legacy bug BR-003: Always empty (0)
  const sla4Records = []; // Legacy bug BR-004: Always empty (0)
  const sla5Records = []; // Legacy bug BR-005: Always empty (0)
  const sla6Records = []; // Legacy bug BR-006: Always empty (0)
  const sla7Records = [];

  // Due Dates
  const dd1Records = [];
  const dd2Records = [];
  const dd3Records = []; // Legacy bug BR-010: Always empty (0)

  // CR Exceptions
  const cr1Records = []; // Legacy bug BR-010: Always empty (0)
  const cr2Records = [];
  const cr3Records = [];
  const cr4Records = [];

  // Evaluate Work Order / Project Breaches
  projectsList.forEach((p) => {
    const stageLower = (p.stage || '').toLowerCase();
    const isClosed = stageLower === 'completed' || stageLower === 'deployed' || stageLower === 'closed' || stageLower === 'deferred';

    // BR-001: Unclosed Projects Started Before 60 Days
    if (!isClosed && p.startDate) {
      const start = new Date(p.startDate);
      if (!isNaN(start.getTime())) {
        const diffDays = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 60) {
          sla1Records.push(p);
        }
      }
    }

    // BR-002: Project in Testing for More Than 15 Days
    const isTestingStage = stageLower.includes('testing') || stageLower.includes('sit') || stageLower.includes('uat') || stageLower.includes('fat');
    const sitDateRaw = p.sitReceivedDate || p.sitDate || (isTestingStage ? p.startDate : null);
    if (isTestingStage && sitDateRaw) {
      const sitDate = new Date(sitDateRaw);
      if (!isNaN(sitDate.getTime())) {
        const diffDays = Math.ceil(Math.abs(now.getTime() - sitDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 15) {
          sla2Records.push(p);
        }
      }
    }

    // BR-007: Projects with no comments for more than 5 days
    if (!isClosed && p.lastComment) {
      const commentDate = extractLatestCommentDate(p.lastComment);
      if (commentDate) {
        const diffDays = Math.ceil(Math.abs(now.getTime() - commentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 5) {
          sla7Records.push(p);
        }
      }
    }

    // BR-008: Empty Planned Dev Completion in Next 45 Days
    const plannedDev = (p.plannedDevDate || '').trim();
    const dueDateRaw = p.endDate || p.dueDate || p.clarityFinishDate;
    if ((!plannedDev || plannedDev.length <= 1) && dueDateRaw) {
      const due = new Date(dueDateRaw);
      if (!isNaN(due.getTime())) {
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 45) {
          dd1Records.push(p);
        }
      }
    }

    // BR-009: Due Date - Dev Completion < 2 Weeks (< 15 Days)
    if (plannedDev && plannedDev.length > 1 && dueDateRaw) {
      const due = new Date(dueDateRaw);
      const dev = new Date(plannedDev);
      if (!isNaN(due.getTime()) && !isNaN(dev.getTime())) {
        const diffDays = Math.ceil(Math.abs(due.getTime() - dev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 15) {
          dd2Records.push(p);
        }
      }
    }
  });

  // Evaluate Change Request Breaches
  changeRequestsList.forEach((cr) => {
    // BR-011: No Man Days in CR
    const effortStr = (cr.effortInMDs || cr.effort || '').toString().trim();
    if (!effortStr || effortStr === '0' || parseInt(effortStr, 10) === 0 || isNaN(parseInt(effortStr, 10))) {
      cr2Records.push(cr);
    }

    // BR-012: No Start Date in CR
    const startDate = (cr.startDate || '').trim();
    if (!startDate || startDate.length <= 1) {
      cr3Records.push(cr);
    }

    // BR-013: No Due Date in CR
    const endDate = (cr.endDate || cr.dueDate || '').trim();
    if (!endDate || endDate.length <= 1) {
      cr4Records.push(cr);
    }
  });

  const sla = [
    { id: 'sla1', label: 'Unclosed Projects started before 60 Days', count: sla1Records.length, records: sla1Records, isCR: false },
    { id: 'sla2', label: 'Project in testing for more than 15 Days', count: sla2Records.length, records: sla2Records, isCR: false },
    { id: 'sla3', label: 'Project in BRD / SSD stage for more than 14 Days', count: sla3Records.length, records: sla3Records, isCR: false },
    { id: 'sla4', label: 'Any CR whose due date passed', count: sla4Records.length, records: sla4Records, isCR: true },
    { id: 'sla5', label: 'CR in progress stage, but WO moved to Testing', count: sla5Records.length, records: sla5Records, isCR: true },
    { id: 'sla6', label: 'CR in Open stage, but WO moved to Development', count: sla6Records.length, records: sla6Records, isCR: true },
    { id: 'sla7', label: 'Projects with no comments for more than 5 days', count: sla7Records.length, records: sla7Records, isCR: false },
  ];

  const dueDate = [
    { id: 'dd1', label: 'Empty Planned Dev Completion in next 45 days', count: dd1Records.length, records: dd1Records, isCR: false },
    { id: 'dd2', label: 'Due Date - Dev Completion < 2 Weeks', count: dd2Records.length, records: dd2Records, isCR: false },
    { id: 'dd3', label: 'CR Due Date > WO Due Date', count: dd3Records.length, records: dd3Records, isCR: true },
  ];

  const cr = [
    { id: 'cr1', label: 'CR Due Date > WO Due Date', count: cr1Records.length, records: cr1Records, isCR: true },
    { id: 'cr2', label: 'No Man Days in CR', count: cr2Records.length, records: cr2Records, isCR: true },
    { id: 'cr3', label: 'No Start in CR', count: cr3Records.length, records: cr3Records, isCR: true },
    { id: 'cr4', label: 'No Due Date in CR', count: cr4Records.length, records: cr4Records, isCR: true },
  ];

  return { sla, dueDate, cr };
}

/**
 * Filter projects for drill-down modal overlay
 */
export function getDrilldownProjects(projectsList = [], changeRequestsList = [], stageInfo = null) {
  if (!stageInfo) return { records: [], isCR: false };

  const { key, label, type, records: prefilteredRecords, isCR } = stageInfo;

  // If prefiltered records exist on stageInfo object (from calculateBreachMetrics), return them directly
  if (prefilteredRecords && Array.isArray(prefilteredRecords)) {
    return { records: prefilteredRecords, isCR: Boolean(isCR) };
  }

  const q = (label || '').trim().toLowerCase();

  // If member drilldown is for Developer or Additional Developer, query Change Requests collection
  if (type === 'member' && (key === 'developer' || key === 'additionalDev')) {
    const matchingCRs = changeRequestsList.filter((cr) => {
      const raw = key === 'developer'
        ? (cr.assignedDeveloper || cr.developer || cr.Assigned_Developer || 'unassigned')
        : (cr.additionalDevelopers || cr.additionalDev || cr.Additional_Developers || 'unassigned');
      
      const cleaned = (raw || '').toString().toLowerCase();
      if (q === 'unassigned') {
        return !cleaned || cleaned === 'unassigned' || cleaned === 'null' || cleaned === 'undefined' || cleaned === '—';
      }
      return cleaned.includes(q);
    });

    return { records: matchingCRs, isCR: true };
  }

  const matchingProjects = projectsList.filter((p) => {
    if (type === 'member') {
      if (key === 'itdl') return (p.itdl || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'po') return (p.po || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'backupItdl') return (p.backupItdl || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'sitLead') return (p.sitLead || p.pmo || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'uatLead') return (p.uatLead || 'unassigned').trim().toLowerCase().includes(q);

      return (
        (p.itdl && p.itdl.toLowerCase().trim().includes(q)) ||
        (p.po && p.po.toLowerCase().trim().includes(q)) ||
        (p.backupItdl && p.backupItdl.toLowerCase().trim().includes(q)) ||
        (p.pmo && p.pmo.toLowerCase().trim().includes(q)) ||
        (p.ownedBy && p.ownedBy.toLowerCase().trim().includes(q))
      );
    }

    if (key === 'testing-blocked') return (p.stage || '').toLowerCase().includes('testing blocked') || (p.stage || '').toLowerCase().includes('blocked');
    if (key === 'deferred') return (p.stage || '').toLowerCase().includes('deferred');

    const bizInfo = getBusinessStageInfo(p.stage);
    if (!bizInfo || !bizInfo.phase) return false;
    return (
      bizInfo.phase.key === key ||
      bizInfo.phase.label.toLowerCase() === (label || '').toLowerCase()
    );
  });

  return { records: matchingProjects, isCR: false };
}

/**
 * Calculates Completed Projects Trends for Project Summary view (Monthly, Quarterly, HalfYearly, Annually)
 * based on completed_projects_trends_engineering.md
 */
export function calculateCompletedProjectsTrends(projectsList = [], timeframe = 'Monthly') {
  const currentYear = new Date().getFullYear();

  // Filter completed projects (Status === "completed")
  const completedProjects = projectsList.filter((p) => {
    const stage = (p.stage || p.status || '').toLowerCase();
    return stage === 'completed';
  });

  if (timeframe === 'Monthly') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Array(12).fill(0);

    completedProjects.forEach((p) => {
      const dateStr = p.endDate || p.dueDate || p.clarityFinishDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const m = d.getMonth();
          if (m >= 0 && m < 12) counts[m]++;
        }
      }
    });

    return {
      labels: months,
      data: counts,
      title: 'Monthly Completed Projects Trend',
    };
  }

  if (timeframe === 'Quarterly') {
    const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
    const counts = [0, 0, 0, 0];

    completedProjects.forEach((p) => {
      const dateStr = p.endDate || p.dueDate || p.clarityFinishDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const m = d.getMonth();
          if (m >= 0 && m <= 2) counts[0]++;
          else if (m >= 3 && m <= 5) counts[1]++;
          else if (m >= 6 && m <= 8) counts[2]++;
          else if (m >= 9 && m <= 11) counts[3]++;
        }
      }
    });

    return {
      labels: quarters,
      data: counts,
      title: 'Quarterly Completed Projects Trend',
    };
  }

  if (timeframe === 'HalfYearly') {
    const periods = ['Jan - Jun', 'Jul - Dec'];
    const counts = [0, 0];

    completedProjects.forEach((p) => {
      const dateStr = p.endDate || p.dueDate || p.clarityFinishDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const m = d.getMonth();
          if (m >= 0 && m <= 5) counts[0]++;
          else if (m >= 6 && m <= 11) counts[1]++;
        }
      }
    });

    return {
      labels: periods,
      data: counts,
      title: 'Half-Yearly Completed Projects Trend',
    };
  }

  if (timeframe === 'Annually') {
    const years = [currentYear - 2, currentYear - 1, currentYear];
    const counts = [0, 0, 0];

    completedProjects.forEach((p) => {
      const dateStr = p.endDate || p.dueDate || p.clarityFinishDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          if (y === currentYear - 2) counts[0]++;
          else if (y === currentYear - 1) counts[1]++;
          else if (y === currentYear) counts[2]++;
        }
      }
    });

    return {
      labels: years.map(String),
      data: counts,
      title: 'Annual Completed Projects Trend',
    };
  }

  return { labels: [], data: [], title: '' };
}
