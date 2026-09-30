import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

/**
 * The "Access Account" (impersonation) flow. Every call here except
 * `end` carries its own explicit Authorization header (a setup token, or
 * nothing for the first step) rather than relying on httpClient's normal
 * token-attachment — see httpClient.js's request interceptor, which never
 * overrides a header the caller already set.
 */
export const impersonationService = {
  /** Step 1: verify the dedicated impersonation-admin credential. */
  authenticate: async ({ username, password }) => {
    const response = await httpClient.post(endpoints.impersonate.authenticate, {
      username,
      password,
    });
    return response.data; // { setup_token, expires_in_minutes, admin }
  },

  /** Step 2: searchable employee picker, scoped by the setup token. */
  searchEmployees: async (setupToken, query = '') => {
    const response = await httpClient.get(endpoints.impersonate.employees, {
      params: query ? { q: query } : undefined,
      headers: { Authorization: `Bearer ${setupToken}` },
    });
    return response.data.results;
  },

  /** Step 3: start the session — issues the impersonation access/refresh pair. */
  start: async (setupToken, targetEmployeeId) => {
    const response = await httpClient.post(
      endpoints.impersonate.start,
      { target_employee_id: targetEmployeeId },
      { headers: { Authorization: `Bearer ${setupToken}` } },
    );
    return response.data; // { access, refresh, session_id, admin, target }
  },

  /**
   * "View as Role" — unlike Access Account, this never touches another
   * person's identity/data, only the caller's own with simulated
   * permissions. So there's no separate credential/setup-token step:
   * these two calls rely on the caller's own real login session (the
   * HttpOnly session cookie, shared with the tab that opened this one).
   */
  listRoles: async () => {
    const response = await httpClient.get(endpoints.impersonate.roles);
    return response.data.results;
  },

  /** Starts the role-view session — own identity, simulated role's permissions. */
  startRole: async (roleId) => {
    const response = await httpClient.post(endpoints.impersonate.rolesStart, { role_id: roleId });
    return response.data; // { access, refresh, session_id, admin, role }
  },

  /** Ends the session tied to the given impersonation access token. */
  end: async (accessToken) => {
    await httpClient.post(
      endpoints.impersonate.end,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  },
};

export default impersonationService;
