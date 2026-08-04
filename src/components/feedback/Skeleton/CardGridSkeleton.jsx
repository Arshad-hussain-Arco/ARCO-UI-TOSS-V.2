import { memo } from 'react';

import { Skeleton } from './Skeleton';
import styles from './Skeleton.module.css';

/**
 * Grid of card-shaped loading placeholders — matches KPI/stat/config-card grids.
 *
 * @param {Object} props
 * @param {number} [props.count=4]
 * @param {number} [props.minWidth=220]  CSS px passed to the grid's minmax().
 * @param {number} [props.lines=2]  Body lines per card.
 */
function CardGridSkeletonComponent({ count = 4, minWidth = 220, lines = 2 }) {
  return (
    <div
      className={styles.cardGridSkeleton}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.cardSkeleton}>
          <Skeleton height={12} width="50%" />
          <Skeleton height={24} width="35%" />
          {lines > 0 && <Skeleton height={10} width="70%" count={lines} />}
        </div>
      ))}
    </div>
  );
}

export const CardGridSkeleton = memo(CardGridSkeletonComponent);
export default CardGridSkeleton;
