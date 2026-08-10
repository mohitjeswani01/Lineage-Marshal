import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';

export type AsyncState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined }
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ApiError };

/**
 * What `run` resolves to. Returned as a value rather than read back off state,
 * so a caller awaiting `run` gets the outcome immediately instead of racing
 * React's re-render for it.
 */
export type RunResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }
  | { ok: false; error: null; aborted: true };

/**
 * Runs an async function and exposes a discriminated state, with the last
 * in-flight request aborted on re-run or unmount.
 *
 * One hook covers both fetch-on-mount (`immediate`) and fire-on-demand
 * (the trigger form) — enough for this app. Reach for a real query library
 * only when caching or revalidation is actually needed.
 */
export function useAsync<T, A extends unknown[] = []>(
  fn: (signal: AbortSignal, ...args: A) => Promise<T>,
  { immediate = false }: { immediate?: boolean } = {},
) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Keep the latest fn without making `run` change identity every render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<RunResult<T>> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ status: 'loading', data: prev.data }));
    try {
      const data = await fnRef.current(controller.signal, ...args);
      if (!mountedRef.current || controller.signal.aborted) {
        return { ok: false, error: null, aborted: true };
      }
      setState({ status: 'success', data });
      return { ok: true, data };
    } catch (err) {
      const error =
        err instanceof ApiError
          ? err
          : new ApiError('network', String(err), 'unknown');
      if (!mountedRef.current || controller.signal.aborted) {
        return { ok: false, error: null, aborted: true };
      }
      setState({ status: 'error', error });
      return { ok: false, error };
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ status: 'idle' });
  }, []);

  useEffect(() => {
    if (immediate) void run(...([] as unknown as A));
    // Intentionally mount-only: `immediate` is a construction-time choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, run, reset } as const;
}
