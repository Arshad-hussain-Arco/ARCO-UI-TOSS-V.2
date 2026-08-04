import { memo } from 'react';

import { Skeleton } from './Skeleton';
import styles from './Skeleton.module.css';

/** Row of small stat/KPI tile placeholders — matches dashboard stat strips. */
function StatsRowSkeletonComponent({ count = 4 }) {
  return (
    <div className={styles.statsRowSkeleton} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.statTileSkeleton}>
          <Skeleton height={10} width="60%" />
          <Skeleton height={20} width="40%" />
        </div>
      ))}
    </div>
  );
}

export const StatsRowSkeleton = memo(StatsRowSkeletonComponent);
export default StatsRowSkeleton;
