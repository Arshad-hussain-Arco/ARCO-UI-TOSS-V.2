import { useEffect } from 'react';

/**
 * Invokes `handler` when a pointer press or an Escape key press happens outside
 * `ref`. Used by the header menus and any dismissible popover.
 *
 * @param {import('react').RefObject<HTMLElement>} ref
 * @param {(event: Event) => void} handler
 * @param {boolean} [enabled=true]
 */
export function useOnClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler(event);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, handler, enabled]);
}

export default useOnClickOutside;
