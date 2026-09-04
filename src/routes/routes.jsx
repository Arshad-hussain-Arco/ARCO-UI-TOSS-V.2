import { Navigate, Outlet } from 'react-router-dom';

import { AuthLayout } from '@layouts/AuthLayout/AuthLayout';
import { BlankLayout } from '@layouts/BlankLayout/BlankLayout';
import { DashboardLayout } from '@layouts/DashboardLayout/DashboardLayout';
import { PageLayout } from '@layouts/PageLayout/PageLayout';
import { ROUTES } from '@constants/routes';

import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { RequirePermission } from './RequirePermission';
import { lazyPage } from './lazyPage';

/* ── Pages ────────────────────────────────────────────────────────────────────
   Every page is code-split. The Suspense boundary lives in the layout, so a
   route transition shows the shell immediately and streams the page in.
   ─────────────────────────────────────────────────────────────────────────── */

const LoginPage = lazyPage(() => import('@pages/Login/LoginPage'), 'LoginPage');
const NotFoundPage = lazyPage(() => import('@pages/NotFound/NotFoundPage'), 'NotFoundPage');
const ErrorPage = lazyPage(() => import('@pages/Error/ErrorPage'), 'ErrorPage');

const HomePage = lazyPage(() => import('@pages/Home/HomePage'), 'HomePage');
const DashboardPage = lazyPage(() => import('@pages/Dashboard/DashboardPage'), 'DashboardPage');
const EnvironmentDashboardPage = lazyPage(
  () => import('@pages/EnvironmentDashboard/EnvironmentDashboardPage'),
  'EnvironmentDashboardPage',
);
const MurexRuntimeTrendsPage = lazyPage(
  () => import('@pages/MurexRuntimeTrends/MurexRuntimeTrendsPage'),
  'MurexRuntimeTrendsPage',
);
const EODManagementPage = lazyPage(
  () => import('@pages/EODManagement/EODManagementPage'),
  'EODManagementPage',
);
const ConsultantsPage = lazyPage(
  () => import('@pages/Consultants/ConsultantsPage'),
  'ConsultantsPage',
);
const LeaveManagementPage = lazyPage(
  () => import('@pages/LeaveManagement/LeaveManagementPage'),
  'LeaveManagementPage',
);
const AttendancePage = lazyPage(() => import('@pages/Attendance/AttendancePage'), 'AttendancePage');
const CapacityPlanningPage = lazyPage(
  () => import('@pages/CapacityPlanning/CapacityPlanningPage'),
  'CapacityPlanningPage',
);
const ReconciliationPage = lazyPage(
  () => import('@pages/Reconciliation/ReconciliationPage'),
  'ReconciliationPage',
);
const ReconciliationUserGuidePage = lazyPage(
  () => import('@pages/Reconciliation/ReconciliationUserGuidePage'),
  'ReconciliationUserGuidePage',
);
const DocumentsUserGuidePage = lazyPage(
  () => import('@pages/Documents/DocumentsUserGuidePage'),
  'DocumentsUserGuidePage',
);
const ProjectMonitoringPage = lazyPage(
  () => import('@pages/ProjectMonitoring/ProjectMonitoringPage'),
  'ProjectMonitoringPage',
);
const ImportantLinksPage = lazyPage(
  () => import('@pages/ImportantLinks/ImportantLinksPage'),
  'ImportantLinksPage',
);
const LinkContentPage = lazyPage(
  () => import('@pages/ImportantLinks/LinkContentPage'),
  'LinkContentPage',
);
const DocumentsPage = lazyPage(() => import('@pages/Documents/DocumentsPage'), 'DocumentsPage');
const RoleManagementPage = lazyPage(
  () => import('@pages/admin/RoleManagement/RoleManagementPage'),
  'RoleManagementPage',
);
const HomeManagementPage = lazyPage(
  () => import('@pages/admin/HomeManagement/HomeManagementPage'),
  'HomeManagementPage',
);
const LeaveConfigurationPage = lazyPage(
  () => import('@pages/admin/LeaveConfiguration/LeaveConfigurationPage'),
  'LeaveConfigurationPage',
);
const SystemSettingsPage = lazyPage(
  () => import('@pages/admin/SystemSettings/SystemSettingsPage'),
  'SystemSettingsPage',
);
const PreferencesPage = lazyPage(
  () => import('@pages/Preferences/PreferencesPage'),
  'PreferencesPage',
);

/**
 * Route tree consumed by createBrowserRouter.
 *
 * Structure:
 *   /                     → redirect to the dashboard
 *   PublicRoute           → AuthLayout      → login
 *   ProtectedRoute        → DashboardLayout → every application page
 *   BlankLayout           → error pages and the catch-all 404
 *
 * @type {import('react-router-dom').RouteObject[]}
 */
export const routes = [
  { path: ROUTES.RECONCILIATION_USER_GUIDE, element: <ReconciliationUserGuidePage /> },
  { path: ROUTES.DOCUMENTS_USER_GUIDE, element: <DocumentsUserGuidePage /> },
  {
    path: ROUTES.ROOT,
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },

  // ── Public ────────────────────────────────────────────────────────────────
  {
    element: <PublicRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [{ path: ROUTES.LOGIN, element: <LoginPage /> }],
      },
    ],
  },

  // ── Protected ─────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          // Full-bleed pages: both own their scrolling regions and render no
          // breadcrumb, matching the original design.
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          {
            path: ROUTES.DOCUMENTS,
            element: (
              <RequirePermission code="DOCUMENTS_VIEW">
                <DocumentsPage />
              </RequirePermission>
            ),
          },

          // Every other page gets the standard breadcrumb + content chrome.
          {
            element: <PageLayout />,
            children: [
              // Open to every authenticated user — no permission gate.
              { path: ROUTES.HOME, element: <HomePage /> },
              { path: ROUTES.LEAVE_MANAGEMENT, element: <LeaveManagementPage /> },
              { path: ROUTES.PREFERENCES, element: <PreferencesPage /> },

              {
                path: ROUTES.ENVIRONMENT_DASHBOARD,
                element: (
                  <RequirePermission code="ENVIRONMENT_DASHBOARD_VIEW">
                    <EnvironmentDashboardPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.MUREX_RUNTIME,
                element: (
                  <RequirePermission code="MUREX_RUNTIME_VIEW">
                    <MurexRuntimeTrendsPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.EOD_MANAGEMENT,
                element: (
                  <RequirePermission
                    codes={[
                      'EOD_OVERVIEW_VIEW',
                      'EOD_CONFIG_VIEW',
                      'EOD_SCHEDULE_VIEW',
                      'EOD_CONTROL_VIEW',
                    ]}
                  >
                    <EODManagementPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.CONSULTANTS,
                element: (
                  // Consultants, Inactive Consultants, and Teams are
                  // independent tabs within this page — any one permission
                  // is enough to reach it, the page itself filters which
                  // tabs are actually visible.
                  <RequirePermission
                    codes={['EMPLOYEE_VIEW', 'EMPLOYEE_VIEW_INACTIVE', 'TEAMS_VIEW']}
                  >
                    <ConsultantsPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.CONSULTANT_DETAIL,
                element: (
                  <RequirePermission
                    codes={['EMPLOYEE_VIEW', 'EMPLOYEE_VIEW_INACTIVE', 'TEAMS_VIEW']}
                  >
                    <ConsultantsPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.ATTENDANCE,
                element: (
                  <RequirePermission allowManager>
                    <AttendancePage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.CAPACITY_PLANNING,
                element: (
                  <RequirePermission code="CAPACITY_PLANNING_VIEW">
                    <CapacityPlanningPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.RECONCILIATION,
                element: (
                  <RequirePermission code="RECONCILIATION_VIEW">
                    <ReconciliationPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.PROJECT_MONITORING,
                element: (
                  <RequirePermission code="PROJECT_MONITORING_VIEW">
                    <ProjectMonitoringPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.IMPORTANT_LINKS,
                element: (
                  <RequirePermission code="IMPORTANT_LINKS_VIEW">
                    <ImportantLinksPage />
                  </RequirePermission>
                ),
              },
              {
                // Reachable from the Important Links page itself AND the
                // header's pinned-links widget — the latter is reachable
                // via SHOW_HEADER/PIN_HEADER alone (no IMPORTANT_LINKS_VIEW),
                // so this route accepts any of the same three codes as the
                // link list itself (see LinkDataListView's docstring).
                path: ROUTES.IMPORTANT_LINKS_CONTENT,
                element: (
                  <RequirePermission
                    codes={[
                      'IMPORTANT_LINKS_VIEW',
                      'IMPORTANT_LINKS_PIN_HEADER',
                      'IMPORTANT_LINKS_SHOW_HEADER',
                    ]}
                  >
                    <LinkContentPage />
                  </RequirePermission>
                ),
              },

              // ── Admin section — gated by user.isAdmin only, never a permission code ──
              {
                path: ROUTES.ADMIN,
                element: (
                  <RequirePermission admin>
                    <Outlet />
                  </RequirePermission>
                ),
                children: [
                  { index: true, element: <Navigate to={ROUTES.ADMIN_ROLES} replace /> },
                  { path: 'home-management', element: <HomeManagementPage /> },
                  { path: 'roles', element: <RoleManagementPage /> },
                  { path: 'leave-configurations', element: <LeaveConfigurationPage /> },
                  { path: 'settings', element: <SystemSettingsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Errors ────────────────────────────────────────────────────────────────
  {
    element: <BlankLayout />,
    children: [
      { path: ROUTES.FORBIDDEN, element: <ErrorPage status={403} /> },
      { path: ROUTES.SERVER_ERROR, element: <ErrorPage status={500} /> },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    ],
  },
];

export default routes;
