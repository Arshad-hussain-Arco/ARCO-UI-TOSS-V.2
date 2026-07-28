import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll restoration for the shell.
 *
 * The dashboard scrolls an inner element rather than the document, so the
 * browser's native restoration does not apply. A PUSH lands at the top of the new
 * page; a POP (back/forward) is left alone so the browser can restore position.
 *
 * @param {Object} props
 * @param {string} [props.selector]  Scrollable container; defaults to the window.
 */
export function ScrollToTop({ selector }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;

    const target = selector ? document.querySelector(selector) : null;

    if (target) {
      target.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, navigationType, selector]);

  return null;
}

export default ScrollToTop;
