import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ServerCrash } from 'lucide-react';

import { env } from '@config/env';
import { ROUTES } from '@constants/routes';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import styles from './ErrorPage.module.css';

/**
 * Router-level error element. Handles both thrown route responses (403/500/…)
 * and unexpected exceptions raised while a route resolves.
 *
 * @param {Object} props
 * @param {number} [props.status]  Force a status when rendered as a static route.
 */
export function ErrorPage({ status: forcedStatus }) {
  const error = useRouteError();

  const status = forcedStatus ?? (isRouteErrorResponse(error) ? error.status : undefined) ?? 500;

  const copy = {
    403: {
      title: 'You don’t have access to this page',
      description:
        'Your account doesn’t include the permissions this page requires. Contact an administrator if you think this is a mistake.',
    },
    500: {
      title: 'Something went wrong on our end',
      description:
        'The page couldn’t be loaded. Try again in a moment — if it keeps happening, please report it.',
    },
  }[status] ?? {
    title: 'Unexpected error',
    description: 'The page couldn’t be loaded.',
  };

  useDocumentTitle(copy.title);

  return (
    <main className={styles.page} role="alert">
      <span className={styles.iconWrapper} aria-hidden="true">
        <ServerCrash className={styles.icon} />
      </span>

      <p className={styles.code}>{status}</p>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.description}>{copy.description}</p>

      {env.isDevelopment && error ? (
        <pre className={styles.details}>{String(error.stack ?? error.message ?? error)}</pre>
      ) : null}

      <Link to={ROUTES.DASHBOARD} className={styles.action}>
        Back to dashboard
      </Link>
    </main>
  );
}

export default ErrorPage;
