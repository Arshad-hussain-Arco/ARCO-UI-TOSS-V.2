import { BUSINESS_PHASES, getBusinessStageInfo } from './businessLifecycleMap';
import { DEVELOPMENT_PHASES, getDevelopmentStageInfo } from './developmentLifecycleMap';

/**
 * Gets stage info depending on active mode ('business' vs 'development')
 */
export function getStageInfo(statusStr, mode = 'business') {
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
 * Gets formatted list of unique status dropdown options based on active mode
 */
export function getStatusFilterOptions(mode = 'business') {
  const phases = getPhasesList(mode);
  return phases.map((p) => ({
    value: p.label,
    label: p.label,
    key: p.key,
  }));
}
