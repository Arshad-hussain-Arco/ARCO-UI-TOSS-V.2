import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@services/eodSchedulerService';

/**
 * Loads something once (and again on demand or when `deps` change). A newer request always wins over an older one that finishes late.
 * `reload(true)` refreshes quietly: the old data stays on screen and no spinner or error replaces it (used by polling).
 */
export function useResource(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const sequence = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const mine = (sequence.current += 1);
      if (!quiet) setState((s) => ({ data: s.data, error: null, loading: true }));
      try {
        const data = await loader();
        if (mine === sequence.current) setState({ data, error: null, loading: false });
      } catch (err) {
        if (mine === sequence.current) {
          setState((s) => ({
            data: quiet ? s.data : null,
            error: quiet ? s.error : errorText(err),
            loading: false,
          }));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    setState({ data: null, error: null, loading: true });
    load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);

  return { ...state, reload: load };
}

/** Calls `callback` every `ms` while the page is visible (and `enabled`). */
export function usePolling(callback, ms, enabled = true) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) saved.current();
    }, ms);
    const onVisibility = () => {
      if (!document.hidden) saved.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}
