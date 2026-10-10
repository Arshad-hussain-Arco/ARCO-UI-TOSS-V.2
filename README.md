# TOSS — Treasury IT One Stop Store

A React single-page application rebuilt from a Figma design export. The user
interface is preserved pixel-for-pixel; the implementation underneath is a
conventional, layered React app.

## Tech stack

| Concern          | Choice                              |
| ---------------- | ----------------------------------- |
| UI library       | React 19                            |
| Build tool       | Vite 6                              |
| Language         | JavaScript (JSX only)               |
| Routing          | React Router v7 (data router)       |
| Styling          | CSS Modules + global design tokens   |
| HTTP             | Axios (single instance)             |
| State            | React Context + custom hooks        |
| Quality          | ESLint 9 (flat config) + Prettier   |

## Getting started

Requires **Node 20 or newer**. The app builds on Node 18, but Tailwind's native
binary and React Router both declare `node >= 20`, so 18 only works with the
pinned Tailwind version in `package.json`.

```bash
npm install
```

```bash
npm run dev
```

| Script                 | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Dev server on http://localhost:3000         |
| `npm run build`        | Production build into `dist/`                |
| `npm run preview`      | Serve the production build locally           |
| `npm run lint`         | ESLint over the whole project                |
| `npm run lint:fix`     | ESLint with autofix                          |
| `npm run format`       | Prettier write                               |
| `npm run format:check` | Prettier check (use in CI)                   |

## Production build (step by step)

Do this on the build machine (Windows, PowerShell). Run every command from the
project root folder (the one containing `package.json`).

**Step 1. Check the `.env` file.** It must contain these two lines:

```
VITE_APP_BASE_URL=/tossv2/
VITE_API_BASE_URL=/api
```

`/tossv2/` is only a placeholder. The real URL path is chosen on the server at
deploy time, so you do not need to change it per environment.

**Step 2. Install packages** (only needed the first time, or when
`package.json` has changed):

```powershell
npm install
```

**Step 3. Build the app:**

```powershell
npm run build
```

When it finishes, a folder called `dist-template` exists. This is the build.
(A `dist` folder is also created. It is not needed for the zip.)

**Step 4. Create the zip file.** Change the date in the file name to today's
date (`DD-MM-YYYY`). If you make a second build on the same day, add `_2`, `_3`,
and so on (for example `build-v2-11-10-2026_2.zip`):

```powershell
$z = "build-v2-11-10-2026.zip"; Remove-Item $z -ErrorAction SilentlyContinue; Copy-Item scripts\set-base.mjs .\set-base.mjs; Compress-Archive -Path dist-template, set-base.mjs -DestinationPath $z; Remove-Item set-base.mjs
```

**Step 5. Check the zip** (optional). You should see `set-base.mjs` and paths
starting with `dist-template/`:

```powershell
tar -tf build-v2-11-10-2026.zip | Select-Object -First 10
```

If the Linux server's `unzip` has trouble with the zip, create it with `tar`
instead of Step 4:

```powershell
Copy-Item scripts\set-base.mjs .\set-base.mjs; tar -a -c -f build-v2-11-10-2026.zip dist-template set-base.mjs; Remove-Item set-base.mjs
```

**Step 6. Hand over the zip.** The zip contains two things:

| Item             | What it is                                              |
| ---------------- | ------------------------------------------------------- |
| `dist-template/` | The app, built with a placeholder URL path              |
| `set-base.mjs`   | Script that swaps the placeholder for the real URL path |

Send the zip to the production team, then follow "Deploying to production"
below.

## Deploying to production (step by step)

For the person who manages the web server. In the examples, `tossnex` is the URL
name, which gives `http://10.67.121.27/tossnex/`. Replace the name, IP and zip
file name with your own.

You need:

- Shell access to the web server, with `sudo` for nginx.
- Access to the API server's `.env` file, and the ability to restart the API.
- A name for the app URL (here `tossnex`). It needs a leading and trailing slash
  where it is used below.

Node is **not** needed on the server. The shell commands below do the same job
as `set-base.mjs`.

### Part 1. Prepare the frontend files

**1.1 Unzip**

```bash
mkdir -p ~/build && cd ~/build
unzip <zip-file-name>.zip
ls
```

You should see `dist-template` and `set-base.mjs`. Run everything below from this
folder.

**1.2 Create `dist/` with your URL name.** The name you choose here must also be
used in nginx (Part 3).

```bash
NAME=/tossnex/
rm -rf dist && cp -r dist-template dist
find dist -type f \( -name '*.html' -o -name '*.js' -o -name '*.mjs' -o -name '*.css' -o -name '*.json' -o -name '*.webmanifest' -o -name '*.svg' -o -name '*.txt' \) \
  -exec sed -i "s#/__TOSS_BASE__/#${NAME}#g" {} +
```

**1.3 Check that it worked**

```bash
grep -E "script|icon" dist/index.html | head -3
grep -rl "__TOSS_BASE__" dist
```

- The first command should show `/tossnex/config.js` and `/tossnex/favicon.png`.
- The second command must print **nothing**. If it lists files, redo step 1.2.

**1.4 Check `dist/config.js` (optional)**

```js
window.__TOSS_CONFIG__ = {
  API_BASE_URL: "",
  WS_BASE_URL: "",
};
```

- `API_BASE_URL: ""` means the API is at `/api` on the same host. This is the normal
  setup behind nginx. Leave it unless the API is somewhere else.
- `WS_BASE_URL: ""` works out the WebSocket address from the API address. Set it
  only if the WebSocket server is separate, for example
  `ws://10.67.121.27:8004/ws`.

### Part 2. Copy the files to the web root

The web root in this example is `/usr/share/nginx/toss_v2/`.

**2.1 Back up the current files** (this is your rollback copy):

```bash
sudo cp -r /usr/share/nginx/toss_v2 /usr/share/nginx/toss_v2.bak-$(date +%F)
```

**2.2 Replace the files:**

```bash
sudo rm -rf /usr/share/nginx/toss_v2/*
sudo cp -r dist/* /usr/share/nginx/toss_v2/
```

**2.3 Restore the old `config.js` if it had custom values.** Skip this if the old
file was the default.

```bash
sudo cp /usr/share/nginx/toss_v2.bak-$(date +%F)/config.js /usr/share/nginx/toss_v2/config.js
```

**2.4 Fix permissions:**

```bash
sudo chmod -R a+rX /usr/share/nginx/toss_v2
```

If SELinux is on (RHEL), also run:

```bash
sudo restorecon -Rv /usr/share/nginx/toss_v2
```

### Part 3. Configure nginx

**3.1 Update `nginx.conf`.** Replace the old `tossv2` block with the one below.
The name must match Part 1 exactly.

```nginx
# --- tossnex ---
location = /tossnex {
    return 301 /tossnex/;
}
location /tossnex/ {
    alias /usr/share/nginx/toss_v2/;
    index index.html;
    try_files $uri $uri/ /tossnex/index.html;
}
# runtime settings file: never cached
location = /tossnex/config.js {
    alias /usr/share/nginx/toss_v2/config.js;
    add_header Cache-Control "no-store";
}
# --- end tossnex ---
```

- The `try_files` line ending in `/tossnex/index.html` is required. Without it,
  refreshing a page other than the home page gives a 404.
- Keep the existing `/api/` (and `/ws`) proxy blocks unchanged. The app calls the
  API at `/api` on the same host.
- The old `/tossv2/` block can be removed. If you keep it, those URLs will return
  404 because the new build no longer uses them.

**3.2 Test, then reload:**

```bash
sudo nginx -t
sudo nginx -s reload
```

Do not reload if `nginx -t` shows an error. Fix the error first.

### Part 4. Configure the API server (fixes the "CSRF Failed" error)

The CSRF error is separate from the frontend path. The API only allows the
origins listed in an environment variable, and by default that is just localhost.

**4.1 Edit the API's `.env` file** (next to `manage.py` in the API project):

```
FRONTEND_ORIGINS=http://10.67.121.27
AUTH_COOKIE_SECURE=False
DJANGO_DEBUG=False
```

- `FRONTEND_ORIGINS` is the address as shown in the browser: scheme and host,
  plus the port if it is not 80. **No path** (no `/tossnex`) and no trailing
  slash. For several origins, separate them with commas, for example
  `http://10.67.121.27,http://toss.company.com`.
- `AUTH_COOKIE_SECURE=False` is required while the site uses plain HTTP. If it is
  `True`, browsers will not store the login cookies. When the site moves to
  HTTPS, set it to `True` and change the origin to `https://...`.
- `DJANGO_DEBUG` defaults to `True`, so set it to `False` in production.

**4.2 Restart the API.** The settings are only read at startup, so the restart is
required. Use whatever runs the API (systemd, gunicorn, supervisor):

```bash
sudo systemctl restart <api-service-name>
```

### Part 5. Check that it works

1. Open `http://10.67.121.27/tossnex/` and hard-refresh (Ctrl+F5). The login page
   should load.
2. Open browser DevTools, Network tab. Assets should load from
   `/tossnex/assets/...` and API calls should go to `/api/...`.
3. Log in, apply a leave and update something. There should be no "CSRF Failed"
   error.
4. In the profile menu, open **View as Role** and **Access Account**. They should
   open at `/tossnex/view-as-role` and `/tossnex/access-account`.
5. Open a page other than the home page (for example `/tossnex/<some-page>`) and
   refresh. It should still load.

### Troubleshooting

| Problem | Likely cause and fix |
| ------- | -------------------- |
| Old UI still shows, or requests go to `/tossv2/...` | Browser cache or service worker. Hard-refresh, then DevTools > Application > Service Workers > Unregister, and clear site data. |
| Blank page, assets give 404 | The name in Part 1 does not match nginx. Compare `grep script dist/index.html` with the nginx `location` line. |
| `/tossnex/<page>` gives 404 on refresh | The `try_files` line is missing or has the wrong name. |
| 403 from nginx | File permissions or SELinux. Redo step 2.4. |
| CSRF error continues | `FRONTEND_ORIGINS` is wrong, or the API was not restarted. The error names the origin the browser sent. It must match exactly. |
| Login works, but you get logged out or actions fail | `AUTH_COOKIE_SECURE=True` on HTTP. Set it to `False` and restart the API. |
| `grep -rl "__TOSS_BASE__" dist` lists files | The replacement missed them. Redo step 1.2 from a clean `dist-template`. |

### Rollback

```bash
sudo rm -rf /usr/share/nginx/toss_v2/*
sudo cp -r /usr/share/nginx/toss_v2.bak-<date>/* /usr/share/nginx/toss_v2/
```

Then restore the old nginx block and reload nginx.

### Changing the URL name later

Repeat Parts 1 to 3 with the new name. The same `dist-template/` is reused, so no
new build is needed. Update the nginx `location`, reload nginx, and hard-refresh
the browser. Part 4 is not affected, because the API origin has no path.

## Signing in (development)

Authentication is mocked. Any non-empty username and password signs you in;
the username selects which fixture profile you get (`ishaq` → Admin,
`manager` → Manager, `consultant` → Consultant, anything else → Admin).

## Project structure

```
src/
├── api/            axios instance, endpoint catalogue, ApiError
├── app/            provider composition
├── assets/         images, icons, fonts
├── components/
│   ├── common/     ErrorBoundary, Image, ScrollToTop
│   ├── ui/         Button and other design primitives
│   ├── forms/      Select and other form controls
│   ├── layout/     Header, Sidebar, PageWrapper
│   ├── navigation/ Breadcrumb
│   ├── feedback/   Loader, Spinner, Skeleton, EmptyState, ErrorState, Toaster
│   └── data-display/ cards, calendars, summaries shared across pages
├── config/         env.js — the only reader of import.meta.env
├── constants/      routes, navigation, storage keys, UI constants
├── context/        Auth, Theme, Sidebar, Toast providers
├── hooks/          useAuth, useTheme, useSidebar, useToast, useAsync, …
├── layouts/        AuthLayout, DashboardLayout, PageLayout, BlankLayout
├── mocks/          data/ fixtures + handlers/ that mimic the API
├── pages/          one directory per route, co-located styles and sections
├── routes/         route tree, guards, lazy helper, router provider
├── services/       per-domain service objects (live + mock pairs)
├── styles/         global entry, base element styles, utilities
├── theme/          design tokens (light/dark) and shadcn primitives
├── utils/          storage, formatting, class names, ids, async helpers
├── App.jsx
└── main.jsx
```

Import via the path aliases declared in `vite.config.js` and `jsconfig.json`
(`@components/…`, `@hooks/…`, `@services/…`, and so on) rather than long
relative chains.

## Architecture notes

### Routing

`src/routes/routes.jsx` is the single route tree. Every page is loaded with
`React.lazy`, so each route is its own bundle chunk. The tree layers guards and
layouts rather than branching inside components:

```
/                          → redirect to /dashboard
PublicRoute → AuthLayout   → /login
ProtectedRoute
  └ DashboardLayout        → /dashboard, /documents        (full-bleed)
      └ PageLayout         → every other page              (breadcrumb + scroll area)
BlankLayout                → /403, /500, catch-all 404
```

`ProtectedRoute` waits for the persisted session to be restored before deciding,
so a page refresh does not bounce a signed-in user to the login screen. It also
accepts a `requiredPermission` for per-route authorisation.

Breadcrumb trails are derived from `SIDEBAR_NAVIGATION` in
`src/constants/navigation.js`, so a label or path only ever changes in one place.

### Data layer

Components never call `axios` and never embed fixture data. The chain is:

```
page → service → (mock handler | httpClient) → endpoint
```

Each service pairs a live implementation with a mock one:

```js
export const dashboardService = withMocks(
  { getSummary: (params) => httpClient.get(ENDPOINTS.dashboard.summary, { params }) },
  dashboardMocks,
);
```

`withMocks` picks an implementation once at module load and, in development,
warns if the two objects drift out of sync. Going live means setting
`VITE_API_BASE_URL` and `VITE_USE_MOCKS=false` — no component changes. Copy
`.env.example` to `.env` to configure it.

All rejections are normalised to an `ApiError` with a stable
`{ message, status, code, details }` shape, and a 401 clears the session through
a handler that `AuthContext` registers.

### Styling

Two deliberate conventions:

- **Design tokens and page styles are global.** `src/theme/tokens.css` defines the
  light and dark palettes; every page stylesheet consumes them and keys dark mode
  off `[data-theme='dark']` on `<html>`, which `ThemeContext` owns. These
  stylesheets came from the original design and are the source of truth for the
  pixel-perfect appearance, so they were relocated and de-duplicated rather than
  rewritten.
- **New components use CSS Modules,** co-located with the component
  (`Button.jsx` + `Button.module.css`).

Where navigation moved from `<button>` to `<Link>`, each affected stylesheet
carries an explicitly commented override block that neutralises the global anchor
colour and hover underline, so the rendered result is unchanged.

### Accessibility

Interactive elements that the design renders as `<div>` cards or rows use the
helpers in `src/utils/interactive.js` rather than being restyled as buttons:

- `activatable(onActivate, options)` — adds `role="button"`, a tab stop and
  Enter/Space handling, plus optional `aria-pressed` / `aria-expanded`.
- `dismissOverlay(onDismiss)` — for a backdrop that is a **sibling** of its
  dialog; hidden from assistive technology entirely.
- `dismissBackdrop(onDismiss)` — for a backdrop that **wraps** its dialog. It is
  not `aria-hidden` (that would hide the dialog) and only dismisses on clicks
  landing on the backdrop itself.

### Adding a page

1. Create `src/pages/MyThing/MyThingPage.jsx` (+ `MyThingPage.css` if needed).
2. Add its path to `ROUTES` in `src/constants/routes.js`.
3. Add an entry to `SIDEBAR_NAVIGATION` if it belongs in the nav.
4. Register it in `src/routes/routes.jsx` via `lazyPage`.
5. Add fixtures to `src/mocks/data/`, a handler to `src/mocks/handlers/`, and a
   service to `src/services/`.

## Migration notes

Deliberate departures from the Figma export, all of which leave the rendered
result unchanged unless stated:

- **Dead code removed.** None of the 40 shadcn `ui/*` components were imported by
  the application, so they were dropped along with 30+ unused dependencies
  (MUI, most of Radix, `cmdk`, `vaul`, `embla`, `react-dnd`, `motion`, …). Only
  `@radix-ui/react-select` survives, behind `components/forms/Select`.
- **Duplicate stylesheets removed.** `theme.css` duplicated `default_theme.css`,
  and `LeaveConfiguration.css` was superseded by its "Modern" variant.
- **Toasts now render.** The export imported `toast` from sonner but never mounted
  a `<Toaster />`, so those calls were silently dropped. `ToastProvider` +
  `Toaster` give them a surface built from the project's own tokens.
- **Anchor overrides.** Where navigation moved from `<button>` to `<Link>`, each
  affected stylesheet carries a commented override block that neutralises the
  global anchor colour and hover underline.
- **One normalised helper line.** The "Environment Server IP" row in System
  Settings used an inline-styled `.ss-form-label` instead of `.ss-form-helper`
  like every other row; it now uses the shared class. This changes that single
  line's `line-height` from `normal` to `1.4`.
- **Labels beside custom selects are now `<span>`.** They wrapped no form control,
  so they announced an association that did not exist. Styling is unchanged.
- **`TeamKPICard` is unreferenced.** It was already unused in the export; the
  component is kept under `components/data-display` for reuse.
- **Known gaps.** The permission matrix in Role Management is a single grid shared
  by every role (as in the design), Murex script selection has no control to change
  it, and export/bulk-action buttons are inert placeholders. Each is commented at
  the call site.
