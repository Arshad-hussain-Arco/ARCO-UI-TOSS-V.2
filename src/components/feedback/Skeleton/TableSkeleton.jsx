import { memo } from 'react';

import { Skeleton } from './Skeleton';
import styles from './Skeleton.module.css';

/**
 * Table-shaped loading placeholder: a header row + N body rows of M columns.
 *
 * @param {Object} props
 * @param {number} [props.rows=6]
 * @param {number} [props.columns=5]
 * @param {boolean} [props.showHeader=true]
 */
function TableSkeletonComponent({ rows = 6, columns = 5, showHeader = true }) {
  return (
    <div className={styles.tableSkeleton} aria-hidden="true">
      {showHeader && (
        <div className={styles.tableSkeletonRow}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={`h-${i}`} height={12} width={i === 0 ? '60%' : '80%'} />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={styles.tableSkeletonRow}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? '70%' : '85%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const TableSkeleton = memo(TableSkeletonComponent);
export default TableSkeleton;
