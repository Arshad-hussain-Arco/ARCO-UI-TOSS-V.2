import { memo } from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '@utils/cn';

import styles from './EmptyState.module.css';

/**
 * Shown when a collection resolves successfully but contains nothing.
 *
 * @param {Object} props
 * @param {import('react').ComponentType} [props.icon=Inbox]
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.action]  Primary call to action.
 * @param {string} [props.className]
 */
function EmptyStateComponent({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn(styles.emptyState, className)}>
      <span className={styles.iconWrapper} aria-hidden="true">
        <Icon className={styles.icon} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);
export default EmptyState;
