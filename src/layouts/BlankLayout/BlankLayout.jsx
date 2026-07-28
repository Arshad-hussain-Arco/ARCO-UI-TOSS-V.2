import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { ScrollToTop } from '@components/common/ScrollToTop/ScrollToTop';
import { Loader } from '@components/feedback/Loader/Loader';

import styles from './BlankLayout.module.css';

/**
 * Chrome-free layout for standalone screens such as the error and 404 pages,
 * which must render whether or not the shell is available.
 */
export function BlankLayout() {
  return (
    <div className={styles.blank}>
      <ScrollToTop />
      <Suspense fallback={<Loader fullScreen message="Loading…" />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

export default BlankLayout;
