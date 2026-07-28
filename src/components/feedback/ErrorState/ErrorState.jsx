import { memo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';
import { cn } from '@utils/cn';

import styles from './ErrorState.module.css';

/**
 * Inline failure state for a panel or page whose data could not be loaded.
 *
 * @param {Object} props
 * @param {string} [props.title='Something went wrong']
 * @param {string} [props.description]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.retryLabel='Try again']
 * @param {string} [props.className]
 */
function ErrorStateComponent({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}) {
  return (
    <div className={cn(styles.errorState, className)} role="alert">
      <span className={styles.iconWrapper} aria-hidden="true">
        <AlertTriangle className={styles.icon} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} leadingIcon={RotateCcw}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export const ErrorState = memo(ErrorStateComponent);
export default ErrorState;
