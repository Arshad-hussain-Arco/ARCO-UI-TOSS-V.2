import { forwardRef, memo } from 'react';

import { Spinner } from '@components/feedback/Spinner/Spinner';
import { cn } from '@utils/cn';

import styles from './Button.module.css';

/**
 * The single button primitive for the application.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'|'success'|'warning'|'info'|'link'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'|'iconOnly'} [props.size='md']
 * @param {import('react').ComponentType} [props.leadingIcon]
 * @param {import('react').ComponentType} [props.trailingIcon]
 * @param {boolean} [props.isLoading=false]  Disables the button and swaps in a spinner.
 * @param {boolean} [props.fullWidth=false]
 * @param {'button'|'submit'|'reset'} [props.type='button']
 */
const ButtonComponent = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    isLoading = false,
    fullWidth = false,
    type = 'button',
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" className={styles.spinner} /> : null}
      {!isLoading && LeadingIcon ? (
        <LeadingIcon className={styles.glyph} aria-hidden="true" />
      ) : null}
      {children ? <span className={styles.label}>{children}</span> : null}
      {TrailingIcon ? <TrailingIcon className={styles.glyph} aria-hidden="true" /> : null}
    </button>
  );
});

export const Button = memo(ButtonComponent);
export default Button;
