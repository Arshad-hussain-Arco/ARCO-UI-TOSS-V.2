import { memo } from 'react';

import { Skeleton } from './Skeleton';
import styles from './Skeleton.module.css';

/**
 * List-shaped loading placeholder: N rows, each with an optional avatar
 * circle followed by a title + subtitle line. Matches consultant/notification/
 * request-list layouts.
 *
 * @param {Object} props
 * @param {number} [props.rows=5]
 * @param {boolean} [props.showAvatar=true]
 */
function ListSkeletonComponent({ rows = 5, showAvatar = true }) {
  return (
    <div className={styles.listSkeleton} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.listSkeletonRow}>
          {showAvatar && <Skeleton variant="circle" width={36} height={36} />}
          <div className={styles.listSkeletonLines}>
            <Skeleton height={13} width="40%" />
            <Skeleton height={11} width="65%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const ListSkeleton = memo(ListSkeletonComponent);
export default ListSkeleton;
