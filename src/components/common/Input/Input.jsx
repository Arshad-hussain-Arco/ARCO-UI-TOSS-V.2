import { forwardRef, memo, useId } from 'react';

import { cn } from '@utils/cn';

import styles from './Input.module.css';

/**
 * The single bordered text-input primitive for the application.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {boolean} [props.required=false]
 * @param {string} [props.helpText]
 * @param {string} [props.errorText]
 * @param {boolean} [props.success=false]
 * @param {import('react').ComponentType} [props.icon] - Optional leading icon.
 */
const InputComponent = forwardRef(function Input(
  { label, required = false, helpText, errorText, success = false, icon: Icon, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = Boolean(errorText);

  return (
    <div className={styles.field}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required ? <span className={styles.required}>*</span> : null}
        </label>
      ) : null}
      <div className={Icon ? styles.inputRow : undefined}>
        {Icon ? <Icon className={styles.inputIcon} aria-hidden="true" /> : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            styles.input,
            Icon && styles.inputWithIcon,
            hasError && styles.error,
            !hasError && success && styles.success,
            className,
          )}
          aria-invalid={hasError || undefined}
          aria-describedby={helpText || errorText ? `${inputId}-desc` : undefined}
          {...rest}
        />
      </div>
      {hasError ? (
        <span id={`${inputId}-desc`} className={styles.errorText}>
          {errorText}
        </span>
      ) : helpText ? (
        <span id={`${inputId}-desc`} className={styles.helpText}>
          {helpText}
        </span>
      ) : null}
    </div>
  );
});

export const Input = memo(InputComponent);
export default Input;
