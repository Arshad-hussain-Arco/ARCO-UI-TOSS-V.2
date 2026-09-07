import { useCallback, useEffect, useState } from 'react';

import { impersonationStorage } from '@utils/impersonationStorage';
import { IMPERSONATION_KEYS } from '@constants/storageKeys';
import { ROUTES } from '@constants/routes';
import { impersonationService } from '@services/impersonationService';
import { resetImpersonationEndGuard } from '@api/httpClient';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import './AccessAccountPage.css';

/**
 * "Access Account" (impersonation) flow — opened in its own browser tab
 * from the top-left user menu (ProfileMenu). This page is intentionally
 * OUTSIDE both PublicRoute and ProtectedRoute: it has no dependency on the
 * normal AuthContext session (the new tab has no auth context at all until
 * a session is started here), and it authenticates against a completely
 * separate credential (ImpersonationCredential on the backend), not the
 * caller's own Employee login.
 *
 * Flow: verify dedicated admin credentials -> pick an employee -> start.
 * On start, the issued impersonation tokens are written to sessionStorage
 * (this tab only) and the tab does a full navigation to '/' so the app
 * boots fresh and renders as that employee.
 */
export function AccessAccountPage() {
  useDocumentTitle('Access Account');

  const [step, setStep] = useState('credentials'); // 'credentials' | 'picker'
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [setupToken, setSetupToken] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleAuthenticate = useCallback(
    async (event) => {
      event.preventDefault();
      setError(null);
      setIsSubmitting(true);
      try {
        const data = await impersonationService.authenticate(credentials);
        setSetupToken(data.setup_token);
        setAdminInfo(data.admin);
        setStep('picker');
      } catch (caught) {
        setError(
          caught.response?.data?.message || 'Invalid credentials. Please try again.',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials],
  );

  // Search on type — the setup token is short-lived, so this only ever
  // fires while the picker step is visible.
  useEffect(() => {
    if (step !== 'picker' || !setupToken) return undefined;

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const employees = await impersonationService.searchEmployees(setupToken, query);
        if (!cancelled) setResults(employees);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, setupToken, query]);

  const handleSelectEmployee = useCallback(
    async (employee) => {
      setError(null);
      setIsSubmitting(true);
      try {
        const data = await impersonationService.start(setupToken, employee.emp_id);

        resetImpersonationEndGuard();
        impersonationStorage.set(IMPERSONATION_KEYS.ACCESS_TOKEN, data.access);
        impersonationStorage.set(IMPERSONATION_KEYS.REFRESH_TOKEN, data.refresh);
        impersonationStorage.remove(IMPERSONATION_KEYS.USER);

        // Full navigation (not client-side routing) so the whole app boots
        // fresh in this tab and AuthContext picks up the impersonation
        // token from sessionStorage on its very first read.
        window.location.assign(ROUTES.ROOT);
      } catch (caught) {
        setError(
          caught.response?.data?.message || 'Could not start the session. Please try again.',
        );
        setIsSubmitting(false);
      }
    },
    [setupToken],
  );

  return (
    <div className="access-account-page">
      <div className="access-account-card">
        <h1 className="access-account-title">Access Account</h1>
        <p className="access-account-subtitle">
          {step === 'credentials'
            ? 'Sign in with your dedicated impersonation credentials.'
            : `Signed in as ${adminInfo?.name ?? 'admin'}. Choose an employee to view as.`}
        </p>

        {step === 'credentials' ? (
          <form onSubmit={handleAuthenticate} className="access-account-form" noValidate>
            <label className="access-account-field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="off"
                value={credentials.username}
                onChange={(e) => setCredentials((c) => ({ ...c, username: e.target.value }))}
                required
              />
            </label>
            <label className="access-account-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="off"
                value={credentials.password}
                onChange={(e) => setCredentials((c) => ({ ...c, password: e.target.value }))}
                required
              />
            </label>

            {error ? (
              <p className="access-account-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="access-account-button" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying…' : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="access-account-picker">
            <input
              type="text"
              className="access-account-search"
              placeholder="Search by name, username or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />

            {error ? (
              <p className="access-account-error" role="alert">
                {error}
              </p>
            ) : null}

            <ul className="access-account-results">
              {isSearching ? <li className="access-account-hint">Searching…</li> : null}
              {!isSearching && results.length === 0 ? (
                <li className="access-account-hint">No employees found.</li>
              ) : null}
              {results.map((employee) => (
                <li key={employee.emp_id}>
                  <button
                    type="button"
                    className="access-account-result"
                    disabled={isSubmitting}
                    onClick={() => handleSelectEmployee(employee)}
                  >
                    <span className="access-account-result-name">{employee.name}</span>
                    <span className="access-account-result-meta">
                      {employee.user_name} · {employee.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccessAccountPage;
