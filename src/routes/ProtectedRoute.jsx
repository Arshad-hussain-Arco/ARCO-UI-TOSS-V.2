import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@components/feedback/Loader/Loader';
import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';

/**
 * Route guard for authenticated areas.
 *
 * Renders nothing decisive until the persisted session has been restored,
 * otherwise a refresh would bounce a signed-in user to the login screen. The
 * attempted location is carried in state so login can return the user there.
 *
 * @param {Object} props
 * @param {string} [props.requiredPermission]  Optional per-route authorisation.
 */
export function ProtectedRoute({ requiredPermission }) {
  const { isAuthenticated, isInitialising, hasPermission } = useAuth();
  const location = useLocation();

  if (isInitialising) {
    return <Loader fullScreen message="Restoring your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
