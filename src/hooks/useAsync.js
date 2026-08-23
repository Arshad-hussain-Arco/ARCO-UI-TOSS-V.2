import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async service call and exposes its lifecycle, guarding against state
 * updates after unmount and against out-of-order responses.
 *
 * @template T
 * @param {() => Promise<T>} asyncFn        Must be stable (wrap in useCallback).
 * @param {Object}  [options]
 * @param {boolean} [options.immediate=true]  Run on mount.
 * @param {T}       [options.initialData=null]
 */
export function useAsync(asyncFn, { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const currentRun = ++runId.current;

    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn();

      if (isMounted.current && currentRun === runId.current) {
        setData(result);
      }

      return result;
    } catch (caught) {
      const isCanceled = caught?.name === 'CanceledError' || caught?.code === 'ERR_CANCELED' || caught?.message?.includes('canceled');
      if (isMounted.current && currentRun === runId.current && !isCanceled) {
        setError(caught);
      }
      return undefined;
    } finally {
      if (isMounted.current && currentRun === runId.current) {
        setIsLoading(false);
      }
    }
  }, [asyncFn]);

  // Only depend on `immediate` here, not `run` — if a caller's asyncFn identity
  // changes on every render (e.g. it closes over a value that updates on error),
  // depending on `run` would refire this effect and re-trigger the fetch in a loop.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (immediate) runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return { data, isLoading, error, refetch: run, setData };
}

export default useAsync;
