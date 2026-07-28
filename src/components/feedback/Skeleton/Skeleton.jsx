import { memo } from 'react';

import { cn } from '@utils/cn';

import styles from './Skeleton.module.css';

/**
 * Content placeholder shown while data loads.
 *
 * @param {Object} props
 * @param {string|number} [props.width='100%']
 * @param {string|number} [props.height=16]
 * @param {'text'|'rect'|'circle'} [props.variant='text']
 * @param {number} [props.count=1]  Render this many stacked lines.
 * @param {string} [props.className]
 */
function SkeletonComponent({
  width = '100%',
  height = 16,
  variant = 'text',
  count = 1,
  className,
}) {
  const toCssSize = (value) => (typeof value === 'number' ? `${value}px` : value);

  return (
    <span className={styles.group} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn(styles.skeleton, styles[variant], className)}
          style={{ width: toCssSize(width), height: toCssSize(height) }}
        />
      ))}
    </span>
  );
}

export const Skeleton = memo(SkeletonComponent);
export default Skeleton;
