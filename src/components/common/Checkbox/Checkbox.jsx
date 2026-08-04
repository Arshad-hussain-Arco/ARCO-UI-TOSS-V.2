import { forwardRef, memo, useId } from 'react';

import { cn } from '@utils/cn';

import styles from './Checkbox.module.css';

/**
 * The single checkbox primitive for the application.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {boolean} [props.disabled=false]
 */
const CheckboxComponent = forwardRef(function Checkbox(
  { label, className, id, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label htmlFor={inputId} className={styles.wrapper} data-disabled={disabled || undefined}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(styles.input, className)}
        disabled={disabled}
        {...rest}
      />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
});

export const Checkbox = memo(CheckboxComponent);
export default Checkbox;
