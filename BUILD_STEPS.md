# Build & Deploy Steps

The app is served under a sub-path (default `/tossv2/`). The API stays at `/api` on the root.

How it works: `npm run build` produces `dist-template/`, a build with a placeholder base path. `scripts/set-base.mjs` turns it into the deployable `dist/` by swapping in the real path. The script needs only Node, so you can re-run it on the prod server to change the path without rebuilding.

---

## A. On the DEVELOPMENT machine

### A1. Configure

In `.env` (see `.env.example`):

```
VITE_APP_BASE_URL=/tossv2/
VITE_API_BASE_URL=/api
```

`VITE_APP_BASE_URL` needs a leading and trailing slash (`/` for root).

### A2. Build

```bash
npm install
npm run build
```

- `vite build` writes `dist-template/` (git-ignored, do not commit).
- `postbuild` then generates `dist/` from it using `VITE_APP_BASE_URL`.

### A3. Package for shipping

Ship these to the prod server:

| What | Why |
| --- | --- |
| `dist-template/` | the placeholder build; lets prod re-point the path later |
| `scripts/set-base.mjs` | the tool that does it |

(`dist/` is optional: prod can generate it with step B2. Ship it only if you want it ready to serve immediately.)

Example (zip them together):

```bash
zip -r toss-build.zip dist-template scripts/set-base.mjs
```

### A4. Local dev (optional)

```bash
npm run dev
```

Opens at `http://localhost:3000/tossv2/`.

---

## B. On the PRODUCTION server

Requires Node 18+. No `npm install` is needed.

### B1. Unpack

Put `dist-template/` and `set-base.mjs` in the same folder, for example `/var/www/toss/`:

```
/var/www/toss/
  dist-template/
  set-base.mjs
```

### B2. Generate `dist/` with the path you want

```bash
cd /var/www/toss
node set-base.mjs /tossv2/
```

This creates (or overwrites) `/var/www/toss/dist/`. Pass the path explicitly; on prod there is no `.env`.

### B3. Point the web server at `dist/`

- Serve `/var/www/toss/dist/` at the same path you passed above (`/tossv2/`).
- SPA fallback: unknown paths under that prefix must return its `index.html` so deep links and refreshes work.
- Keep `/api` (and `/ws`) routed to the backend on the root (unless you set a full URL in `config.js`, step B3a).
- Session cookie `Path` must cover both `/api` and the app path (use `/`).

Example nginx:

```nginx
location /tossv2/ {
    alias /var/www/toss/dist/;
    try_files $uri $uri/ /tossv2/index.html;
}
location /api/ {
    proxy_pass http://<BACKEND_HOST>:<PORT>;   # supplied by the client
}
```

Reload the web server after changing its config.

### B3a. Backend address (`config.js`, no rebuild)

The build does not contain any server IP. The API address is read when the page loads from `dist/config.js` (a plain file, not bundled). A browser cannot read a `.env` file, so this is its equivalent.

Edit `dist/config.js`:

```js
window.__TOSS_CONFIG__ = {
  API_BASE_URL: "",
};
```

- `""` (default) uses `/api` on the same host as the app. Your web server must proxy `/api` to the backend (see the nginx example above).
- `"http://<BACKEND_HOST>:<PORT>/api"` calls the backend directly. The backend must then allow CORS with credentials for the app's origin, and the session cookie must work cross-origin.

`WS_BASE_URL` (optional, e.g. `"ws://10.67.121.27:8004/ws"`) sets the WebSocket address explicitly; leave it `""` to derive it from `API_BASE_URL`. Note a page served over `https://` cannot open a plain `ws://` socket (browser mixed-content rule).

Reload the page after editing. `set-base` overwrites `dist/` (including `config.js`), so re-apply your edit after running it, or edit a copy at `dist-template/config.js` first and it carries over. Make sure the web server does not cache `config.js` for long.

### B4. Changing the path later (no rebuild)

```bash
cd /var/www/toss
node set-base.mjs /newpath/
```

Then update the web server's `location` to `/newpath/` and reload it. Clients may need a hard refresh.

### B5. Verify

- `/tossv2/` loads the login or dashboard page.
- Refreshing on a deep link such as `/tossv2/<some-route>` still loads.
- The sidebar highlights the active item, and the user-guide images load.
- Network tab: assets come from `/tossv2/assets/...` and API calls go to the address configured in `config.js` (default `/api/...`).

---

## Notes

- Windows: run `set-base` from PowerShell or cmd. In Git Bash, `/newpath/` is rewritten to a Windows path; prefix with `MSYS_NO_PATHCONV=1` if you must use Git Bash.
- On the dev machine you can also run `npm run set-base -- /newpath/` (same script).
- Use `withBase('/path')` from `@config/env` for any hard-coded absolute URL in code (images, `window.location.assign`, etc.). Routes via React Router need nothing extra; the router has the `basename`.
- Don't use `window.location.pathname` for route matching; use `useLocation()`.
