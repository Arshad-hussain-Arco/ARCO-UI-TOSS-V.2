import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { env } from '@config/env';

import { routes } from './routes';

/**
 * The application's single router instance. Created once at module scope so it
 * survives re-renders of the provider tree.
 */
const router = createBrowserRouter(routes, {
  basename: env.basePath.replace(/\/$/, '') || undefined,
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
