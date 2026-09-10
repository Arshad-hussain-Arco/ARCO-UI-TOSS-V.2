import { memo } from 'react';

import { Skeleton } from '@components/feedback/Skeleton/Skeleton';

/**
 * Compact in-card loading placeholder shown while a section's own API call
 * is still in flight, so cards fill in progressively instead of the whole
 * dashboard waiting on every endpoint together.
 *
 * @param {Object} props
 * @param {string} [props.label='Loading…']
 * @param {number|string} [props.minHeight=160]
 */
function CardLoaderComponent({ label = 'Loading…', minHeight = 160 }) {
  return (
    <div
      className="dc-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
        minHeight,
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Skeleton height={20} width="60%" style={{ marginBottom: '8px', borderRadius: '4px' }} />
      <Skeleton height={14} width="100%" />
      <Skeleton height={14} width="100%" />
      <Skeleton height={14} width="80%" />
    </div>
  );
}

export const CardLoader = memo(CardLoaderComponent);
export default CardLoader;
