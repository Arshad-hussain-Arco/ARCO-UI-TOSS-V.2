import { Suspense, useCallback, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@components/common/ErrorBoundary/ErrorBoundary';
import { ScrollToTop } from '@components/common/ScrollToTop/ScrollToTop';
import { Loader } from '@components/feedback/Loader/Loader';
import { Header } from '@components/layout/Header/Header';
import { ImpersonationBanner } from '@components/layout/ImpersonationBanner/ImpersonationBanner';
import { Sidebar } from '@components/layout/Sidebar/Sidebar';
import { ProfileSettingsModal } from '@components/profile/ProfileSettingsModal';
import { ChangePasswordModal } from '@components/profile/ChangePasswordModal';
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
  const { user, logout, isImpersonating, endImpersonation } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Impersonation sessions are ended, not logged out — the target
  // employee's real session must never be touched by this tab's Sign Out.
  const handleLogout = useCallback(async () => {
    if (isImpersonating) {
      await endImpersonation();
      // The "Access Account" tab was opened via window.open() (ProfileMenu),
      // so it's allowed to close itself even after navigating within itself
      // (AccessAccountPage's window.location.assign to '/'). If the browser
      // refuses (e.g. the user reopened this tab from history, or a policy
      // blocks script-closes), execution continues below and we land on a
      // safe screen instead of the now-dead impersonated dashboard.
      window.close();
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logout, endImpersonation, isImpersonating, navigate]);

  return (
    <div className="dashboard-page">
      <ScrollToTop selector={SCROLL_CONTAINER} />

      {isImpersonating ? (
        <ImpersonationBanner
          targetName={user?.name}
          adminName={user?.impersonatedByName}
          onEndSession={handleLogout}
        />
      ) : null}

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
        <Header
          user={user}
          onLogout={handleLogout}
          onOpenProfileSettings={() => setIsProfileModalOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        />

        <div className="page-outlet">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<Loader message="Loading page…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
}

export default DashboardLayout;
