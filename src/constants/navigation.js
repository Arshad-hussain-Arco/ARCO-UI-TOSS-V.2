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
 */

/** @type {NavItem[]} */
export const SIDEBAR_NAVIGATION = [
  { id: 'home', label: 'Home', icon: Home, to: ROUTES.HOME },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  {
    id: 'environment',
    label: 'Environment Dashboard',
    icon: Gauge,
    to: ROUTES.ENVIRONMENT_DASHBOARD,
  },
  { id: 'murex', label: 'Murex Runtime Trends', icon: TrendingUp, to: ROUTES.MUREX_RUNTIME },
  { id: 'eod', label: 'EOD Management', icon: Sunset, to: ROUTES.EOD_MANAGEMENT },
  { id: 'consultants', label: 'Consultants', icon: Users, to: ROUTES.CONSULTANTS },
  { id: 'leave', label: 'Leave Management', icon: Calendar, to: ROUTES.LEAVE_MANAGEMENT },
  { id: 'attendance', label: 'Attendance', icon: Clock, to: ROUTES.ATTENDANCE },
  { id: 'capacity', label: 'Capacity Planning', icon: PieChart, to: ROUTES.CAPACITY_PLANNING },
  { id: 'reconciliation', label: 'Reconciliation', icon: GitCompare, to: ROUTES.RECONCILIATION },
  { id: 'project', label: 'Project Monitoring', icon: Monitor, to: ROUTES.PROJECT_MONITORING },
  { id: 'links', label: 'Important Links', icon: LinkIcon, to: ROUTES.IMPORTANT_LINKS },
  { id: 'documents', label: 'Documents', icon: FileText, to: ROUTES.DOCUMENTS },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: Settings,
    to: ROUTES.ADMIN,
    children: [
      { id: 'admin-roles', label: 'Roles & Permissions', to: ROUTES.ADMIN_ROLES },
      {
        id: 'admin-leave-config',
        label: 'Leave Configurations',
        to: ROUTES.ADMIN_LEAVE_CONFIGURATIONS,
      },
      { id: 'admin-settings', label: 'System Settings', to: ROUTES.ADMIN_SETTINGS },
    ],
  },
];

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
