import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { ThemeName } from '@/design';

/**
 * Theme state. The initial value is applied by an inline script in index.html
 * before first paint; this hook takes over afterwards and keeps `<html>` and
 * localStorage in sync.
 */
export function useTheme() {
  const [theme, setTheme] = useLocalStorage<ThemeName>(
    'lm.theme',
    (document.documentElement.dataset.theme as ThemeName) ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [setTheme],
  );

  return { theme, setTheme, toggle };
}
