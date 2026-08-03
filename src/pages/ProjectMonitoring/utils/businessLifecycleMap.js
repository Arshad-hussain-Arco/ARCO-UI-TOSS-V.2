/**
 * 7 Business Lifecycle Phases (Executive View)
 */

export const BUSINESS_PHASES = [
  {
    key: 'inception',
    label: 'Inception',
    description: 'Initial project setup, intake, requirements gathering & scope definition.',
    color: '#8b5cf6',
  },
  {
    key: 'planning',
    label: 'Planning',
    description: 'Architecture design, capacity planning, schedule alignment & estimation.',
    color: '#3b82f6',
  },
  {
    key: 'building',
    label: 'Building',
    description: 'Active development, code implementation & unit completion.',
    color: '#06b6d4',
  },
  {
    key: 'testing',
    label: 'Testing',
    description: 'Quality assurance, SIT, UAT validation & regression testing.',
    color: '#f59e0b',
  },
  {
    key: 'release',
    label: 'Release Process',
    description: 'Release sign-off, production deployment preparation & approval.',
    color: '#fb923c',
  },
  {
    key: 'deployed',
    label: 'Deployed',
    description: 'Code deployed to live production environment.',
    color: '#10b981',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Handover complete, operational sign-off & project closure.',
    color: '#059669',
  },
];

/**
 * Maps raw API status string to business stage index (0-6) and metadata
 */
export function getBusinessStageInfo(statusStr) {
  if (!statusStr) return { index: 0, phase: BUSINESS_PHASES[0] };
  const lower = statusStr.trim().toLowerCase();

  // Exact or keyword matching for 7 Business phases
  if (lower.includes('inception') || lower.includes('open') || lower.includes('brd') || lower.includes('ssd')) {
    return { index: 0, phase: BUSINESS_PHASES[0] };
  }
  if (lower.includes('plan') || lower.includes('design')) {
    return { index: 1, phase: BUSINESS_PHASES[1] };
  }
  if (lower.includes('build') || lower.includes('dev')) {
    return { index: 2, phase: BUSINESS_PHASES[2] };
  }
  if (lower.includes('test') || lower.includes('fat') || lower.includes('sit') || lower.includes('uat') || lower.includes('smoke')) {
    return { index: 3, phase: BUSINESS_PHASES[3] };
  }
  if (lower.includes('release') || lower.includes('ready for prod') || lower.includes('approval') || lower.includes('handover')) {
    return { index: 4, phase: BUSINESS_PHASES[4] };
  }
  if (lower.includes('deploy') || lower.includes('live')) {
    return { index: 5, phase: BUSINESS_PHASES[5] };
  }
  if (lower.includes('complete') || lower.includes('close') || lower.includes('done')) {
    return { index: 6, phase: BUSINESS_PHASES[6] };
  }

  // Default fallback
  return { index: 1, phase: BUSINESS_PHASES[1] };
}
