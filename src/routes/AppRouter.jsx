import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { routes } from './routes';

/**
 * The application's single router instance. Created once at module scope so it
 * survives re-renders of the provider tree.
 */
const router = createBrowserRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
