import { forwardRef, memo, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@utils/cn';

import fieldStyles from '../Input/Input.module.css';
import styles from './PasswordInput.module.css';

/**
 * Password field with a show/hide toggle. Shares all Input styling and states.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {boolean} [props.required=false]
 * @param {string} [props.helpText]
 * @param {string} [props.errorText]
 * @param {boolean} [props.success=false]
 * @param {import('react').ComponentType} [props.icon] - Optional leading icon.
 */
const PasswordInputComponent = forwardRef(function PasswordInput(
  { label, required = false, helpText, errorText, success = false, icon: Icon, className, id, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
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
      <div className={styles.inputRow}>
        {Icon ? <Icon className={styles.leadingIcon} aria-hidden="true" /> : null}
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={cn(
            fieldStyles.input,
            styles.input,
            Icon && styles.inputWithIcon,
            hasError && fieldStyles.error,
            !hasError && success && fieldStyles.success,
            className,
          )}
          aria-invalid={hasError || undefined}
          aria-describedby={helpText || errorText ? `${inputId}-desc` : undefined}
          {...rest}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
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

export const PasswordInput = memo(PasswordInputComponent);
export default PasswordInput;
