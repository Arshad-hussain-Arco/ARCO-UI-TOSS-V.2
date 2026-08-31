import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

import { TOAST_VARIANTS } from '@constants/ui';
import { useToast } from '@hooks/useToast';

import styles from './Toaster.module.css';

const VARIANT_ICONS = {
  [TOAST_VARIANTS.SUCCESS]: CheckCircle2,
  [TOAST_VARIANTS.ERROR]: AlertCircle,
  [TOAST_VARIANTS.WARNING]: AlertTriangle,
  [TOAST_VARIANTS.INFO]: Info,
  [TOAST_VARIANTS.LOADING]: Loader2,
};

/**
 * Renders the toast queue held by ToastProvider. Mounted once, at the root of
 * the application, so any component can raise a toast via useToast().
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.viewport} role="region" aria-label="Notifications">
      {toasts.map(({ id, title, description, variant }) => {
        const Icon = VARIANT_ICONS[variant] ?? Info;

        return (
          <div
            key={id}
            className={styles.toast}
            data-variant={variant}
            role={variant === TOAST_VARIANTS.ERROR ? 'alert' : 'status'}
            aria-live={variant === TOAST_VARIANTS.ERROR ? 'assertive' : 'polite'}
          >
            <Icon
              className={styles.icon}
              aria-hidden="true"
              style={variant === TOAST_VARIANTS.LOADING ? { animation: 'spin 1s linear infinite' } : undefined}
            />

            <div className={styles.content}>
              <p className={styles.title}>{title}</p>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>

            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(id)}
              aria-label={`Dismiss notification: ${title}`}
            >
              <X className={styles.closeIcon} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Toaster;
