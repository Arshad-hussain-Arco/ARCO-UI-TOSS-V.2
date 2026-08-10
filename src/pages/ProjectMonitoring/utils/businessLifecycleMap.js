/**
 * 7 Business Lifecycle Phases (Executive SDLC View)
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
    color: 'var(--c-info)',
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
    color: 'var(--c-warning)',
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
    color: 'var(--c-success)',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Handover complete, operational sign-off & project closure.',
    color: 'var(--c-success)',
  },
];

/**
 * Central Mapping Layer: Maps granular API status values to the 7 SDLC View Stages
 *
 * Mapping Rules (STRICT):
 * - Inception       -> Open
 * - Planning        -> BRD Analysis, SSD Analysis, In Design
 * - Building        -> In Development, Development Completed
 * - Testing         -> FAT Testing, UAT Entry Checkpoint, UAT InProgress
 * - Release Process -> Ready For Production
 * - Deployed        -> Deployed
 * - Completed       -> Completed
 *
 * Special Statuses (NOT mapped to 7 main SDLC stages):
 * - Deferred        -> Deferred badge & modal
 * - Testing Blocked -> Testing Blocked badge & modal
 */
export function getBusinessStageInfo(statusStr) {
  if (!statusStr) return { index: -1, phase: null };
  const lower = statusStr.trim().toLowerCase();

  // Special Statuses — exclude from the 7 main SDLC stages
  if (lower.includes('deferred')) {
    return { index: -1, phase: { key: 'deferred', label: 'Deferred' } };
  }
  if (lower.includes('blocked')) {
    return { index: -1, phase: { key: 'testing-blocked', label: 'Testing Blocked' } };
  }

  // 1. Inception: Open
  if (lower === 'open' || lower === 'inception') {
    return { index: 0, phase: BUSINESS_PHASES[0] };
  }

  // 2. Planning: BRD Analysis, SSD Analysis, In Design
  if (
    lower.includes('brd') ||
    lower.includes('ssd') ||
    lower.includes('design') ||
    lower === 'planning' ||
    lower === 'plan'
  ) {
    return { index: 1, phase: BUSINESS_PHASES[1] };
  }

  // 3. Building: In Development, Development Completed
  if (
    lower.includes('development') ||
    lower.includes('dev') ||
    lower.includes('building') ||
    lower.includes('build')
  ) {
    return { index: 2, phase: BUSINESS_PHASES[2] };
  }

  // 4. Testing: FAT Testing, UAT Entry Checkpoint, UAT InProgress (EXCLUDING Testing Blocked)
  if (
    lower.includes('fat') ||
    lower.includes('uat entry') ||
    lower.includes('uat inprogress') ||
    lower.includes('uat in progress') ||
    lower === 'testing' ||
    lower.includes('sit')
  ) {
    return { index: 3, phase: BUSINESS_PHASES[3] };
  }

  // 5. Release Process: Ready For Production
  if (
    lower.includes('ready for production') ||
    lower.includes('ready for prod') ||
    lower === 'release process' ||
    lower === 'release'
  ) {
    return { index: 4, phase: BUSINESS_PHASES[4] };
  }

  // 6. Deployed: Deployed
  if (lower === 'deployed' || lower.includes('live')) {
    return { index: 5, phase: BUSINESS_PHASES[5] };
  }

  // 7. Completed: Completed (Exact 'completed', 'closed', or 'done')
  if (lower === 'completed' || lower === 'closed' || lower === 'done') {
    return { index: 6, phase: BUSINESS_PHASES[6] };
  }

  // Unrecognized / unmapped status
  return { index: -1, phase: null };
}
