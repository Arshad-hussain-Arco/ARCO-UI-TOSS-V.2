import { createContext, useCallback, useMemo, useRef, useState } from 'react';

import { TOAST_DURATION, TOAST_VARIANTS } from '@constants/ui';
import { createId } from '@utils/id';

/**
 * Application-wide toast queue.
 *
 * The Figma export imported `toast` from sonner but never mounted a `<Toaster />`,
 * so those calls were silently dropped. This provider gives them a real surface
 * using the project's own design tokens instead of pulling in a third-party
 * renderer with its own visual language.
 */
export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ title, description, variant = TOAST_VARIANTS.INFO, duration = TOAST_DURATION }) => {
      const id = createId('toast');

      setToasts((current) => [...current, { id, title, description, variant }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => {
    const withVariant = (variant) => (title, options) => show({ ...options, title, variant });

    return {
      toasts,
      show,
      dismiss,
      success: withVariant(TOAST_VARIANTS.SUCCESS),
      error: withVariant(TOAST_VARIANTS.ERROR),
      warning: withVariant(TOAST_VARIANTS.WARNING),
      info: withVariant(TOAST_VARIANTS.INFO),
    };
  }, [toasts, show, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
