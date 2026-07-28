import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { Loader } from '@components/feedback/Loader/Loader';

/**
 * Wrapper for unauthenticated screens. The login page owns its own full-bleed
 * background, so this layout adds no chrome — only the Suspense boundary needed
 * for lazily loaded public pages.
 */
export function AuthLayout() {
  return (
    <Suspense fallback={<Loader fullScreen message="Loading…" />}>
      <Outlet />
    </Suspense>
  );
}

export default AuthLayout;
