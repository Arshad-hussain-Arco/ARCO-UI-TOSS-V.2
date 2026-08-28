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

  // Actions are memoized separately from `toasts` so that calling toast.error/success
  // (which updates `toasts`) doesn't hand out a new function identity — consumers that
  // put `toast` in a useCallback/useEffect dependency array would otherwise re-run
  // every time a toast fires, which can trigger infinite fetch-then-toast-error loops.
  const actions = useMemo(() => {
    const withVariant = (variant) => (title, options) => show({ ...options, title, variant });

    return {
      show,
      dismiss,
      success: withVariant(TOAST_VARIANTS.SUCCESS),
      error: withVariant(TOAST_VARIANTS.ERROR),
      warning: withVariant(TOAST_VARIANTS.WARNING),
      info: withVariant(TOAST_VARIANTS.INFO),
    };
  }, [show, dismiss]);

  const value = useMemo(() => ({ toasts, ...actions }), [toasts, actions]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
