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

### Signing in

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
