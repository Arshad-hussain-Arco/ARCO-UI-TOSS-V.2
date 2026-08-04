import { forwardRef, memo, useId } from 'react';

import { cn } from '@utils/cn';

import fieldStyles from '../Input/Input.module.css';
import styles from './TimePicker.module.css';

/**
 * Time field sharing Input's border/height/padding/focus styling.
 * Built on the native time input (broad browser support for time-of-day entry),
 * with browser chrome overridden to match the design system.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {boolean} [props.required=false]
 * @param {string} [props.helpText]
 * @param {string} [props.errorText]
 */
const TimePickerComponent = forwardRef(function TimePicker(
  { label, required = false, helpText, errorText, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = Boolean(errorText);

  return (
    <div className={fieldStyles.field}>
      {label ? (
        <label htmlFor={inputId} className={fieldStyles.label}>
          {label}
          {required ? <span className={fieldStyles.required}>*</span> : null}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        type="time"
        className={cn(fieldStyles.input, styles.input, hasError && fieldStyles.error, className)}
        aria-invalid={hasError || undefined}
        aria-describedby={helpText || errorText ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {hasError ? (
        <span id={`${inputId}-desc`} className={fieldStyles.errorText}>
          {errorText}
        </span>
      ) : helpText ? (
        <span id={`${inputId}-desc`} className={fieldStyles.helpText}>
          {helpText}
        </span>
      ) : null}
    </div>
  );
});

export const TimePicker = memo(TimePickerComponent);
export default TimePicker;
