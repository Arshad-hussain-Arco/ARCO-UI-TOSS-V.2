import { Navigate } from 'react-router-dom';

import { AuthLayout } from '@layouts/AuthLayout/AuthLayout';
import { BlankLayout } from '@layouts/BlankLayout/BlankLayout';
import { DashboardLayout } from '@layouts/DashboardLayout/DashboardLayout';
import { PageLayout } from '@layouts/PageLayout/PageLayout';
import { ROUTES } from '@constants/routes';

import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
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
const DocumentsPage = lazyPage(() => import('@pages/Documents/DocumentsPage'), 'DocumentsPage');
const RoleManagementPage = lazyPage(
  () => import('@pages/admin/RoleManagement/RoleManagementPage'),
  'RoleManagementPage',
);
const LeaveConfigurationPage = lazyPage(
  () => import('@pages/admin/LeaveConfiguration/LeaveConfigurationPage'),
  'LeaveConfigurationPage',
);
const SystemSettingsPage = lazyPage(
  () => import('@pages/admin/SystemSettings/SystemSettingsPage'),
  'SystemSettingsPage',
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
          { path: ROUTES.DOCUMENTS, element: <DocumentsPage /> },

          // Every other page gets the standard breadcrumb + content chrome.
          {
            element: <PageLayout />,
            children: [
              { path: ROUTES.HOME, element: <HomePage /> },
              { path: ROUTES.ENVIRONMENT_DASHBOARD, element: <EnvironmentDashboardPage /> },
              { path: ROUTES.MUREX_RUNTIME, element: <MurexRuntimeTrendsPage /> },
              { path: ROUTES.EOD_MANAGEMENT, element: <EODManagementPage /> },
              { path: ROUTES.CONSULTANTS, element: <ConsultantsPage /> },
              { path: ROUTES.CONSULTANT_DETAIL, element: <ConsultantsPage /> },
              { path: ROUTES.LEAVE_MANAGEMENT, element: <LeaveManagementPage /> },
              { path: ROUTES.ATTENDANCE, element: <AttendancePage /> },
              { path: ROUTES.CAPACITY_PLANNING, element: <CapacityPlanningPage /> },
              { path: ROUTES.RECONCILIATION, element: <ReconciliationPage /> },
              { path: ROUTES.PROJECT_MONITORING, element: <ProjectMonitoringPage /> },
              { path: ROUTES.IMPORTANT_LINKS, element: <ImportantLinksPage /> },

              // ── Admin section ─────────────────────────────────────────
              {
                path: ROUTES.ADMIN,
                children: [
                  { index: true, element: <Navigate to={ROUTES.ADMIN_ROLES} replace /> },
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
