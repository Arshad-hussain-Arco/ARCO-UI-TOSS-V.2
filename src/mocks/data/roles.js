/**
 * Role and permission fixtures.
 */
export const PERMISSION_LEVELS = Object.freeze({
  ALLOWED: 'allowed',
  PARTIAL: 'partial',
  DENIED: 'denied',
  NOT_SET: 'not_set',
});

/** Column order of the permission matrix. */
export const PERMISSION_ACTIONS = [
  { key: 'add', label: 'Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'read', label: 'Read' },
  { key: 'export', label: 'Export' },
];

export const PERMISSION_MODULES = [
  'Runtime Trends',
  'Consultants',
  'Teams',
  'Leave Management',
  'Documents',
  'Important Links',
  'Project Breaches',
  'Reconciliation',
];

const { ALLOWED, PARTIAL, DENIED, NOT_SET } = PERMISSION_LEVELS;

/** Builds one matrix row; `remove` avoids shadowing the `delete` keyword. */
const row = (add, edit, remove, read, exportLevel) => ({
  add,
  edit,
  delete: remove,
  read,
  export: exportLevel,
});

/**
 * Permission grid.
 *
 * NOTE: the design supplies a single matrix that every role displays — selecting a
 * different role does not change the grid. That is carried over as-is rather than
 * inventing per-role data. When the backend exposes real permissions, return a
 * matrix per role from `getRole(id)` and this constant goes away.
 */
export const PERMISSION_MATRIX = {
  'Runtime Trends': row(NOT_SET, NOT_SET, NOT_SET, ALLOWED, ALLOWED),
  Consultants: row(ALLOWED, ALLOWED, DENIED, ALLOWED, ALLOWED),
  Teams: row(ALLOWED, ALLOWED, PARTIAL, ALLOWED, PARTIAL),
  'Leave Management': row(ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED),
  Documents: row(ALLOWED, ALLOWED, DENIED, ALLOWED, ALLOWED),
  'Important Links': row(ALLOWED, ALLOWED, DENIED, ALLOWED, NOT_SET),
  'Project Breaches': row(PARTIAL, PARTIAL, DENIED, ALLOWED, ALLOWED),
  Reconciliation: row(DENIED, DENIED, DENIED, ALLOWED, ALLOWED),
};

export const ROLES = [
  { id: '1', name: 'Supervisor', permissions: 42, iconKey: 'shield' },
  { id: '2', name: 'System Engineer', permissions: 38, iconKey: 'settings' },
  { id: '3', name: 'Consultant', permissions: 12, iconKey: 'users' },
  { id: '4', name: 'Project Manager', permissions: 28, iconKey: 'users' },
  { id: '5', name: 'Viewer', permissions: 8, iconKey: 'users' },
  { id: '6', name: 'Custom Role', permissions: 15, iconKey: 'settings' },
];

export const ROLE_SUMMARY = {
  totalRoles: 12,
  administratorRoles: 2,
  totalPermissions: 48,
  lastUpdated: 'Today, 09:41 AM',
};
