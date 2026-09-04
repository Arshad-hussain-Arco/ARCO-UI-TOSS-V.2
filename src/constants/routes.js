/**
 * Every route path in the application, declared once.
 * Components must never hard-code a URL string — import from here instead.
 */
export const ROUTES = Object.freeze({
  ROOT: '/',

  // Public
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',

  // Protected — dashboard shell
  HOME: '/home',
  DASHBOARD: '/dashboard',
  ENVIRONMENT_DASHBOARD: '/environment-dashboard',
  MUREX_RUNTIME: '/murex-runtime',
  EOD_MANAGEMENT: '/eod-management',
  CONSULTANTS: '/consultants',
  CONSULTANT_DETAIL: '/consultants/:consultantId',
  LEAVE_MANAGEMENT: '/leave-management',
  ATTENDANCE: '/attendance',
  CAPACITY_PLANNING: '/capacity-planning',
  RECONCILIATION: '/reconciliation',
  RECONCILIATION_USER_GUIDE: '/reconciliation/user-guide',
  PROJECT_MONITORING: '/project-monitoring',
  IMPORTANT_LINKS: '/important-links',
  IMPORTANT_LINKS_CONTENT: '/important-links/content/:id',
  PREFERENCES: '/preferences',
  DOCUMENTS: '/documents',
  DOCUMENTS_USER_GUIDE: '/documents/user-guide',

  // Protected — admin section
  ADMIN: '/admin',
  ADMIN_HOME_MANAGEMENT: '/admin/home-management',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_LEAVE_CONFIGURATIONS: '/admin/leave-configurations',
  ADMIN_SETTINGS: '/admin/settings',

  // Error routes
  FORBIDDEN: '/403',
  SERVER_ERROR: '/500',
  NOT_FOUND: '*',
});

/** Builds a concrete URL from a parameterised route pattern. */
export const buildPath = (pattern, params = {}) =>
  Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    pattern,
  );

export default ROUTES;
