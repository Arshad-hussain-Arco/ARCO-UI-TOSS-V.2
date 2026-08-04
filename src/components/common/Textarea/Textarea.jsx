import { forwardRef, memo, useId } from 'react';

import { cn } from '@utils/cn';

import fieldStyles from '../Input/Input.module.css';

const TextareaComponent = forwardRef(function Textarea(
  { label, required = false, helpText, errorText, className, id, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const hasError = Boolean(errorText);

  return (
    <div className={fieldStyles.field}>
      {label ? (
        <label htmlFor={textareaId} className={fieldStyles.label}>
          {label}
          {required ? <span className={fieldStyles.required}>*</span> : null}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cn(fieldStyles.input, hasError && fieldStyles.error, className)}
        style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, resize: 'vertical' }}
        aria-invalid={hasError || undefined}
        {...rest}
      />
      {hasError ? (
        <span className={fieldStyles.errorText}>{errorText}</span>
      ) : helpText ? (
        <span className={fieldStyles.helpText}>{helpText}</span>
      ) : null}
    </div>
  );
});

export const Textarea = memo(TextareaComponent);
export default Textarea;
