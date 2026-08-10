import { useCallback, useState } from 'react';

/**
 * State mirrored into localStorage. Same API as `useState`.
 *
 * Reads lazily (once, on mount) and swallows storage failures — private mode
 * and quota errors must never take the app down over a preference.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage unavailable — keep in-memory state working */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}
