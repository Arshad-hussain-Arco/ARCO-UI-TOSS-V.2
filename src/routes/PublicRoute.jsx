import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@components/feedback/Loader/Loader';
import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';

/**
 * Guard for pages that only make sense while signed out (login, password reset).
 * An authenticated visitor is redirected to wherever they were headed, or to the
 * dashboard.
 */
export function PublicRoute() {
  const { isAuthenticated, isInitialising } = useAuth();
  const location = useLocation();

  if (isInitialising) {
    return <Loader fullScreen message="Restoring your session…" />;
  }

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname ?? ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
