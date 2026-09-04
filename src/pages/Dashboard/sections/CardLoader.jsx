import { memo } from 'react';

import { Spinner } from '@components/feedback/Spinner/Spinner';

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
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        minHeight,
        color: 'var(--text-tertiary)',
      }}
      role="status"
      aria-live="polite"
    >
      <Spinner size="md" label={label} />
      <span style={{ fontSize: '12px', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

export const CardLoader = memo(CardLoaderComponent);
export default CardLoader;
