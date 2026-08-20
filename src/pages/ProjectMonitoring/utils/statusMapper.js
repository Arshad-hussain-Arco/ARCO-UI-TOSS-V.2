import { PMStatusGroups, PMStatus, ExceptionStatuses } from './staticData';
import { BUSINESS_PHASES, getBusinessStageInfo } from './businessLifecycleMap';
import { DEVELOPMENT_PHASES, getDevelopmentStageInfo } from './developmentLifecycleMap';

/**
 * Gets stage info depending on active mode ('business' vs 'development')
 * Business mode: 7 high-level status groups (1-7)
 * Development mode: 17 SDLC status stages (1-17)
 */
export function getStageInfo(statusStr, mode = 'business') {
  if (!statusStr) return { index: -1, phase: null };
  const lower = statusStr.trim().toLowerCase();

  if (lower.includes('blocked')) {
    return { index: -1, phase: { key: 'testing-blocked', label: ExceptionStatuses.testingBlocked.name, color: ExceptionStatuses.testingBlocked.color } };
  }
  if (lower.includes('deferred')) {
    return { index: -1, phase: { key: 'deferred', label: ExceptionStatuses.deferred.name, color: ExceptionStatuses.deferred.color } };
  }

  if (mode === 'development') {
    return getDevelopmentStageInfo(statusStr);
  }

  return getBusinessStageInfo(statusStr);
}

/**
 * Returns phase list array for given mode
 */
export function getPhasesList(mode = 'business') {
  return mode === 'development' ? DEVELOPMENT_PHASES : BUSINESS_PHASES;
}

/**
 * Calculates progress percentage (0 - 100%)
 */
export function calculateProgressPercentage(currentIdx, totalStages) {
  if (totalStages <= 1) return 100;
  return Math.min(100, Math.round(((currentIdx + 1) / totalStages) * 100));
}

/**
 * Gets state of a specific step index relative to active stage index
 * Returns: 'completed' | 'current' | 'future'
 */
export function getStepState(stepIdx, currentIdx, isFullyCompleted = false) {
  if (isFullyCompleted) return 'completed';
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'current';
  return 'future';
}

/**
 * Gets formatted list of unique status dropdown options
 */
export function getStatusFilterOptions(mode = 'business') {
  const phases = getPhasesList(mode);
  return phases.map((p) => ({
    value: p.label,
    label: p.label,
    key: p.key,
  }));
}

/**
 * Calculates number count for each status phase / stage based on active projects list
 */
export function calculateStatusCounts(projectsList = [], mode = 'business') {
  const counts = {};
  const validProjects = (projectsList || []).filter((p) => p.StatusId > 0);
  counts['__ALL__'] = validProjects.length;

  const phases = getPhasesList(mode);
  phases.forEach((phase) => {
    const pLabel = phase.label.toLowerCase().trim();
    counts[phase.label] = validProjects.filter((p) => {
      const statusStr = (p.Status || '').toLowerCase().trim();
      if (statusStr === pLabel) return true;

      const groupObj = PMStatusGroups.find((g) => g.id === p.StatusGroup);
      const groupName = groupObj ? groupObj.name.toLowerCase().trim() : '';
      const info = getStageInfo(p.Status, mode);
      const stageLabel = info?.phase?.label ? info.phase.label.toLowerCase().trim() : '';

      return groupName === pLabel || stageLabel === pLabel;
    }).length;
  });

  return counts;
}
