import { useEffect } from 'react';

import { APP_NAME } from '@constants/app';

/**
 * Per-page document title. This is the SPA replacement for framework-level
 * metadata handling — each page declares its own title.
 *
 * @param {string} [title] Page title; omit to fall back to the app name alone.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;

    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default useDocumentTitle;
