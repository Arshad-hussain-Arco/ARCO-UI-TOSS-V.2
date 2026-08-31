import { Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { Loader } from '@components/feedback/Loader/Loader';
import { ROUTES } from '@constants/routes';

/**
 * Root route handler that checks authentication before redirecting.
 * - Shows a loader while session is being restored
 * - Redirects to Dashboard if authenticated
 * - Redirects to Login if unauthenticated
 */
export function RootRoute() {
  const { isAuthenticated, isInitialising } = useAuth();

  if (isInitialising) {
    return <Loader fullScreen message="Checking authentication…" />;
  }

  return isAuthenticated ? (
    <Navigate to={ROUTES.DASHBOARD} replace />
  ) : (
    <Navigate to={ROUTES.LOGIN} replace />
  );
}

export default RootRoute;
