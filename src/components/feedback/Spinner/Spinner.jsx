import { memo } from 'react';

import { cn } from '@utils/cn';

import styles from './Spinner.module.css';

/**
 * Indeterminate activity indicator.
 *
 * @param {Object} props
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.label='Loading']  Announced to assistive technology.
 * @param {string} [props.className]
 */
function SpinnerComponent({ size = 'md', label = 'Loading', className }) {
  return (
    <span className={cn(styles.spinner, styles[size], className)} role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const Spinner = memo(SpinnerComponent);
export default Spinner;
