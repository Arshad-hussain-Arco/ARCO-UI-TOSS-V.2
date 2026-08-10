/**
 * 17 Development Lifecycle Phases (Technical View with Full Stage Names)
 */

export const DEVELOPMENT_PHASES = [
  { key: 'open', label: 'Open', description: 'Ticket created and queued for business analysis.', color: 'var(--text-secondary)' },
  { key: 'brd_analysis', label: 'BRD Analysis', description: 'Business Requirement Document review and scoping.', color: '#8b5cf6' },
  { key: 'ssd_analysis', label: 'SSD Analysis', description: 'Software Specification Document technical assessment.', color: '#7c3aed' },
  { key: 'in_design', label: 'In Design', description: 'Technical architecture, API specification & UI mockups.', color: '#6366f1' },
  { key: 'in_development', label: 'In Development', description: 'Active code implementation across frontend and backend services.', color: 'var(--c-info)' },
  { key: 'dev_completed', label: 'Development Completed', description: 'Development work complete and unit test suite verified.', color: '#0284c7' },
  { key: 'fat_testing', label: 'FAT Testing', description: 'Factory Acceptance Testing by core engineering team.', color: '#06b6d4' },
  { key: 'sit_entry_checkpoint', label: 'SIT Entry Checkpoint', description: 'Gate review verifying environment & code baseline for SIT.', color: '#0d9488' },
  { key: 'smoke_testing', label: 'Smoke Testing', description: 'Initial sanity testing of deployed build prior to full SIT.', color: '#14b8a6' },
  { key: 'sit_in_progress', label: 'SIT In Progress', description: 'System Integration Testing across interconnected systems.', color: 'var(--c-warning)' },
  { key: 'uat_entry_checkpoint', label: 'UAT Entry Checkpoint', description: 'Quality gate review before user acceptance testing.', color: '#d97706' },
  { key: 'uat_in_progress', label: 'UAT In Progress', description: 'Business User Acceptance Testing & scenario execution.', color: '#ea580c' },
  { key: 'uat_sign_off', label: 'UAT Sign Off', description: 'Formal business stakeholder UAT approval received.', color: 'var(--c-warning)' },
  { key: 'release_approval', label: 'Release Approval', description: 'CAB and management change request release approval.', color: '#ec4899' },
  { key: 'ready_for_production', label: 'Ready For Production', description: 'Build packaged, tagged, and staged for production release.', color: 'var(--c-success)' },
  { key: 'deployed', label: 'Deployed', description: 'Successfully released to live production environment.', color: 'var(--c-success)' },
  { key: 'completed', label: 'Completed', description: 'Post-production monitoring complete and project closed.', color: '#047857' },
];

/**
 * Maps raw API status string to 17-phase development stage index (0-16) and metadata
 */
export function getDevelopmentStageInfo(statusStr) {
  if (!statusStr) return { index: 0, phase: DEVELOPMENT_PHASES[0] };
  const lower = statusStr.trim().toLowerCase();

  const exactIdx = DEVELOPMENT_PHASES.findIndex(
    (p) => p.label.toLowerCase() === lower || p.key.toLowerCase() === lower
  );
  if (exactIdx !== -1) {
    return { index: exactIdx, phase: DEVELOPMENT_PHASES[exactIdx] };
  }

  if (lower === 'open') return { index: 0, phase: DEVELOPMENT_PHASES[0] };
  if (lower.includes('brd')) return { index: 1, phase: DEVELOPMENT_PHASES[1] };
  if (lower.includes('ssd')) return { index: 2, phase: DEVELOPMENT_PHASES[2] };
  if (lower.includes('design') || lower.includes('inception')) return { index: 3, phase: DEVELOPMENT_PHASES[3] };
  if (lower.includes('in dev') || lower.includes('building') || lower.includes('in progress')) return { index: 4, phase: DEVELOPMENT_PHASES[4] };
  if (lower.includes('dev complete') || lower.includes('dev done')) return { index: 5, phase: DEVELOPMENT_PHASES[5] };
  if (lower.includes('fat')) return { index: 6, phase: DEVELOPMENT_PHASES[6] };
  if (lower.includes('sit gate') || lower.includes('sit entry')) return { index: 7, phase: DEVELOPMENT_PHASES[7] };
  if (lower.includes('smoke')) return { index: 8, phase: DEVELOPMENT_PHASES[8] };
  if (lower.includes('sit in progress') || (lower.includes('sit') && !lower.includes('uat'))) return { index: 9, phase: DEVELOPMENT_PHASES[9] };
  if (lower.includes('uat gate') || lower.includes('uat entry')) return { index: 10, phase: DEVELOPMENT_PHASES[10] };
  if (lower.includes('uat in progress') || lower.includes('testing')) return { index: 11, phase: DEVELOPMENT_PHASES[11] };
  if (lower.includes('uat sign')) return { index: 12, phase: DEVELOPMENT_PHASES[12] };
  if (lower.includes('release appr') || lower.includes('approval')) return { index: 13, phase: DEVELOPMENT_PHASES[13] };
  if (lower.includes('ready for prod') || lower.includes('release')) return { index: 14, phase: DEVELOPMENT_PHASES[14] };
  if (lower.includes('deploy') || lower.includes('live')) return { index: 15, phase: DEVELOPMENT_PHASES[15] };
  if (lower.includes('complete') || lower.includes('close')) return { index: 16, phase: DEVELOPMENT_PHASES[16] };

  if (lower.includes('plan')) return { index: 3, phase: DEVELOPMENT_PHASES[3] };

  return { index: 4, phase: DEVELOPMENT_PHASES[4] };
}
