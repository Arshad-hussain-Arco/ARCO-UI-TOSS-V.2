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
 * Calculates team member role counts dynamically for Team Overview cards
 */
export function calculateTeamRoleCounts(projectsList = [], roleField = 'itdl') {
  const map = new Map();

  projectsList.forEach((p) => {
    let personName = 'unassigned';
    if (roleField === 'itdl') personName = p.itdl || 'unassigned';
    else if (roleField === 'po') personName = p.po || 'unassigned';
    else if (roleField === 'backupItdl') personName = p.backupItdl || 'unassigned';
    else if (roleField === 'sitLead') personName = p.sitLead || p.pmo || 'unassigned';
    else if (roleField === 'uatLead') personName = p.uatLead || 'unassigned';
    else if (roleField === 'developer') personName = p.ownedBy || p.itdl || 'unassigned';
    else if (roleField === 'additionalDev') personName = p.backupItdl || 'unassigned';

    const cleanName = personName.trim() || 'unassigned';
    map.set(cleanName, (map.get(cleanName) || 0) + 1);
  });

  const result = [];
  map.forEach((count, name) => {
    result.push({ name, count });
  });

  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * Calculates dynamic breach metrics for governance cards
 */
export function calculateBreachMetrics(projectsList = []) {
  const sla = [
    { id: 'sla1', label: 'Unclosed Projects Started Before 60 Days', count: 0 },
    { id: 'sla2', label: 'Project in Testing for More Than 15 Days', count: 0 },
    { id: 'sla3', label: 'Project in BRD/SSD Stage for More Than 14 Days', count: 0 },
    { id: 'sla4', label: 'Any CR Whose Due Date Passed', count: 0 },
    { id: 'sla5', label: 'CR in Progress Stage, but WO Moved to Testing', count: 0 },
    { id: 'sla6', label: 'CR in Open Stage, but WO Moved', count: 0 },
  ];

  const dueDate = [
    { id: 'dd1', label: 'Empty Planned Development Completion (Next 45 Days)', count: 0 },
    { id: 'dd2', label: 'Due Date - Dev Completion < 2 Weeks', count: 0 },
  ];

  const cr = [
    { id: 'cr1', label: 'CR Due Date > WO Due Date', count: 0 },
    { id: 'cr2', label: 'No Man Days in CR', count: 0 },
    { id: 'cr3', label: 'No Start Date in CR', count: 0 },
    { id: 'cr4', label: 'No Due Date in CR', count: 0 },
  ];

  projectsList.forEach((p) => {
    const stage = (p.stage || '').toLowerCase();
    const type = (p.workOrderType || '').toLowerCase();

    if (stage !== 'completed' && stage !== 'deployed') {
      sla[0].count++;
    }
    if (stage.includes('testing') || stage.includes('sit') || stage.includes('uat')) {
      sla[1].count++;
    }
    if (stage.includes('brd') || stage.includes('ssd')) {
      sla[2].count++;
    }
    if (type === 'cr' && (stage.includes('testing') || stage.includes('sit') || stage.includes('uat'))) {
      sla[4].count++;
    }
    if (stage.includes('dev') || stage.includes('building')) {
      dueDate[1].count++;
    }
    if (type === 'cr') {
      cr[1].count++;
    }
    if (type === 'cr' && !p.startDate) {
      cr[2].count++;
    }
  });

  return { sla, dueDate, cr };
}

/**
 * Filter projects for drill-down modal overlay
 */
export function getDrilldownProjects(projectsList = [], stageInfo) {
  if (!stageInfo) return [];

  const { key, label, type } = stageInfo;
  const q = (label || '').trim().toLowerCase();

  return projectsList.filter((p) => {
    if (type === 'member') {
      if (key === 'itdl') {
        return (p.itdl || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'po') {
        return (p.po || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'backupItdl') {
        return (p.backupItdl || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'sitLead') {
        return (p.sitLead || p.pmo || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'uatLead') {
        return (p.uatLead || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'developer') {
        return (p.ownedBy || p.itdl || 'unassigned').trim().toLowerCase() === q;
      }
      if (key === 'additionalDev') {
        return (p.backupItdl || 'unassigned').trim().toLowerCase() === q;
      }

      return (
        (p.itdl && p.itdl.toLowerCase().trim() === q) ||
        (p.po && p.po.toLowerCase().trim() === q) ||
        (p.backupItdl && p.backupItdl.toLowerCase().trim() === q) ||
        (p.pmo && p.pmo.toLowerCase().trim() === q) ||
        (p.ownedBy && p.ownedBy.toLowerCase().trim() === q)
      );
    }

    if (key === 'sla1') return (p.stage || '').toLowerCase() !== 'completed';
    if (key === 'sla2') return (p.stage || '').toLowerCase().includes('testing');
    if (key === 'testing-blocked') return (p.stage || '').toLowerCase().includes('testing blocked') || (p.stage || '').toLowerCase().includes('blocked');
    if (key === 'deferred') return (p.stage || '').toLowerCase().includes('deferred');
    if (key === 'sla5') return p.workOrderType === 'CR';
    if (key === 'cr2') return p.workOrderType === 'CR';
    if (key === 'cr3') return p.workOrderType === 'CR' && !p.startDate;
    if (key === 'dd2') return (p.stage || '').toLowerCase().includes('building') || (p.stage || '').toLowerCase().includes('dev');

    const bizInfo = getBusinessStageInfo(p.stage);
    if (!bizInfo || !bizInfo.phase) return false;
    return (
      bizInfo.phase.key === key ||
      bizInfo.phase.label.toLowerCase() === (label || '').toLowerCase()
    );
  });
}
