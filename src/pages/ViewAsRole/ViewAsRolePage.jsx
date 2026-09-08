import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { impersonationStorage } from '@utils/impersonationStorage';
import { IMPERSONATION_KEYS } from '@constants/storageKeys';
import { ROUTES } from '@constants/routes';
import { impersonationService } from '@services/impersonationService';
import { resetImpersonationEndGuard } from '@api/httpClient';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

// Intentionally reuses AccessAccountPage's stylesheet — same picker-card
// look, different (and simpler) flow underneath.
import '../AccessAccount/AccessAccountPage.css';

/**
 * "View as Role" flow — opened in its own browser tab from the top-left
 * user menu (ProfileMenu), visible only to users whose role has
 * IsAdmin=True. Distinct from "Access Account": there is no target
 * employee and no separate credential. This tab is opened via
 * window.open() from the admin's own authenticated tab, so it already has
 * the admin's real login token available (localStorage, shared within the
 * origin) — the role list/start calls below ride on that token directly
 * (see impersonationService.listRoles/startRole and the backend's
 * ImpersonationRoleListView, gated by IsAdminPanel rather than the
 * dedicated impersonation credential).
 *
 * The session renders the ADMIN'S OWN identity and data, but with every
 * permission check resolved against the picked role instead of the
 * admin's real one (see common/authz.get_logged_in_emp on the backend) —
 * a permission-accurate preview, not a different person's account and not
 * synthetic data.
 *
 * Once a role is picked, the issued tokens are written to sessionStorage
 * (this tab only, same as Access Account) and the tab does a full
 * navigation to '/' so the app boots fresh under the simulated role.
 */
export function ViewAsRolePage() {
  useDocumentTitle('View as Role');

  const [roles, setRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await impersonationService.listRoles();
        if (!cancelled) setRoles(list);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught.response?.data?.message ||
              'Could not load roles. Make sure you are signed in as an admin in this browser.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingRoles(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectRole = useCallback(async (role) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await impersonationService.startRole(role.id);

      resetImpersonationEndGuard();
      impersonationStorage.set(IMPERSONATION_KEYS.ACCESS_TOKEN, data.access);
      impersonationStorage.set(IMPERSONATION_KEYS.REFRESH_TOKEN, data.refresh);
      impersonationStorage.remove(IMPERSONATION_KEYS.USER);

      window.location.assign(ROUTES.ROOT);
    } catch (caught) {
      setError(
        caught.response?.data?.message || 'Could not start the preview. Please try again.',
      );
      setIsSubmitting(false);
    }
  }, []);

  return (
    <div className="access-account-page">
      <div className="access-account-card">
        <h1 className="access-account-title">View as Role</h1>
        <p className="access-account-subtitle">Choose a role to preview its permissions and UI.</p>

        <div className="access-account-picker">
          {error ? (
            <p className="access-account-error" role="alert">
              {error}
            </p>
          ) : null}

          <ul className="access-account-results">
            {isLoadingRoles ? <li className="access-account-hint">Loading roles…</li> : null}
            {!isLoadingRoles && roles.length === 0 && !error ? (
              <li className="access-account-hint">No roles found.</li>
            ) : null}
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className="access-account-result"
                  disabled={isSubmitting}
                  onClick={() => handleSelectRole(role)}
                >
                  <div className="access-account-result-avatar">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="access-account-result-info">
                    <span className="access-account-result-name">{role.name}</span>
                    <span className="access-account-result-meta">
                      {role.is_admin ? 'Admin Panel role' : 'Standard role'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ViewAsRolePage;
