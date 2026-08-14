import { useCallback, useEffect, useState } from 'react';

/**
 * Fullscreen is a CSS-only overlay concern (position: fixed at a z-index
 * above the host modal), not a portal — this repo has no existing portal
 * precedent and the editor already lives inside the Add/Edit Home Card
 * modal's DOM tree.
 */
export function useFullscreenManager() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(() => setIsFullscreen(true), []);
  const exit = useCallback(() => setIsFullscreen(false), []);
  const toggle = useCallback(() => setIsFullscreen((v) => !v), []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen, exit]);

  return { isFullscreen, enter, exit, toggle };
}
