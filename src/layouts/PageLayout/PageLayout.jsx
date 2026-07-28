import { Outlet } from 'react-router-dom';

import { PageWrapper } from '@components/layout/PageWrapper/PageWrapper';

/**
 * Layout route that gives its children the standard page chrome: a breadcrumb
 * trail plus a scrollable content region.
 *
 * The dashboard and the document browser are deliberately outside this layout —
 * both manage their own full-height scrolling regions, exactly as in the original
 * design.
 */
export function PageLayout() {
  return (
    <PageWrapper>
      <Outlet />
    </PageWrapper>
  );
}

export default PageLayout;
