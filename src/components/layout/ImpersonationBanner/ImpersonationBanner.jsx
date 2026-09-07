import { ShieldAlert } from 'lucide-react';

import './ImpersonationBanner.css';

/**
 * Persistent, non-dismissable banner shown for the lifetime of an
 * impersonation session, and "End session" is always one click away.
 * Rendered only when AuthContext's `isImpersonating` is true.
 *
 * Two wordings, matching the two distinct flows:
 *  - isRoleSimulation=false ("Access Account"): a real target employee's
 *    identity/data — targetName is that employee.
 *  - isRoleSimulation=true ("View as Role"): the admin's OWN identity,
 *    permissions simulated as roleName — targetName is unused.
 */
export function ImpersonationBanner({ targetName, adminName, roleName, isRoleSimulation, onEndSession }) {
  return (
    <div className="impersonation-banner" role="status">
      <ShieldAlert className="impersonation-banner-icon" aria-hidden="true" />
      <span className="impersonation-banner-text">
        {isRoleSimulation ? (
          <>
            Previewing as Role: <strong>{roleName}</strong> — Admin: <strong>{adminName}</strong>
          </>
        ) : (
          <>
            Viewing as <strong>{targetName}</strong> — Admin: <strong>{adminName}</strong>
          </>
        )}
      </span>
      <button type="button" className="impersonation-banner-end" onClick={onEndSession}>
        End session
      </button>
    </div>
  );
}

export default ImpersonationBanner;
