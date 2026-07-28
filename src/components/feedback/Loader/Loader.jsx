import { memo } from 'react';

import { Spinner } from '@components/feedback/Spinner/Spinner';
import { cn } from '@utils/cn';

import styles from './Loader.module.css';

/**
 * Centred loading state. Used as the Suspense fallback for lazily loaded routes
 * and for any panel waiting on a service call.
 *
 * @param {Object} props
 * @param {string}  [props.message='Loading…']
 * @param {boolean} [props.fullScreen=false] Fill the viewport instead of the parent.
 * @param {string}  [props.className]
 */
function LoaderComponent({ message = 'Loading…', fullScreen = false, className }) {
  return (
    <div
      className={cn(styles.loader, fullScreen && styles.fullScreen, className)}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" label={message} />
      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
}

export const Loader = memo(LoaderComponent);
export default Loader;
