import { Suspense, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@components/common/ErrorBoundary/ErrorBoundary';
import { ScrollToTop } from '@components/common/ScrollToTop/ScrollToTop';
import { Loader } from '@components/feedback/Loader/Loader';
import { Header } from '@components/layout/Header/Header';
import { Sidebar } from '@components/layout/Sidebar/Sidebar';
import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';
import { useSidebar } from '@hooks/useSidebar';

import './DashboardLayout.css';

/** Container the routed page scrolls inside — see PageWrapper.css. */
const SCROLL_CONTAINER = '.page-content';

/**
 * Chrome shared by every authenticated page: navigation rail, header and the
 * routed outlet. Route changes are isolated behind their own error boundary and
 * Suspense fallback so a failing page never takes the shell down with it.
 */
export function DashboardLayout() {
  const { isCollapsed, collapse } = useSidebar();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logout, navigate]);

  return (
    <div className="dashboard-page">
      <ScrollToTop selector={SCROLL_CONTAINER} />

      {/* Mobile drawer backdrop — hidden above the mobile breakpoint by CSS. */}
      {!isCollapsed ? (
        <div
          className="dashboard-backdrop"
          onClick={collapse}
          role="presentation"
          aria-hidden="true"
        />
      ) : null}

      <Sidebar />

      <div className="dashboard-main" data-sidebar-collapsed={isCollapsed}>
        <Header user={user} onLogout={handleLogout} />

        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Loader message="Loading page…" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default DashboardLayout;
