import { forwardRef, memo, useId } from 'react';

import { cn } from '@utils/cn';

import styles from './Radio.module.css';

/**
 * The single radio-button primitive for the application.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {boolean} [props.disabled=false]
 */
const RadioComponent = forwardRef(function Radio(
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
        type="radio"
        className={cn(styles.input, className)}
        disabled={disabled}
        {...rest}
      />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
});

export const Radio = memo(RadioComponent);
export default Radio;
