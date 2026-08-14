import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@components/feedback/Loader/Loader';
import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';

/**
 * Route guard for authenticated areas — authentication only. Per-route
 * permission/admin gating is handled by RequirePermission, applied to
 * individual routes inside this guard's tree (see routes.jsx).
 *
 * Renders nothing decisive until the persisted session has been restored,
 * otherwise a refresh would bounce a signed-in user to the login screen. The
 * attempted location is carried in state so login can return the user there.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isInitialising } = useAuth();
  const location = useLocation();

  if (isInitialising) {
    return <Loader fullScreen message="Restoring your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
