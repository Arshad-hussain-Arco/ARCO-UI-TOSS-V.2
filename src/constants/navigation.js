import {
  Calendar,
  Clock,
  FileText,
  Gauge,
  GitCompare,
  Home,
  LayoutDashboard,
  Link as LinkIcon,
  Monitor,
  PieChart,
  Settings,
  Sunset,
  TrendingUp,
  Users,
} from 'lucide-react';

import { ROUTES } from './routes';

/**
 * Primary sidebar navigation. This is the single definition of the menu — the
 * sidebar renders it, and the breadcrumb trail is derived from it, so a label or
 * path only ever changes in one place.
 *
 * @typedef  {Object} NavItem
 * @property {string} id
 * @property {string} label
 * @property {import('react').ComponentType} [icon]
 * @property {string} [to]                   Absolute route path (leaf items).
 * @property {NavItem[]} [children]          Sub-navigation (branch items).
 * @property {string} [permission]           RBAC permission code gating this item.
 *   Omitted for items open to every authenticated user (Home, Dashboard, Leave
 *   Management — Leave Management's own tabs are gated by manager hierarchy,
 *   never by a permission code, see LeaveManagementPage.jsx).
 * @property {string[]} [permissions]        Alternative to `permission` for a
 *   screen with multiple independent tab-level view codes and no single
 *   screen-level code (e.g. EOD Management) — visible if the user has ANY
 *   one of these.
 * @property {boolean} [admin]               True only for the Admin Panel group —
 *   gated by user.isAdmin, never a permission code (see AuthContext/user-info).
 */

/** @type {NavItem[]} */
export const SIDEBAR_NAVIGATION = [
  { id: 'home', label: 'Home', icon: Home, to: ROUTES.HOME },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  {
    id: 'project',
    label: 'Project Monitoring',
    icon: Monitor,
    to: ROUTES.PROJECT_MONITORING,
    permission: 'PROJECT_MONITORING_VIEW',
  },
  {
    id: 'environment',
    label: 'Environment Dashboard',
    icon: Gauge,
    to: ROUTES.ENVIRONMENT_DASHBOARD,
    permission: 'ENVIRONMENT_DASHBOARD_VIEW',
  },
  {
    id: 'murex',
    label: 'Murex Runtime Trends',
    icon: TrendingUp,
    to: ROUTES.MUREX_RUNTIME,
    permission: 'MUREX_RUNTIME_VIEW',
  },
  {
    id: 'eod',
    label: 'EOD Management',
    icon: Sunset,
    to: ROUTES.EOD_MANAGEMENT,
    // 4 independent tab-view permissions, no single screen-level code —
    // visible if the user can see any one of the 4 tabs.
    permissions: ['EOD_OVERVIEW_VIEW', 'EOD_CONFIG_VIEW', 'EOD_SCHEDULE_VIEW', 'EOD_CONTROL_VIEW'],
  },
  {
    id: 'consultants',
    label: 'Consultants',
    icon: Users,
    to: ROUTES.CONSULTANTS,
    // Consultants, Inactive Consultants, and Teams are independent tabs on
    // this page — visible if the user has any one permission (the page
    // itself filters which tabs are actually shown).
    permissions: ['EMPLOYEE_VIEW', 'EMPLOYEE_VIEW_INACTIVE', 'TEAMS_VIEW'],
  },
  // No `permission` — open to every authenticated user. Team Requests / Leave
  // Configuration inside this screen are gated by manager hierarchy instead.
  { id: 'leave', label: 'Leave Management', icon: Calendar, to: ROUTES.LEAVE_MANAGEMENT },
  // No `permission` — gated purely by manager hierarchy (managerOnly),
  // same mechanism as Leave Management's Team tabs; see user.isManager.
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Clock,
    to: ROUTES.ATTENDANCE,
    managerOnly: true,
  },
  {
    id: 'capacity',
    label: 'Capacity Planning',
    icon: PieChart,
    to: ROUTES.CAPACITY_PLANNING,
    permission: 'CAPACITY_PLANNING_VIEW',
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    icon: GitCompare,
    to: ROUTES.RECONCILIATION,
    permission: 'RECONCILIATION_VIEW',
  },
  {
    id: 'links',
    label: 'Important Links',
    icon: LinkIcon,
    to: ROUTES.IMPORTANT_LINKS,
    permission: 'IMPORTANT_LINKS_VIEW',
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    to: ROUTES.DOCUMENTS,
    permission: 'DOCUMENTS_VIEW',
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: Settings,
    to: ROUTES.ADMIN,
    admin: true,
    children: [
      { id: 'admin-home-management', label: 'Home Content Management', to: ROUTES.ADMIN_HOME_MANAGEMENT },
      { id: 'admin-roles', label: 'Roles & Permissions', to: ROUTES.ADMIN_ROLES },
      {
        id: 'admin-leave-config',
        label: 'Leave Policy Management',
        to: ROUTES.ADMIN_LEAVE_CONFIGURATIONS,
      },
      { id: 'admin-settings', label: 'System Settings', to: ROUTES.ADMIN_SETTINGS },
    ],
  },
];

/**
 * Reorders `items` (each with an `id`) per `order`, a list of ids. Items not
 * named in `order` keep their catalog-relative order and are appended after
 * the ones `order` does name — so an item added to SIDEBAR_NAVIGATION after
 * an admin last saved an override doesn't vanish, it just lands at the end
 * until they explicitly reorder again.
 *
 * @param {{id: string}[]} items
 * @param {string[]} [order]
 */
export function applyOrder(items, order) {
  if (!Array.isArray(order) || order.length === 0) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    return ra - rb;
  });
}

/**
 * Filters SIDEBAR_NAVIGATION down to items the given user may see, then
 * applies their role's configured display order (Preferences > Sidebar
 * Layout, edited per-role by an admin). Items with no `permission`/`admin`/
 * `managerOnly` gate are always visible to an authenticated user. `navOrder`
 * is the raw {order, adminChildrenOrder} shape carried on
 * `user.sidebarNavOrder` (set from the role's stored config by
 * /auth/user-info/) — omit it (or pass empty arrays) to fall back to the
 * hardcoded catalog order.
 *
 * @param {{ isAdmin?: boolean, isManager?: boolean }} user
 * @param {(code: string) => boolean} hasPermission
 * @param {{ order?: string[], adminChildrenOrder?: string[] }} [navOrder]
 */
export function getVisibleNavigation(user, hasPermission, navOrder) {
  const visible = SIDEBAR_NAVIGATION.filter((item) => {
    if (item.admin) return Boolean(user?.isAdmin);
    if (item.managerOnly) return Boolean(user?.isManager);
    if (item.permissions) return item.permissions.some((code) => hasPermission(code));
    if (item.permission) return hasPermission(item.permission);
    return true;
  }).map((item) =>
    item.children
      ? { ...item, children: applyOrder(item.children, navOrder?.adminChildrenOrder) }
      : item,
  );

  return applyOrder(visible, navOrder?.order);
}

/** Secondary links rendered in the header. */
export const HEADER_NAVIGATION = [
  { id: 'link1', label: 'Link 1', to: ROUTES.HOME },
  { id: 'link2', label: 'Link 2', to: ROUTES.IMPORTANT_LINKS },
  { id: 'link3', label: 'Link 3', to: ROUTES.DOCUMENTS },
];

/**
 * Route path → breadcrumb trail. Built from SIDEBAR_NAVIGATION so the two can
 * never drift apart. The dashboard deliberately has an empty trail, matching the
 * original design.
 *
 * @type {Record<string, { label: string, to?: string }[]>}
 */
export const BREADCRUMB_TRAILS = SIDEBAR_NAVIGATION.reduce((trails, item) => {
  if (item.children) {
    item.children.forEach((child) => {
      trails[child.to] = [
        { label: item.label, to: item.to },
        { label: child.label, to: child.to },
      ];
    });
    return trails;
  }

  trails[item.to] = item.to === ROUTES.DASHBOARD ? [] : [{ label: item.label, to: item.to }];
  return trails;
}, {});
