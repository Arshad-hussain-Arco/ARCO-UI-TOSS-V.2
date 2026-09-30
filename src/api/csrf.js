/**
 * In-memory CSRF token for the cookie session.
 *
 * The session cookie is sent by the browser automatically, so the backend
 * requires every unsafe request (POST/PUT/PATCH/DELETE) to also carry this
 * token as an X-CSRFToken header. It arrives in the /auth/login/ and
 * /auth/session/ response bodies and deliberately lives only in memory —
 * after a page reload, AuthContext's /auth/session/ check fetches a fresh one.
 */
let csrfToken = null;

export const csrf = {
  get: () => csrfToken,
  set: (token) => {
    if (token) csrfToken = token;
  },
};

export default csrf;
