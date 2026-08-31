import { Navigate } from 'react-router-dom';

import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';

/**
 * Per-route authorisation gate, used inside ProtectedRoute's tree (which
 * already handles the isAuthenticated check). Two independent gates:
 *
 *   - `admin`: only the Admin Panel screens use this — backed by
 *     user.isAdmin, never a permission code.
 *   - `code` / `codes`: every other RBAC-gated screen — backed by
 *     hasPermission(code). Use `codes` (array) for a screen with multiple
 *     independent tab-level view permissions and no single screen-level
 *     code (e.g. EOD Management: any one of its 4 tabs' View permissions
 *     is enough to reach the page — the tabs themselves further filter
 *     what's visible once there).
 *
 * Leave Management routes pass neither prop; that screen is open to every
 * authenticated user (its manager-only tabs gate themselves internally via
 * user.mySubordinates, not via routing).
 *
 * `allowManager`: same manager-hierarchy signal Leave Management uses
 * (user.mySubordinates.length > 0, exposed as user.isManager). Pass it
 * alone (no `code`/`codes`) for a screen gated purely by manager status,
 * e.g. Attendance; pass it alongside `code`/`codes` so a Manager can also
 * reach a permission-gated route without holding that code.
 *
 * @param {Object} props
 * @param {string} [props.code]       Single permission code required for this route.
 * @param {string[]} [props.codes]    Any one of these codes is sufficient.
 * @param {boolean} [props.admin]     True if this route requires Admin Panel access.
 * @param {boolean} [props.allowManager] True to also allow any Manager (user.isManager).
 * @param {import('react').ReactNode} props.children
 */
export function RequirePermission({ code, codes, admin, allowManager, children }) {
  const { user, hasPermission } = useAuth();

  const managerAllowed = Boolean(allowManager && user?.isManager);

  const allowed = admin
    ? Boolean(user?.isAdmin)
    : code || codes
      ? (codes ? codes.some((c) => hasPermission(c)) : hasPermission(code)) || managerAllowed
      : allowManager
        ? managerAllowed
        : true;

  if (!allowed) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return children;
}

export default RequirePermission;
