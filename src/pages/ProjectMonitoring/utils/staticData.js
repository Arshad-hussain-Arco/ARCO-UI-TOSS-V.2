/**
 * Static Data definitions for Project Monitoring and Project Breaches
 * Single Source of Truth based on authoritative legacy specification
 */

export const PMStatusGroups = [
  { id: 1, name: 'Inception', value: 20, color: '#49c8ee', stageScope: 'Open stage' },
  { id: 2, name: 'Planning', value: 14, color: '#0d6efd', stageScope: 'BRD Analysis, SSD Analysis, In Design' },
  { id: 3, name: 'Building', value: 10, color: '#ffc107', stageScope: 'In Development, Development Completed' },
  { id: 4, name: 'Testing', value: 15, color: '#a964e1', stageScope: 'FAT Testing, SIT Checkpoint, Smoke Testing, SIT Progress, UAT Checkpoint, UAT Progress, UAT Sign Off' },
  { id: 5, name: 'Release Process', value: 26, color: '#36a49b', stageScope: 'Release Approval, Ready For Production' },
  { id: 6, name: 'Deployed', value: 23, color: '#20c769', stageScope: 'Deployed' },
  { id: 7, name: 'Completed', value: 8, color: '#198754', stageScope: 'Completed' },
];

export const PMStatus = [
  { id: 1, name: 'Open', groupid: 1, color: '#49c8ee', category: 'Inception' },
  { id: 2, name: 'BRD Analysis', groupid: 2, color: '#86B7FE', category: 'Planning' },
  { id: 3, name: 'SSD Analysis', groupid: 2, color: '#5E9EFE', category: 'Planning' },
  { id: 4, name: 'In Design', groupid: 2, color: '#3586FD', category: 'Planning' },
  { id: 5, name: 'In Development', groupid: 3, color: '#FFD65A', category: 'Building' },
  { id: 6, name: 'Development Completed', groupid: 3, color: '#FFCB30', category: 'Building' },
  { id: 7, name: 'FAT Testing', groupid: 4, color: '#A964E1', category: 'Testing' },
  { id: 8, name: 'SIT Entry Checkpoint', groupid: 4, color: '#AF71E2', category: 'Testing' },
  { id: 9, name: 'Smoke Testing', groupid: 4, color: '#B67DE4', category: 'Testing' },
  { id: 10, name: 'SIT in Progress', groupid: 4, color: '#BC8AE5', category: 'Testing' },
  { id: 11, name: 'UAT Entry Checkpoint', groupid: 4, color: '#C397E6', category: 'Testing' },
  { id: 12, name: 'UAT InProgress', groupid: 4, color: '#C9A4E8', category: 'Testing' },
  { id: 13, name: 'UAT Sign Off', groupid: 4, color: '#D0B0E9', category: 'Testing' },
  { id: 14, name: 'Release Approval', groupid: 5, color: '#47ABA3', category: 'Release' },
  { id: 15, name: 'Ready For Production', groupid: 5, color: '#36a49b', category: 'Release' },
  { id: 16, name: 'Deployed', groupid: 6, color: '#20c769', category: 'Production' },
  { id: 17, name: 'Completed', groupid: 7, color: '#198754', category: 'Production' },
];

export const ExceptionStatuses = {
  testingBlocked: { name: 'Testing Blocked', color: '#d33f49' },
  deferred: { name: 'Deferred', color: '#868d95' },
};

/**
 * Finds status object by name (case-insensitive)
 */
export function getPMStatusByName(statusName) {
  if (!statusName || typeof statusName !== 'string') return null;
  const trimmed = statusName.trim().toLowerCase();
  return PMStatus.find((st) => st.name.toLowerCase() === trimmed) || null;
}

/**
 * Maps raw status string to StatusId and StatusGroup
 */
export function mapStatusToIds(statusName) {
  const matched = getPMStatusByName(statusName);
  if (matched) {
    return { statusId: matched.id, statusGroup: matched.groupid };
  }
  return { statusId: 0, statusGroup: 0 };
}
