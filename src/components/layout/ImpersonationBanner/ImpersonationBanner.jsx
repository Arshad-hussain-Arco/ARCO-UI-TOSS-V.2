import { ShieldAlert } from 'lucide-react';

import './ImpersonationBanner.css';

/**
 * Persistent, non-dismissable banner shown for the lifetime of an
 * impersonation session — the target employee's name and the acting
 * admin's name are always visible, and "End session" is always one click
 * away. Rendered only when AuthContext's `isImpersonating` is true.
 */
export function ImpersonationBanner({ targetName, adminName, onEndSession }) {
  return (
    <div className="impersonation-banner" role="status">
      <ShieldAlert className="impersonation-banner-icon" aria-hidden="true" />
      <span className="impersonation-banner-text">
        Viewing as <strong>{targetName}</strong> — Admin: <strong>{adminName}</strong>
      </span>
      <button type="button" className="impersonation-banner-end" onClick={onEndSession}>
        End session
      </button>
    </div>
  );
}

export default ImpersonationBanner;
