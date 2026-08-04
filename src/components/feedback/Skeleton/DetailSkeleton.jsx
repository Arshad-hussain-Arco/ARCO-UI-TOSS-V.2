import { memo } from 'react';

import { Skeleton } from './Skeleton';
import { ListSkeleton } from './ListSkeleton';
import styles from './Skeleton.module.css';

/** Sidebar-list + main-content split placeholder — matches Documents/detail-panel layouts. */
function DetailSkeletonComponent({ sidebarRows = 6 }) {
  return (
    <div className={styles.detailSkeleton} aria-hidden="true">
      <div className={styles.detailSkeletonMain}>
        <Skeleton height={18} width="45%" />
        <Skeleton height={12} count={4} />
      </div>
      <div className={styles.detailSkeletonSidebar}>
        <ListSkeleton rows={sidebarRows} showAvatar={false} />
      </div>
    </div>
  );
}

export const DetailSkeleton = memo(DetailSkeletonComponent);
export default DetailSkeleton;
