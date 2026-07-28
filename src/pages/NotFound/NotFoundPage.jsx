import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { ROUTES } from '@constants/routes';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import styles from './NotFoundPage.module.css';

/** 404 — reached by any URL that matches no route. */
export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <main className={styles.page}>
      <span className={styles.iconWrapper} aria-hidden="true">
        <Compass className={styles.icon} />
      </span>

      <p className={styles.code}>404</p>
      <h1 className={styles.title}>We couldn&apos;t find that page</h1>
      <p className={styles.description}>
        The link may be out of date, or the page may have been moved. Check the address, or head
        back to your dashboard.
      </p>

      <Link to={ROUTES.DASHBOARD} className={styles.action}>
        Back to dashboard
      </Link>
    </main>
  );
}

export default NotFoundPage;
